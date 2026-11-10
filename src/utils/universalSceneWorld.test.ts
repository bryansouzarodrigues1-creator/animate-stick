import test from 'node:test';
import assert from 'node:assert/strict';
import { validateUniversalWorldPlan } from './universalSceneWorld';

const kitchenPlan = {
  schemaVersion: '1.0',
  sceneId: 'kitchen-breakfast',
  duration: 8,
  environment: { description: 'A warm family kitchen', locationType: 'kitchen', visualStyle: 'stylized_3d' },
  entities: [
    { id: 'hero', kind: 'character', assetKey: 'character.stickman', label: 'Protagonist',
      transform: { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } } },
    { id: 'counter', kind: 'architecture', assetKey: 'kitchen.counter', label: 'Kitchen counter',
      transform: { position: { x: 1, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 2, y: 1, z: 1 } } },
    { id: 'cup', kind: 'prop', assetKey: 'prop.cup', label: 'Cup',
      transform: { position: { x: 1, y: 1, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } } },
  ],
  interactions: [{ id: 'take-cup', actorId: 'hero', targetId: 'cup', verb: 'grab', start: 2, end: 4, contactPoint: 'handle' }],
  shots: [{ start: 0, end: 8, type: 'wide', subjectIds: ['hero'], movement: 'dolly' }],
};

test('accepts a non-military kitchen world and preserves interaction semantics', () => {
  const result = validateUniversalWorldPlan(kitchenPlan);
  assert.equal(result.valid, true);
  assert.equal(result.plan?.environment.locationType, 'kitchen');
  assert.equal(result.plan?.interactions[0].verb, 'grab');
});

test('drops interactions that reference missing entities instead of crashing', () => {
  const result = validateUniversalWorldPlan({
    ...kitchenPlan,
    interactions: [{ id: 'bad', actorId: 'hero', targetId: 'missing', verb: 'push', start: 1, end: 3 }],
  });
  assert.equal(result.valid, true);
  assert.equal(result.plan?.interactions.length, 0);
  assert.ok(result.warnings.some(w => w.includes('missing')));
});

test('clamps invalidly large scale and out-of-range timestamps', () => {
  const result = validateUniversalWorldPlan({
    ...kitchenPlan,
    entities: kitchenPlan.entities.map((e, i) => i ? e : ({
      ...e, transform: { ...e.transform, scale: { x: 1000, y: -4, z: 1 } },
    })),
    interactions: [{ id: 'grab', actorId: 'hero', targetId: 'cup', verb: 'grab', start: -4, end: 900 }],
  });
  assert.equal(result.valid, true);
  assert.equal(result.plan?.entities[0].transform.scale.x, 100);
  assert.equal(result.plan?.entities[0].transform.scale.y, 4);
  assert.equal(result.plan?.interactions[0].start, 0);
  assert.equal(result.plan?.interactions[0].end, 8);
});

test('rejects scenes that exceed the entity budget', () => {
  const result = validateUniversalWorldPlan({
    ...kitchenPlan,
    entities: Array.from({ length: 161 }, (_, i) => ({
      id: `e${i}`, kind: 'prop', assetKey: 'prop.box', label: 'Box',
      transform: { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } },
    })),
  });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(e => e.includes('160')));
});
