import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateWorldStageFrame3D,
  computeExplosionPhysicsState,
} from './cinematicShotDirector';
import { PRESET_PROJECTS } from './presetScripts';

test('1. Multi-Camera Shot Director dynamically cuts across distinct 3D shots and lenses instead of staying static', () => {
  const scene = PRESET_PROJECTS.ww2_brazilian_soldier_feb.scenes[0];
  const samples = [0.05, 0.26, 0.42, 0.65, 0.88];
  const shots = samples.map((p) => evaluateWorldStageFrame3D(scene, p, 0));

  const uniqueShotTypes = new Set(shots.map((s) => s.shot.shotType));
  assert.ok(
    uniqueShotTypes.size >= 3,
    `Expected at least 3 distinct 3D camera shot types across a single scene, got ${[...uniqueShotTypes].join(', ')}`
  );

  // Verify lenses and FOV vary between close-up and wide/impact shots
  const fovs = shots.map((s) => s.shot.fov);
  const minFov = Math.min(...fovs);
  const maxFov = Math.max(...fovs);
  assert.ok(
    maxFov - minFov >= 15,
    `Expected dynamic FOV changes between close-up and wide/impact shots (range=${maxFov - minFov})`
  );
});

test('2. 3D Rigid-Body Explosion Physics computes debris bounce, displaced supply crates, and character knockback', () => {
  const scene = PRESET_PROJECTS.ww2_brazilian_soldier_feb.scenes[1];
  const preBlast = computeExplosionPhysicsState(scene, 0.1, 22, 20.5);
  const midBlast = computeExplosionPhysicsState(scene, 0.34, 25, 23.5);

  assert.equal(preBlast.isDetonating, false);
  assert.equal(midBlast.isDetonating, true);
  assert.ok(midBlast.shockwaveRadius > 4, 'Shockwave should expand radially');
  assert.ok(midBlast.flashIntensity > 0.5, 'Explosion should emit dynamic point-light flash');
  assert.equal(midBlast.debris.length, 24, 'Should spawn 24 3D rigid-body debris fragments');
  assert.ok(
    midBlast.crates.some((c) => c.displaced),
    'Supply crates must physically displace when hit by shockwave'
  );
  assert.ok(
    midBlast.characterKnockbackX < -0.1,
    'Soldier should experience physical knockback impulse from blast wave'
  );
  assert.equal(
    midBlast.characterShieldingFace,
    true,
    'Soldier should shield face during peak blast wave'
  );
});

test('3. 3D Articulated Stickman Rig executes anticipation crouch, tailgate grab, and bed boarding in Scene 4', () => {
  const scene4 = PRESET_PROJECTS.ww2_brazilian_soldier_feb.scenes[3];
  const approachFrame = evaluateWorldStageFrame3D(scene4, 0.4, 3);
  const anticipationFrame = evaluateWorldStageFrame3D(scene4, 0.54, 3);
  const leapGrabFrame = evaluateWorldStageFrame3D(scene4, 0.68, 3);
  const aboardFrame = evaluateWorldStageFrame3D(scene4, 0.92, 3);

  assert.equal(approachFrame.heroRig.boardingPhase, 'sprinting_beside');
  assert.equal(anticipationFrame.heroRig.boardingPhase, 'crouch_anticipation');
  assert.ok(
    anticipationFrame.heroRig.pelvisOffsetY < -0.1,
    'Anticipation crouch must lower center-of-mass before jumping'
  );
  assert.equal(leapGrabFrame.heroRig.boardingPhase, 'leaping_tailgate_grab');
  assert.ok(
    leapGrabFrame.heroRig.handContactWorldPos !== null,
    'Hands must lock onto the 3D tailgate bar during leap grab'
  );
  assert.equal(aboardFrame.heroRig.boardingPhase, 'hauling_into_bed');
  assert.ok(
    aboardFrame.heroRig.worldPos.y > 0.45,
    'Soldier must be elevated onto the 3D truck bed after hauling up'
  );
});

test('4. 3D World Zones progress across scenes so environment composition evolves', () => {
  const scenes = PRESET_PROJECTS.ww2_brazilian_soldier_feb.scenes;
  const f0 = evaluateWorldStageFrame3D(scenes[0], 0.2, 0);
  const f1 = evaluateWorldStageFrame3D(scenes[1], 0.5, 1);
  const f2 = evaluateWorldStageFrame3D(scenes[2], 0.8, 2);

  assert.equal(f0.zoneIndex, 0);
  assert.equal(f1.zoneIndex, 1);
  assert.equal(f2.zoneIndex, 2);
  assert.notEqual(f0.zoneName, f1.zoneName);
  assert.notEqual(f1.zoneName, f2.zoneName);
});
