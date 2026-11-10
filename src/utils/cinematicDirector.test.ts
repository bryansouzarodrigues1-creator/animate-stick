import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeDeterministicSeed,
  inferContextFromText,
  validateAndNormalizeDirectorResponse,
  validateAndNormalizeScenePlan,
} from './cinematicDirector';
import { generateChoreographyForScene, resolveActiveBeatState } from './choreographyEngine';
import {
  calculateLimbAngles,
  blendLimbAngles,
  solveTwoBoneIK,
  resolveBiomechanicalHumanPose,
  getSceneAnchors,
  minimumJerkEase,
  organicPerlin1D,
  getProsodicSpeechEnvelope,
} from './stickmanMath';
import { constructWorldStage } from './sceneConstructor';
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

test('5. Backward compatibility with existing legacy scenes that have no scenePlan or seed', () => {
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

test('6. Biomechanical 2-Bone Analytical IK, Foot-Planting & SceneAnchors accuracy', () => {
  // Verify 2-bone IK preserves exact segment lengths and reaches target within reach radius
  const ik = solveTwoBoneIK(0, -72, 16, -2, 38, 38, 1);
  const len1 = Math.hypot(ik.midX - 0, ik.midY - -72);
  const len2 = Math.hypot(ik.endX - ik.midX, ik.endY - ik.midY);

  assert.ok(Math.abs(len1 - 38) < 1e-6, 'Upper bone length is invariant');
  assert.ok(Math.abs(len2 - 38) < 1e-6, 'Lower bone length is invariant');
  assert.ok(Math.abs(ik.endX - 16) < 0.5, 'IK end effector X reaches target X');
  assert.ok(Math.abs(ik.endY - -2) < 0.5, 'IK end effector Y reaches ground plane target Y');

  // Verify grounded stance plants feet on ground plane (ankleY <= 0) even with heavy weightShift
  const angles = calculateLimbAngles('talk_explaining', 0.5, true, 2.2, 0.5, 'none', 1, {
    seed: 4242,
    intensity: 0.85,
    anticipation: 0.6,
    reaction: 0.7,
    settle: 0.5,
    weightShift: 0.6,
  });
  const pose = resolveBiomechanicalHumanPose(angles, 'talk_explaining', 0.5, 2.2, 0.5, 0.05, {
    seed: 4242,
    weightShift: 0.6,
  });

  assert.ok(pose.leftLeg.ankleY <= 0.1, 'Left ankle never penetrates below ground plane');
  assert.ok(pose.rightLeg.ankleY <= 0.1, 'Right ankle never penetrates below ground plane');
  assert.ok(pose.leftLeg.planted || pose.rightLeg.planted, 'Grounded stance plants stance feet');

  // Verify SceneAnchors returns valid groundY and interaction anchor
  const zombieAnchors = getSceneAnchors('zombie_apocalypse', 1280, 720);
  assert.equal(zombieAnchors.groundY, 720 * 0.72);
  assert.equal(zombieAnchors.interactionAnchor?.type, 'barricade');
});

test('7. Minimum-Jerk C2 trajectories, 1D Perlin postural noise, Prosodic speech envelope & 2.5D foreshortening', () => {
  // 1. Minimum-jerk boundary conditions: f(0)=0, f(0.5)=0.5, f(1)=1, strictly monotonic
  assert.equal(minimumJerkEase(0), 0);
  assert.ok(Math.abs(minimumJerkEase(0.5) - 0.5) < 1e-9);
  assert.equal(minimumJerkEase(1), 1);
  assert.ok(minimumJerkEase(0.25) < 0.25, 'Minimum-jerk eases in smoothly');
  assert.ok(minimumJerkEase(0.75) > 0.75, 'Minimum-jerk eases out smoothly');

  // 2. Deterministic 1D Perlin noise stays within [-1, 1] and is 100% reproducible
  for (let i = 0; i <= 20; i++) {
    const x = i * 0.37;
    const n1 = organicPerlin1D(x, 12345);
    const n2 = organicPerlin1D(x, 12345);
    assert.equal(n1, n2, 'Perlin noise is strictly deterministic');
    assert.ok(n1 >= -1 && n1 <= 1, 'Perlin noise stays within [-1, 1]');
  }

  // 3. Prosodic Speech Envelope detects active syllable pulse vs punctuation pause window
  const narration = 'Atenção imediata! O sistema entrou em colapso.';
  const envSpeaking = getProsodicSpeechEnvelope(narration, 0.08, 155);
  assert.ok(envSpeaking.syllablePulse > 0, 'Active word produces positive syllable pulse');
  assert.equal(envSpeaking.isBreathPause, false, 'Early word progress is not in breath pause window');

  // 4. 2.5D foreshortening narrows shoulder span during 3/4 turn (facingCos = 0.35 vs facingCos = 1.0)
  const baseAngles = calculateLimbAngles('talk_explaining', 0.4, true, 1.8, 0.4, 'none', 0, {
    seed: 999,
  });
  const poseFull = resolveBiomechanicalHumanPose(
    baseAngles,
    'talk_explaining',
    0.4,
    1.8,
    0.4,
    0,
    { seed: 999 },
    undefined,
    envSpeaking,
    1.0
  );
  const poseTurn = resolveBiomechanicalHumanPose(
    baseAngles,
    'talk_explaining',
    0.4,
    1.8,
    0.4,
    0,
    { seed: 999 },
    undefined,
    envSpeaking,
    0.35
  );

  const spanFull = Math.hypot(
    poseFull.rightShoulderX - poseFull.leftShoulderX,
    poseFull.rightShoulderY - poseFull.leftShoulderY
  );
  const spanTurn = Math.hypot(
    poseTurn.rightShoulderX - poseTurn.leftShoulderX,
    poseTurn.rightShoulderY - poseTurn.leftShoulderY
  );
  assert.ok(spanTurn < spanFull, '2.5D yaw foreshortening narrows bi-deltoid shoulder span during turn');
  assert.ok(
    typeof poseFull.rightArm.thumbX === 'number' && typeof poseFull.rightArm.fingerX === 'number',
    'Articulated hand resolves thumb and finger coordinates'
  );
});

test('8. 2.5D World Scene Constructor: WWII Brazilian Soldier (FEB), Volumetric 6x6 Military Truck, Travelling Camera & Physical Cover Interaction', () => {
  const warScene = validateAndNormalizeScenePlan(
    {
      id: 'feb_monte_castello_test',
      title: 'Soldado Brasileiro Correndo ao Lado do Caminhão 6x6 em Monte Castello',
      duration: 6.5,
      narration:
        'O soldado da FEB corre ao lado do caminhão militar na estrada enlameada enquanto a artilharia explode e ele usa o paralama blindado como cobertura!',
    },
    0,
    undefined,
    1945
  );

  assert.equal(warScene.environment, 'ww2_battlefield', 'AI Director routes war/truck prompt to ww2_battlefield');

  const beatStart = resolveActiveBeatState(warScene, 0.15);
  const stageStart = constructWorldStage(warScene, beatStart, 0.15, 1280, 720);

  const beatMid = resolveActiveBeatState(warScene, 0.42);
  const stageMid = constructWorldStage(warScene, beatMid, 0.42, 1280, 720);

  assert.equal(stageStart.isConstructedWarWorld, true, '2.5D World Stage activates for WWII scene');
  assert.equal(stageStart.truck.active, true, 'Volumetric 6x6 military truck is active in stage');
  assert.ok(
    stageMid.camera.worldScrollX > stageStart.camera.worldScrollX,
    'Travelling camera scrolls continuously forward in world space'
  );
  assert.ok(
    stageMid.truck.wheelSpinRad !== stageStart.truck.wheelSpinRad,
    '6x6 truck wheels rotate proportionally to world travel distance'
  );
  assert.ok(
    stageMid.structures.length >= 3,
    '2.5D extruded structures (stone walls, sandbag bunkers, mileposts) populate the world'
  );
  assert.ok(
    stageMid.explosions.length > 0,
    'Artillery explosion & supersonic shockwave active during bombardment window'
  );
});



