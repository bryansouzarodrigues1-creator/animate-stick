import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeDeterministicSeed,
  inferContextFromText,
  validateAndNormalizeDirectorResponse,
  validateAndNormalizeScenePlan,
} from './cinematicDirector';
import { generateChoreographyForScene, resolveActiveBeatState } from './choreographyEngine';
import { calculateLimbAngles, blendLimbAngles } from './stickmanMath';
import { StickmanScene } from '../types/stickman';

test('1. Plan validation and safe fallback: contextual action selection (never hardcoded by idx) and malformed JSON recovery', () => {
  // Malformed JSON string must safely fall back to contextual scenes
  const fallbackResult = validateAndNormalizeDirectorResponse(
    '{ invalid json ::: ',
    'O piloto acelerou o carro esportivo na rodovia fazendo drift na curva. No laboratório secreto, a cientista analisou o código no computador. Na cobertura, ele tomou café refletindo sobre o plano.',
    '16:9'
  );

  assert.equal(fallbackResult.fallbackUsed, true);
  assert.ok(fallbackResult.scenes.length >= 3, 'Should split script into at least 3 contextual scenes');

  // Scene 0 is about driving/drift -> vehicle action
  assert.ok(
    ['car_drift', 'drive_car', 'car_chase'].includes(fallbackResult.scenes[0].character1.action),
    `Scene 0 action (${fallbackResult.scenes[0].character1.action}) should be vehicle-related based on narration`
  );
  // Scene 1 is about secret lab / computer -> work_computer (NOT hardcoded idx===1 fight_kungfu!)
  assert.equal(
    fallbackResult.scenes[1].character1.action,
    'work_computer',
    'Scene 1 at idx=1 must reflect its computer/lab narration, never hardcoded fight_kungfu'
  );
  assert.equal(fallbackResult.scenes[1].environment, 'secret_lab');

  // Scene 2 is about coffee / reflection -> coffee_sip (NOT hardcoded idx===2 money_celebrate!)
  assert.equal(
    fallbackResult.scenes[2].character1.action,
    'coffee_sip',
    'Scene 2 at idx=2 must reflect its coffee/reflection narration, never hardcoded money_celebrate'
  );

  // Hallucinated enum values in AI response should be sanitized via contextual inference
  const sanitizedResult = validateAndNormalizeDirectorResponse(
    {
      title: 'Teste Sanitização',
      scenes: [
        {
          title: 'Duelo de Katanas',
          narration: 'O guerreiro sacou a espada katana no dojo para o duelo final!',
          action: 'hallucinated_invalid_action',
          environment: 'invalid_moon_base',
          dramaticIntent: 'invalid_intent',
          emotionalState: 'invalid_emotion',
        },
      ],
    },
    'Duelo de espadas no dojo',
    '16:9'
  );

  const s0 = sanitizedResult.scenes[0];
  assert.equal(s0.character1.action, 'sword_duel');
  assert.equal(s0.environment, 'japanese_dojo');
  assert.ok(s0.scenePlan, 'Scene must include validated scenePlan');
  assert.equal(s0.scenePlan?.dramaticIntent, 'climax_confrontation');
  assert.equal(s0.scenePlan?.emotionalState, 'furious');
  assert.ok(s0.scenePlan && s0.scenePlan.limitations.length > 0, 'Limitations must be recorded honestly');
});

