import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateLimbAngles,
  calculateCameraTransform,
  calculateTotalDuration,
  getSceneAtTimestamp,
  calculateElevenLabsTiming,
  getActiveWordIndexAtProgress,
  blendLimbAngles,
} from './stickmanMath';
import { StickmanScene } from '../types/stickman';

test('calculateTotalDuration sums all scene durations accurately', () => {
  const dummyScenes: StickmanScene[] = [
    {
      id: '1',
      title: 'Scene 1',
      duration: 4,
      narration: 'Hello',
      character1: { name: 'Hero', color: '#000', action: 'talk_explaining', expression: 'talking', position: 'center' },
      environment: 'sketch_grid',
      cameraEffect: 'none',
      soundEffect: 'none',
    },
    {
      id: '2',
      title: 'Scene 2',
      duration: 6,
      narration: 'World',
      character1: { name: 'Hero', color: '#000', action: 'work_computer', expression: 'talking', position: 'center' },
      environment: 'hacker_den',
      cameraEffect: 'zoom_in',
      soundEffect: 'typing',
    },
  ];

  assert.equal(calculateTotalDuration(dummyScenes), 10);
  assert.equal(calculateTotalDuration([]), 0);
});

test('getSceneAtTimestamp identifies correct scene and progress within scene', () => {
  const scenes: StickmanScene[] = [
    {
      id: '1',
      title: 'Scene 1',
      duration: 5,
      narration: 'Part 1',
      character1: { name: 'Hero', color: '#000', action: 'talk_explaining', expression: 'talking', position: 'center' },
      environment: 'sketch_grid',
      cameraEffect: 'none',
      soundEffect: 'none',
    },
    {
      id: '2',
      title: 'Scene 2',
      duration: 5,
      narration: 'Part 2',
      character1: { name: 'Hero', color: '#000', action: 'fight_kungfu', expression: 'angry', position: 'center' },
      environment: 'japanese_dojo',
      cameraEffect: 'shake',
      soundEffect: 'punch',
    },
  ];

  // At 2.5s -> Scene 1 at 50% progress
  const res1 = getSceneAtTimestamp(scenes, 2.5);
  assert.equal(res1.index, 0);
  assert.equal(res1.scene?.id, '1');
  assert.ok(Math.abs(res1.sceneProgress - 0.5) < 0.001);

  // At 7.5s -> Scene 2 at 50% progress
  const res2 = getSceneAtTimestamp(scenes, 7.5);
  assert.equal(res2.index, 1);
  assert.equal(res2.scene?.id, '2');
  assert.ok(Math.abs(res2.sceneProgress - 0.5) < 0.001);

  // At 12s -> clamps to last scene
  const res3 = getSceneAtTimestamp(scenes, 12);
  assert.equal(res3.index, 1);
  assert.equal(res3.sceneProgress, 1);
});

test('calculateLimbAngles produces valid organic multi-joint angles and varies across time and beats', () => {
  const actions = [
    'drive_car',
    'car_chase',
    'car_drift',
    'walk_city',
    'hero_rooftop',
    'presentation_stage',
    'talk_explaining',
    'fight_kungfu',
    'sword_duel',
    'work_computer',
    'money_celebrate',
    'panic_freakout',
    'walking',
    'dramatic_fall',
    'thinking',
    'hero_landing',
    'zombie_survive_barricade',
    'trillion_buy_everything',
    'scavenge_supplies',
    'command_crowd',
  ] as const;

  for (const act of actions) {
    const a1 = calculateLimbAngles(act, 0.25, true, 1.2, 0);
    const a2 = calculateLimbAngles(act, 0.65, true, 3.1, 2);
    assert.ok(!Number.isNaN(a1.leftArmUpper));
    assert.ok(!Number.isNaN(a1.rightArmUpper));
    assert.ok(!Number.isNaN(a1.leftWristFlex));
    assert.ok(!Number.isNaN(a1.rightWristFlex));
    assert.ok(!Number.isNaN(a1.spineCurve));
    assert.notEqual(a1.leftArmUpper, a2.leftArmUpper);

    const blended = blendLimbAngles(a1, a2, 0.5);
    assert.ok(!Number.isNaN(blended.leftArmUpper));
  }
});

test('calculateElevenLabsTiming computes accurate WPM duration, syllables, and break tags', () => {
  const sample = 'Era apenas mais uma entrega noturna no centro da cidade, até que duas viaturas fecharam o cruzamento.';
  const slow = calculateElevenLabsTiming(sample, 135);
  const standard = calculateElevenLabsTiming(sample, 155);
  const fast = calculateElevenLabsTiming(sample, 175);

  assert.equal(standard.wordCount, 17);
  assert.ok(standard.syllableCount >= 30);
  assert.ok(slow.totalDurationSec > standard.totalDurationSec);
  assert.ok(standard.totalDurationSec > fast.totalDurationSec);
  assert.ok(standard.elevenLabsBreakScript.includes('<break'));

  const wordIdxStart = getActiveWordIndexAtProgress(sample, 0.02, 155);
  const wordIdxEnd = getActiveWordIndexAtProgress(sample, 0.98, 155);
  assert.equal(wordIdxStart, 0);
  assert.equal(wordIdxEnd, 16);
});

test('calculateCameraTransform handles camera shake and zoom bounds', () => {
  const zoomRes = calculateCameraTransform('zoom_in', 0.5);
  assert.ok(zoomRes.zoom > 1);

  const shakeRes = calculateCameraTransform('shake', 0.1);
  assert.ok(shakeRes.zoom >= 1);
  assert.ok(typeof shakeRes.offsetX === 'number');
  assert.ok(typeof shakeRes.offsetY === 'number');
});
