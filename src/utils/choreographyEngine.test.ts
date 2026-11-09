import { test } from 'node:test';
import assert from 'node:assert';
import { generateChoreographyForScene, resolveActiveBeatState } from './choreographyEngine';
import { StickmanScene } from '../types/stickman';

test('generateChoreographyForScene breaks scenes into per-second beats', () => {
  const scene: StickmanScene = {
    id: 's1',
    title: 'Perseguição Insana',
    duration: 6.0,
    narration: 'O esportivo acelerou cortando o trânsito da avenida enquanto a viatura ligou a sirene.',
    character1: {
      name: 'Piloto',
      color: '#0284C7',
      action: 'car_chase',
      expression: 'intense',
      prop: 'steering_wheel',
      position: 'center',
    },
    environment: 'police_chase_night',
    cameraEffect: 'shake',
    soundEffect: 'car_engine',
  };

  const beats = generateChoreographyForScene(scene);
  assert.ok(beats.length >= 3, 'Should generate at least 3 choreography beats for a 6-second scene');
  assert.ok(beats[0].label.length > 0, 'First beat should have a descriptive label');
  assert.ok(beats.some((b) => b.maneuver !== 'none'), 'Vehicle scene should feature maneuvers such as nitro, drift or swerve');
});

test('resolveActiveBeatState computes smooth continuous kinematics across progress', () => {
  const scene: StickmanScene = {
    id: 's2',
    title: 'Combate Épico',
    duration: 5.0,
    narration: 'Ele esquivou do golpe e saltou desferindo uma voadora com giro total.',
    character1: {
      name: 'Guerreiro',
      color: '#0284C7',
      action: 'fight_kungfu',
      expression: 'determined',
      prop: 'none',
      position: 'left',
    },
    environment: 'japanese_dojo',
    cameraEffect: 'none',
    soundEffect: 'sword_clash',
  };

  const startState = resolveActiveBeatState(scene, 0.05);
  const midState = resolveActiveBeatState(scene, 0.5);
  const endState = resolveActiveBeatState(scene, 0.95);

  assert.ok(startState.char1XNorm >= 0.1 && startState.char1XNorm <= 0.9, 'char1XNorm in valid screen bounds');
  assert.ok(typeof midState.jumpOffsetY === 'number', 'jumpOffsetY is a number');
  assert.ok(typeof midState.effectiveAction1 === 'string', 'effectiveAction1 is resolved');
  assert.ok(endState.beatIndex >= 0, 'beatIndex is tracked');
});

test('generateChoreographyForScene never repeats identical consecutive beats even with repeated keywords', () => {
  const driftScene: StickmanScene = {
    id: 's_drift',
    title: 'Drift na Montanha',
    duration: 6.0,
    narration: 'Ele puxou o freio de mão, jogou o carro de lado em um drift perfeito soltando fumaça dos pneus na curva.',
    character1: {
      name: 'Piloto',
      color: '#0284C7',
      action: 'car_drift',
      expression: 'confident',
      prop: 'steering_wheel',
      position: 'center',
    },
    environment: 'highway_sunset',
    cameraEffect: 'none',
    soundEffect: 'car_engine',
  };

  const beats = generateChoreographyForScene(driftScene);
  assert.ok(beats.length >= 4, 'Should generate at least 4 distinct beats');
  for (let i = 1; i < beats.length; i++) {
    assert.notStrictEqual(
      beats[i].maneuver,
      beats[i - 1].maneuver,
      `Beat ${i} maneuver (${beats[i].maneuver}) must differ from beat ${i - 1} (${beats[i - 1].maneuver})`
    );
    assert.notStrictEqual(
      beats[i].label,
      beats[i - 1].label,
      `Beat ${i} label (${beats[i].label}) must differ from beat ${i - 1} (${beats[i - 1].label})`
    );
  }
});

test('generateChoreographyForScene produces controlled, objective-driven beats for zombie_apocalypse and trillionaire_sandbox', () => {
  const zombieScene: StickmanScene = {
    id: 'z_test',
    title: 'Sobrevivência Zumbi',
    duration: 7.5,
    narration: 'Sobreviventes erguem barricadas físicas e coletam suprimentos lançados de helicóptero.',
    character1: {
      name: 'Sobrevivente',
      color: '#38BDF8',
      action: 'zombie_survive_barricade',
      expression: 'intense',
      prop: 'shield',
      position: 'center',
    },
    environment: 'zombie_apocalypse',
    cameraEffect: 'zoom_in',
    soundEffect: 'dramatic_boom',
  };

  const zBeats = generateChoreographyForScene(zombieScene);
  assert.ok(zBeats.length >= 3, 'Should generate controlled beats for zombie apocalypse');
  for (let i = 1; i < zBeats.length; i++) {
    assert.notStrictEqual(zBeats[i].action, zBeats[i - 1].action, 'Consecutive zombie beats must not repeat action');
    assert.ok(Math.abs(zBeats[i].toX - zBeats[i].fromX) <= 0.16, 'Horizontal travel per beat is controlled');
  }
});