test('2. Beat timing and ordering: relative [0..1] intervals and spatial continuity across beats and scenes', () => {
  const prevScene = validateAndNormalizeScenePlan(
    {
      id: 'continuity_1',
      title: 'Parte 1 no Dojo',
      narration: 'O guerreiro avança pelo dojo com sua espada em punho para enfrentar o rival.',
      environment: 'japanese_dojo',
      character1: { name: 'Akira', color: '#10B981', scale: 1.12 },
    },
    0,
    undefined,
    5000
  );

  const nextSceneSameEnv = validateAndNormalizeScenePlan(
    {
      id: 'continuity_2',
      title: 'Parte 2 no Dojo',
      narration: 'Ele bloqueia o golpe de espada e contra-ataca com fúria no mesmo dojo.',
      environment: 'japanese_dojo',
    },
    1,
    prevScene,
    5000
  );

  // Character identity and location continuity across scenes
  assert.equal(nextSceneSameEnv.character1.name, 'Akira', 'Character name preserved across scenes');
  assert.equal(nextSceneSameEnv.character1.color, '#10B981', 'Character color preserved across scenes');
  assert.equal(nextSceneSameEnv.character1.scale, 1.12, 'Character scale preserved across scenes');
  assert.equal(
    nextSceneSameEnv.scenePlan?.environmentPlan.continuityFromPrevScene,
    'same_location'
  );
  assert.equal(
    nextSceneSameEnv.scenePlan?.characters[0].entryNormalizedX,
    prevScene.scenePlan?.characters[0].exitNormalizedX,
    'Entry X of Scene 2 matches Exit X of Scene 1 in same location'
  );

  // Beat relative times and converted seconds ordering
  const planBeats = nextSceneSameEnv.scenePlan!.beats;
  const runtimeBeats = nextSceneSameEnv.choreography!;
  assert.ok(planBeats.length >= 3, 'At least 3 beats generated');
  assert.equal(planBeats[0].relStart, 0);
  assert.equal(planBeats[planBeats.length - 1].relEnd, 1);

  for (let i = 0; i < planBeats.length; i++) {
    const pb = planBeats[i];
    const rb = runtimeBeats[i];
    assert.ok(pb.relStart < pb.relEnd, `Beat ${i} relStart (${pb.relStart}) < relEnd (${pb.relEnd})`);
    assert.ok(rb.startTime < rb.endTime, `Runtime beat ${i} startTime < endTime`);
    if (i > 0) {
      assert.equal(pb.relStart, planBeats[i - 1].relEnd, 'Beats form contiguous relative partition');
      assert.equal(pb.fromX, planBeats[i - 1].toX, 'Spatial X position is continuous across beat boundaries');
    }
  }
});

test('3. Determinism by timestamp + seed: frame state and limb angles are independent of evaluation order', () => {
  const scene = validateAndNormalizeScenePlan(
    {
      id: 'det_scene',
      title: 'Cena Determinística',
      narration: 'Sobreviventes reforçam a barricada enquanto monitoram o horizonte apocalíptico.',
    },
    0,
    undefined,
    777
  );

  const timestamps = [0.0, 0.17, 0.42, 0.68, 0.93, 1.0];

  // Forward evaluation
  const forwardResults = timestamps.map((p) => {
    const state = resolveActiveBeatState(scene, p);
    const angles = calculateLimbAngles(
      state.effectiveAction1,
      p,
      true,
      state.elapsedInSceneSec,
      state.beatProgress,
      state.maneuver,
      state.beatIndex,
      {
        seed: state.seed,
        intensity: state.intensity,
        anticipation: state.anticipation,
        reaction: state.reaction,
        settle: state.settle,
        weightShift: state.weightShift,
      }
    );
    return { state, angles };
  });

  // Reverse and scrambled evaluation
  const reversedIndices = [5, 2, 0, 4, 1, 3];
  for (const idx of reversedIndices) {
    const p = timestamps[idx];
    const state = resolveActiveBeatState(scene, p);
    const angles = calculateLimbAngles(
      state.effectiveAction1,
      p,
      true,
      state.elapsedInSceneSec,
      state.beatProgress,
      state.maneuver,
      state.beatIndex,
      {
        seed: state.seed,
        intensity: state.intensity,
        anticipation: state.anticipation,
        reaction: state.reaction,
        settle: state.settle,
        weightShift: state.weightShift,
      }
    );

    assert.deepEqual(state, forwardResults[idx].state, `Beat state at p=${p} must be identical regardless of frame order`);
    assert.deepEqual(angles, forwardResults[idx].angles, `Limb angles at p=${p} must be identical regardless of frame order`);
  }
});

test('4. Contextual motion variation: two scenes with the same action but different seeds/contexts produce distinct motion parameters without breaking continuity', () => {
  const seedCalm = computeDeterministicSeed('calm_explanation_scene', 101);
  const seedUrgent = computeDeterministicSeed('urgent_crisis_explanation_scene', 909);

  const ctxCalm = inferContextFromText(
    'Ele explica calmamente os dados da biblioteca em silêncio.',
    'Explicação Calma',
    seedCalm
  );
  const ctxUrgent = inferContextFromText(
    'Ele explica com urgência máxima como escapar do colapso iminente!',
    'Alerta Urgente',
    seedUrgent
  );

  // Force the exact same StickmanAction ('talk_explaining') at the exact same timestamp (1.6s) and beatProgress (0.35)
  const anglesCalm = calculateLimbAngles('talk_explaining', 0.35, true, 1.6, 0.35, 'none', 1, {
    seed: seedCalm,
    intensity: ctxCalm.baseIntensity,
    anticipation: ctxCalm.baseAnticipation,
    reaction: ctxCalm.baseReaction,
    settle: ctxCalm.baseSettle,
    weightShift: -0.2,
  });

  const anglesUrgent = calculateLimbAngles('talk_explaining', 0.35, true, 1.6, 0.35, 'none', 1, {
    seed: seedUrgent,
    intensity: ctxUrgent.baseIntensity,
    anticipation: ctxUrgent.baseAnticipation,
    reaction: ctxUrgent.baseReaction,
    settle: ctxUrgent.baseSettle,
    weightShift: 0.45,
  });

  assert.notEqual(anglesCalm.leftArmUpper, anglesUrgent.leftArmUpper, 'Left arm upper angle differs by seed/context');
  assert.notEqual(anglesCalm.rightArmUpper, anglesUrgent.rightArmUpper, 'Right arm upper angle differs by seed/context');
  assert.notEqual(anglesCalm.bodyLean, anglesUrgent.bodyLean, 'Body lean differs by contextual anticipation/weightShift');

  // Verify continuity when blending between beats
  const midBlend = blendLimbAngles(anglesCalm, anglesUrgent, 0.5);
  assert.ok(
    midBlend.bodyLean > Math.min(anglesCalm.bodyLean, anglesUrgent.bodyLean) &&
      midBlend.bodyLean < Math.max(anglesCalm.bodyLean, anglesUrgent.bodyLean),
    'Pose transition blend smoothly interpolates between contextual poses'
  );
});

test('5. Backward compatibility with legacy scenes that have no scenePlan or seed', () => {
  const legacyScene: StickmanScene = {
    id: 'legacy_01',
    title: 'Cena Antiga Sem Plano',
    duration: 5.0,
    narration: 'Um boneco palito caminhando pela cidade à noite.',
    character1: {
      name: 'Clássico',
      color: '#38BDF8',
      action: 'walk_city',
      expression: 'talking',
      position: 'center',
    },
    environment: 'city_downtown',
    cameraEffect: 'none',
    soundEffect: 'none',
  };

  const beats = generateChoreographyForScene(legacyScene);
  assert.ok(beats.length >= 3, 'Legacy scene generates choreography beats');
  assert.ok(typeof beats[0].seed === 'number' && beats[0].seed > 0, 'Legacy scene receives deterministic beat seed');

  const frameStateA = resolveActiveBeatState(legacyScene, 0.4);
  const frameStateB = resolveActiveBeatState(legacyScene, 0.4);
  assert.deepEqual(frameStateA, frameStateB, 'Legacy scene frame resolution is deterministic');

  const legacyAngles = calculateLimbAngles(legacyScene.character1.action, 0.4, true);
  assert.ok(!Number.isNaN(legacyAngles.leftArmUpper), 'Legacy 3-arg calculateLimbAngles call remains compatible');
});
