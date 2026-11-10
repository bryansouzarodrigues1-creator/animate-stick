import { StickmanScene } from '../types/stickman';
import {
  minimumJerkEase,
  organicPerlin1D,
  getProsodicSpeechEnvelope,
} from './stickmanMath';
import { resolveActiveBeatState } from './choreographyEngine';

export type CinematicShotType =
  | 'low_angle_tracking'
  | 'close_up_emotion'
  | 'over_the_shoulder'
  | 'dutch_impact_blast'
  | 'tailgate_action_mount'
  | 'crane_establishing';

export interface CameraShotDirective {
  shotType: CinematicShotType;
  shotLabel: string;
  lensMm: number;
  fov: number;
  cameraPos: { x: number; y: number; z: number };
  lookAtTarget: { x: number; y: number; z: number };
  dutchRollRad: number;
  traumaShake: number;
  cutIndex: number;
  shotProgress: number;
}

export interface DebrisFragment3D {
  id: number;
  kind: 'crate_plank' | 'stone_chunk' | 'mud_clod' | 'ember_spark';
  pos: { x: number; y: number; z: number };
  rot: { x: number; y: number; z: number };
  scale: { x: number; y: number; z: number };
  active: boolean;
  heat: number;
}

export interface CratePhysicsState3D {
  id: number;
  pos: { x: number; y: number; z: number };
  rot: { x: number; y: number; z: number };
  displaced: boolean;
}

export interface ExplosionPhysicsState3D {
  isDetonating: boolean;
  blastWaveProgress: number; // 0..1
  epicenter: { x: number; y: number; z: number };
  shockwaveRadius: number;
  flashIntensity: number;
  fireballScale: number;
  characterKnockbackX: number;
  characterRecoilPitch: number;
  characterShieldingFace: boolean;
  debris: DebrisFragment3D[];
  crates: CratePhysicsState3D[];
}

export type BoardingPhase =
  | 'sprinting_beside'
  | 'crouch_anticipation'
  | 'leaping_tailgate_grab'
  | 'hauling_into_bed'
  | 'combat_cover_stance';

export interface Stickman3DRigPose {
  worldPos: { x: number; y: number; z: number };
  facingYawRad: number;
  torsoPitchRad: number;
  torsoRollRad: number;
  spineTwistYawRad: number;
  pelvisOffsetY: number;
  headPitchRad: number;
  headYawRad: number;
  jawOpenAmount: number;
  browFurrow: number; // -1 surprised .. +1 angry/focused
  eyeBlink: number;
  leftShoulder: { pitch: number; roll: number; yaw: number };
  leftElbowFlex: number;
  rightShoulder: { pitch: number; roll: number; yaw: number };
  rightElbowFlex: number;
  leftHip: { pitch: number; roll: number };
  leftKneeFlex: number;
  leftAnklePitch: number;
  rightHip: { pitch: number; roll: number };
  rightKneeFlex: number;
  rightAnklePitch: number;
  boardingPhase: BoardingPhase;
  boardingProgress: number;
  handContactWorldPos: { x: number; y: number; z: number } | null;
  muzzleFlashIntensity: number;
  footstrikeImpulse: number;
}

export interface WorldStageFrame3D {
  worldDistanceX: number;
  zoneIndex: number; // 0: Outskirts Convoy, 1: Ruined Village & Bunker, 2: Monte Castello Ridge
  zoneName: string;
  truckWorldPos: { x: number; y: number; z: number };
  truckPitchRad: number;
  truckRollRad: number;
  truckChassisBounceY: number;
  wheelSpinRad: number;
  heroRig: Stickman3DRigPose;
  secondaryRig: Stickman3DRigPose | null;
  explosion: ExplosionPhysicsState3D;
  shot: CameraShotDirective;
}

/**
 * Deterministic hash in [0, 1]
 */
function seededRandom(seed: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * Computes deterministic 3D rigid-body physics for explosions, splintering crates,
 * flying debris with gravity and ground bounce restitution, and blast knockback on actors.
 */
export function computeExplosionPhysicsState(
  scene: StickmanScene,
  sceneProgress: number,
  worldDistanceX: number,
  heroX: number
): ExplosionPhysicsState3D {
  const p = Math.max(0, Math.min(1, sceneProgress));
  const text = `${scene.title || ''} ${scene.narration || ''}`.toLowerCase();
  const isCombatOrBlastScene =
    scene.environment === 'ww2_battlefield' ||
    scene.environment === 'zombie_apocalypse' ||
    scene.cameraEffect === 'shake' ||
    /explos|artilharia|morteiro|bomba|fogo|impacto|ataque|dispara|tiro|bunker/.test(text);

  // Trigger primary blast at p = 0.28 (and secondary salvo at p = 0.68 for intense combat scenes)
  const triggerP = isCombatOrBlastScene ? 0.24 : 0.45;
  const blastDuration = 0.52;
  const rawElapsed = p - triggerP;
  const isDetonating = isCombatOrBlastScene && rawElapsed >= 0 && rawElapsed <= blastDuration;
  const blastWaveProgress = isDetonating
    ? Math.max(0, Math.min(1, rawElapsed / blastDuration))
    : 0;

  const epicenter = {
    x: worldDistanceX + 4.2,
    y: 0.15,
    z: -1.8,
  };

  // Shockwave expands rapidly with C2 easing
  const shockwaveRadius = isDetonating
    ? 0.4 + Math.pow(blastWaveProgress, 0.55) * 14.5
    : 0;

  // High-intensity flash that peaks in the first 18% of the blast and decays exponentially
  const flashIntensity = isDetonating
    ? Math.max(0, Math.exp(-blastWaveProgress * 5.2) * 6.5)
    : 0;

  const fireballScale = isDetonating
    ? Math.sin(Math.min(1, blastWaveProgress * 1.4) * Math.PI) * 3.2
    : 0;

  // Physical impulse on the character when the shockwave front reaches their X coordinate
  const distToHero = Math.max(1.2, Math.abs(epicenter.x - heroX));
  const waveHitWindow =
    isDetonating && blastWaveProgress > 0.04 && blastWaveProgress < 0.58;
  const impulseEnvelope = waveHitWindow
    ? Math.sin(((blastWaveProgress - 0.04) / 0.54) * Math.PI)
    : 0;
  const attenuation = Math.min(1, 4.5 / distToHero);

  const characterKnockbackX = -impulseEnvelope * attenuation * 1.15;
  const characterRecoilPitch = -impulseEnvelope * attenuation * 0.48;
  const characterShieldingFace = impulseEnvelope > 0.25;

  // Generate 24 deterministic 3D ballistic debris fragments with gravity & ground bounce
  const debris: DebrisFragment3D[] = [];
  const simTimeSec = isDetonating ? blastWaveProgress * 2.4 : 0;
  const gravity = 9.81;

  for (let i = 0; i < 24; i++) {
    const r1 = seededRandom(i * 17 + 3);
    const r2 = seededRandom(i * 31 + 7);
    const r3 = seededRandom(i * 47 + 11);
    const angleXZ = r1 * Math.PI * 2;
    const speedXZ = 2.5 + r2 * 7.5;
    const vy0 = 4.2 + r3 * 6.8;

    const vx = Math.cos(angleXZ) * speedXZ;
    const vz = Math.sin(angleXZ) * speedXZ;

    let posX = epicenter.x + vx * simTimeSec;
    let posZ = epicenter.z + vz * simTimeSec;
    let posY = epicenter.y + vy0 * simTimeSec - 0.5 * gravity * simTimeSec * simTimeSec;

    // Ground collision + bounce restitution
    const tGround1 = (vy0 + Math.sqrt(vy0 * vy0 + 2 * gravity * epicenter.y)) / gravity;
    if (simTimeSec > tGround1) {
      const tAfterBounce = simTimeSec - tGround1;
      const vyBounce = vy0 * 0.42; // restitution 0.42
      posY = Math.max(
        0.06,
        0.06 + vyBounce * tAfterBounce - 0.5 * gravity * tAfterBounce * tAfterBounce
      );
      // Friction slows horizontal velocity after ground impact
      posX =
        epicenter.x +
        vx * tGround1 +
        vx * 0.55 * tAfterBounce;
      posZ =
        epicenter.z +
        vz * tGround1 +
        vz * 0.55 * tAfterBounce;
    }

    const kinds: DebrisFragment3D['kind'][] = [
      'crate_plank',
      'stone_chunk',
      'mud_clod',
      'ember_spark',
    ];
    const kind = kinds[i % kinds.length];

    debris.push({
      id: i,
      kind,
      pos: { x: posX, y: Math.max(0.05, posY), z: posZ },
      rot: {
        x: simTimeSec * (3.5 + r1 * 8),
        y: simTimeSec * (2.8 + r2 * 7),
        z: simTimeSec * (4.1 + r3 * 6),
      },
      scale:
        kind === 'crate_plank'
          ? { x: 0.48, y: 0.08, z: 0.16 }
          : kind === 'stone_chunk'
          ? { x: 0.24, y: 0.2, z: 0.22 }
          : kind === 'mud_clod'
          ? { x: 0.16, y: 0.14, z: 0.16 }
          : { x: 0.1, y: 0.1, z: 0.1 },
      active: isDetonating && blastWaveProgress < 0.96,
      heat: Math.max(0, 1 - blastWaveProgress * 1.25),
    });
  }

  // 6 Supply Crates near the blast zone that physically tumble when the shockwave hits
  const crates: CratePhysicsState3D[] = [];
  for (let c = 0; c < 6; c++) {
    const baseOffsetX = 3.1 + (c % 3) * 0.72;
    const baseY = c >= 3 ? 0.68 : 0.32;
    const baseZ = -1.35 - (c % 2) * 0.65;

    const pushProgress = isDetonating
      ? minimumJerkEase(Math.min(1, blastWaveProgress * 1.8))
      : rawElapsed > blastDuration && isCombatOrBlastScene
      ? 1
      : 0;

    const dirX = c % 2 === 0 ? -1.4 : 1.65;
    const dirZ = (c - 2.5) * 0.45;
    const arcY =
      isDetonating && blastWaveProgress < 0.55
        ? Math.sin((blastWaveProgress / 0.55) * Math.PI) * (0.85 + (c % 2) * 0.45)
        : 0;

    crates.push({
      id: c,
      pos: {
        x: worldDistanceX + baseOffsetX + pushProgress * dirX,
        y: pushProgress > 0.5 ? 0.28 + arcY : baseY + arcY,
        z: baseZ + pushProgress * dirZ,
      },
      rot: {
        x: pushProgress * (1.1 + c * 0.4),
        y: pushProgress * (0.8 - c * 0.3),
        z: pushProgress * (1.55 * (c % 2 === 0 ? 1 : -1)),
      },
      displaced: pushProgress > 0.05,
    });
  }

  return {
    isDetonating,
    blastWaveProgress,
    epicenter,
    shockwaveRadius,
    flashIntensity,
    fireballScale,
    characterKnockbackX,
    characterRecoilPitch,
    characterShieldingFace,
    debris,
    crates,
  };
}

/**
 * Computes the 3D Articulated Stickman Rig Pose with genuine weight, anticipation,
 * counter-torsion, prosodic speech jaw/brow acting, and physical vehicle boarding contact.
 */
export function compute3DStickmanRigPose(
  scene: StickmanScene,
  sceneProgress: number,
  worldDistanceX: number,
  truckWorldPos: { x: number; y: number; z: number },
  explosion: ExplosionPhysicsState3D,
  isSecondary: boolean = false,
  wpm: number = 155
): Stickman3DRigPose {
  const p = Math.max(0, Math.min(1, sceneProgress));
  const timeSec = p * Math.max(2, scene.duration || 5);
  const beatState = resolveActiveBeatState(scene, p);
  const text = `${scene.title || ''} ${scene.narration || ''} ${beatState.beat.label || ''}`.toLowerCase();

  const wantsBoarding =
    !isSecondary &&
    (/embarc|subir|sobe|traseira|agarra|carroceria|salta|pula/.test(text) ||
      scene.character1.action === 'truck_board_convoy' ||
      (scene.environment === 'ww2_battlefield' && p > 0.62 && scene.character1.action === 'running'));

  const wantsCoverCombat =
    !isSecondary &&
    !wantsBoarding &&
    (/trincheira|muro|abrigo|atira|dispara|fuzil|cobertura|defend/.test(text) ||
      scene.character1.action === 'trench_cover_fire' ||
      scene.character1.action === 'gun_aim' ||
      scene.character1.action === 'sword_duel');

  // Determine boarding phase & progress
  let boardingPhase: BoardingPhase = 'sprinting_beside';
  let boardingProgress = 0;

  if (wantsBoarding) {
    const localMountP = Math.max(0, Math.min(1, (p - 0.35) / 0.58));
    boardingProgress = localMountP;
    if (localMountP < 0.22) {
      boardingPhase = 'sprinting_beside';
    } else if (localMountP < 0.42) {
      boardingPhase = 'crouch_anticipation';
    } else if (localMountP < 0.72) {
      boardingPhase = 'leaping_tailgate_grab';
    } else {
      boardingPhase = 'hauling_into_bed';
    }
  } else if (wantsCoverCombat) {
    boardingPhase = 'combat_cover_stance';
  }

  // Tailgate world coordinates (rear of the 6x6 truck)
  const tailgateX = truckWorldPos.x - 2.85;
  const tailgateGrabY = truckWorldPos.y + 1.18;
  const truckBedFloorY = truckWorldPos.y + 0.92;
  const tailgateZ = truckWorldPos.z + 0.15;

  // Base world position of character
  let worldX = isSecondary
    ? truckWorldPos.x - 4.4
    : truckWorldPos.x - 1.35 + Math.sin(p * Math.PI) * 0.55;
  let worldY = 0;
  let worldZ = isSecondary ? -0.95 : 1.35; // Foreground track beside the truck

  let facingYawRad = 0; // 0 = facing +X (along road), Math.PI/2 = facing camera
  let torsoPitchRad = 0.28; // Forward athletic lean
  let torsoRollRad = 0;
  let spineTwistYawRad = 0;
  let pelvisOffsetY = 0;

  // Running stride cycle
  const strideFreq = 2.85; // 2.85 strides per second
  const stridePhase = timeSec * strideFreq * Math.PI * 2 + (isSecondary ? 1.7 : 0);
  const strideSin = Math.sin(stridePhase);
  const strideCos = Math.cos(stridePhase);
  const doubleFreqBounce = Math.abs(Math.sin(stridePhase)) * 0.14;
  const footstrikeImpulse = Math.pow(Math.max(0, -Math.cos(stridePhase * 2)), 4);

  // Default running limb kinematics with high amplitude and weight
  let leftHipPitch = strideSin * 0.82;
  let rightHipPitch = -strideSin * 0.82;
  let leftKneeFlex = Math.max(0.12, -strideCos * 0.95 + 0.45);
  let rightKneeFlex = Math.max(0.12, strideCos * 0.95 + 0.45);
  let leftAnklePitch = strideCos * 0.35;
  let rightAnklePitch = -strideCos * 0.35;

  let leftShoulderPitch = -strideSin * 0.78 + 0.25;
  let rightShoulderPitch = strideSin * 0.78 + 0.35;
  let leftShoulderRoll = -0.18;
  let rightShoulderRoll = 0.18;
  let leftShoulderYaw = 0.15;
  let rightShoulderYaw = -0.25;
  let leftElbowFlex = 0.95 + strideSin * 0.25;
  let rightElbowFlex = 1.05 - strideSin * 0.25;

  let handContactWorldPos: { x: number; y: number; z: number } | null = null;
  let muzzleFlashIntensity = 0;

  if (boardingPhase === 'sprinting_beside') {
    pelvisOffsetY = doubleFreqBounce - footstrikeImpulse * 0.06;
    torsoPitchRad = 0.32 + Math.sin(stridePhase * 2) * 0.05;
    spineTwistYawRad = -strideSin * 0.26;
    torsoRollRad = strideCos * 0.08;
    // Angle torso slightly toward +Z camera so 3/4 silhouette & face read clearly
    facingYawRad = -0.28 + organicPerlin1D(timeSec * 0.9, 11) * 0.16;
  } else if (boardingPhase === 'crouch_anticipation') {
    // Deep biomechanical anticipation before jumping onto truck tailgate
    const subP = minimumJerkEase((boardingProgress - 0.22) / 0.2);
    worldX = tailgateX - 0.55 * (1 - subP * 0.4);
    worldZ = tailgateZ + 0.55 * (1 - subP * 0.6);
    pelvisOffsetY = -0.34 * subP;
    torsoPitchRad = 0.52 * subP;
    facingYawRad = -0.25 * subP; // Turning toward tailgate
    leftHipPitch = -0.68 * subP;
    rightHipPitch = -0.52 * subP;
    leftKneeFlex = 1.25 * subP;
    rightKneeFlex = 1.15 * subP;
    // Both arms swing back to load the jump, then reach up
    leftShoulderPitch = -0.65 + subP * 1.45;
    rightShoulderPitch = -0.65 + subP * 1.45;
    leftElbowFlex = 0.55;
    rightElbowFlex = 0.55;
  } else if (boardingPhase === 'leaping_tailgate_grab') {
    // Explosive leap & physical two-handed grip on the steel tailgate bar
    const subP = minimumJerkEase((boardingProgress - 0.42) / 0.3);
    worldX = tailgateX - 0.22 + subP * 0.28;
    worldZ = tailgateZ + 0.2 * (1 - subP);
    worldY = Math.sin(subP * Math.PI) * 0.58 + subP * 0.48;
    pelvisOffsetY = 0.05;
    torsoPitchRad = 0.42 - subP * 0.25;
    facingYawRad = -0.12;
    // Arms stretched up gripping tailgate bar
    leftShoulderPitch = 1.35 - subP * 0.45;
    rightShoulderPitch = 1.35 - subP * 0.45;
    leftElbowFlex = 0.35 + subP * 0.65;
    rightElbowFlex = 0.35 + subP * 0.65;
    // Legs tucked mid-air
    leftHipPitch = -0.75;
    rightHipPitch = -0.45;
    leftKneeFlex = 1.3;
    rightKneeFlex = 1.05;
    handContactWorldPos = {
      x: tailgateX,
      y: tailgateGrabY,
      z: tailgateZ,
    };
  } else if (boardingPhase === 'hauling_into_bed') {
    // Hauling torso over tailgate and planting boots inside truck bed
    const subP = minimumJerkEase((boardingProgress - 0.72) / 0.28);
    worldX = tailgateX + 0.08 + subP * 0.68;
    worldZ = tailgateZ;
    worldY = truckBedFloorY * subP + 0.48 * (1 - subP) + truckWorldPos.y;
    pelvisOffsetY = -0.18 * (1 - subP);
    torsoPitchRad = 0.35 * (1 - subP) + 0.08;
    facingYawRad = subP * 0.35; // Turns to look out from truck bed
    leftShoulderPitch = 0.65 - subP * 0.4;
    rightShoulderPitch = 0.85 - subP * 0.3;
    leftElbowFlex = 0.95;
    rightElbowFlex = 1.1;
    leftHipPitch = -0.35 * (1 - subP);
    rightHipPitch = -0.25 * (1 - subP);
    leftKneeFlex = 0.5 * (1 - subP) + 0.15;
    rightKneeFlex = 0.45 * (1 - subP) + 0.15;
    handContactWorldPos = {
      x: tailgateX + 0.15,
      y: tailgateGrabY,
      z: tailgateZ,
    };
  } else if (boardingPhase === 'combat_cover_stance') {
    // Tactical kneeling / cover firing stance behind stone wall / trench
    worldX = worldDistanceX - 0.65;
    worldZ = 1.25;
    pelvisOffsetY = -0.26;
    torsoPitchRad = 0.24;
    facingYawRad = 0.12;
    leftHipPitch = -0.82;
    leftKneeFlex = 1.18;
    rightHipPitch = 0.42;
    rightKneeFlex = 0.92;
    // Rifle shouldered and aimed forward
    rightShoulderPitch = 1.12;
    rightElbowFlex = 1.25;
    leftShoulderPitch = 1.05;
    leftShoulderYaw = -0.38;
    leftElbowFlex = 0.72;

    // Periodic rifle firing bursts with physical recoil kick
    const burstWave = Math.sin(timeSec * 14);
    if (burstWave > 0.62) {
      muzzleFlashIntensity = (burstWave - 0.62) / 0.38;
      torsoPitchRad -= muzzleFlashIntensity * 0.14;
      rightShoulderPitch += muzzleFlashIntensity * 0.12;
    }
  }

  // Apply physical blast knockback and defensive shielding if an explosion shockwave hits
  if (explosion.characterShieldingFace && !isSecondary) {
    worldX += explosion.characterKnockbackX;
    torsoPitchRad += explosion.characterRecoilPitch;
    pelvisOffsetY -= 0.22;
    // Left arm raises across face to shield against flying shrapnel
    leftShoulderPitch = 1.48;
    leftShoulderYaw = -0.55;
    leftElbowFlex = 1.35;
  }

  // Prosodic speech jaw & expressive brow acting
  const prosody = getProsodicSpeechEnvelope(scene.narration || '', p, wpm);
  const jawOpenAmount = isSecondary
    ? 0.05
    : prosody.syllablePulse * (0.55 + prosody.emphasisBoost * 0.45);

  const browFurrow =
    explosion.isDetonating || boardingPhase === 'combat_cover_stance'
      ? 0.85
      : scene.character1.expression === 'shocked'
      ? -0.85
      : 0.45;

  // Natural blinking every ~3.4 seconds
  const blinkCycle = (timeSec + (isSecondary ? 1.2 : 0)) % 3.4;
  const eyeBlink = blinkCycle > 3.26 ? Math.sin(((blinkCycle - 3.26) / 0.14) * Math.PI) : 0;

  const headPitchRad =
    -torsoPitchRad * 0.45 +
    organicPerlin1D(timeSec * 1.6, 23) * 0.12 +
    prosody.syllablePulse * 0.18;
  // Angle head slightly toward the camera (+Z) so eyes, brows, and prosodic jaw acting read clearly
  const headYawRad =
    -0.52 +
    organicPerlin1D(timeSec * 1.1, 41) * 0.22 +
    (explosion.isDetonating ? -0.28 : 0);

  return {
    worldPos: { x: worldX, y: worldY, z: worldZ },
    facingYawRad,
    torsoPitchRad,
    torsoRollRad,
    spineTwistYawRad,
    pelvisOffsetY,
    headPitchRad,
    headYawRad,
    jawOpenAmount,
    browFurrow,
    eyeBlink,
    leftShoulder: {
      pitch: leftShoulderPitch,
      roll: leftShoulderRoll,
      yaw: leftShoulderYaw,
    },
    leftElbowFlex,
    rightShoulder: {
      pitch: rightShoulderPitch,
      roll: rightShoulderRoll,
      yaw: rightShoulderYaw,
    },
    rightElbowFlex,
    leftHip: { pitch: leftHipPitch, roll: -0.06 },
    leftKneeFlex,
    leftAnklePitch,
    rightHip: { pitch: rightHipPitch, roll: 0.06 },
    rightKneeFlex,
    rightAnklePitch,
    boardingPhase,
    boardingProgress,
    handContactWorldPos,
    muzzleFlashIntensity,
    footstrikeImpulse,
  };
}

/**
 * Multi-Camera Shot Director:
 * Replaces the static lateral 2D view with dynamic 3D cinematography cuts and camera moves
 * synchronized to dramatic beats, explosions, close-up acting, and vehicle boarding.
 */
export function resolveCinematicShotAtBeat(
  scene: StickmanScene,
  sceneProgress: number,
  heroRig: Stickman3DRigPose,
  truckWorldPos: { x: number; y: number; z: number },
  explosion: ExplosionPhysicsState3D,
  cameraOverride: CinematicShotType | 'auto' = 'auto'
): CameraShotDirective {
  const p = Math.max(0, Math.min(1, sceneProgress));
  const timeSec = p * Math.max(2, scene.duration || 5);

  // Automatic 4-cut cinematic editing sequence per scene (unless overridden by user or immediate blast)
  let shotType: CinematicShotType;
  let cutIndex = 0;
  let shotProgress = 0;

  if (cameraOverride !== 'auto') {
    shotType = cameraOverride;
    shotProgress = p;
  } else if (
    explosion.isDetonating &&
    explosion.blastWaveProgress > 0.01 &&
    explosion.blastWaveProgress < 0.48
  ) {
    shotType = 'dutch_impact_blast';
    cutIndex = 2;
    shotProgress = explosion.blastWaveProgress / 0.48;
  } else if (
    heroRig.boardingPhase === 'crouch_anticipation' ||
    heroRig.boardingPhase === 'leaping_tailgate_grab' ||
    heroRig.boardingPhase === 'hauling_into_bed'
  ) {
    shotType = 'tailgate_action_mount';
    cutIndex = 3;
    shotProgress = heroRig.boardingProgress;
  } else if (p < 0.24) {
    shotType = 'low_angle_tracking';
    cutIndex = 0;
    shotProgress = p / 0.24;
  } else if (p < 0.52) {
    shotType = 'close_up_emotion';
    cutIndex = 1;
    shotProgress = (p - 0.24) / 0.28;
  } else if (p < 0.78) {
    shotType = 'over_the_shoulder';
    cutIndex = 2;
    shotProgress = (p - 0.52) / 0.26;
  } else {
    shotType = 'crane_establishing';
    cutIndex = 3;
    shotProgress = (p - 0.78) / 0.22;
  }

  const hx = heroRig.worldPos.x;
  const hy = heroRig.worldPos.y + heroRig.pelvisOffsetY;
  const hz = heroRig.worldPos.z;

  // Handheld organic camera breathing
  const handheldX = organicPerlin1D(timeSec * 2.1, 101) * 0.08;
  const handheldY = organicPerlin1D(timeSec * 2.6, 202) * 0.06;

  // Trauma shake from explosion or heavy footstrike
  const blastTrauma = explosion.isDetonating
    ? Math.pow(Math.max(0, 1 - explosion.blastWaveProgress * 1.4), 2) * 0.85
    : 0;
  const traumaShake = Math.min(1, blastTrauma + heroRig.footstrikeImpulse * 0.12);
  const shakeOffsetX = Math.sin(timeSec * 47) * traumaShake * 0.28;
  const shakeOffsetY = Math.cos(timeSec * 53) * traumaShake * 0.22;

  switch (shotType) {
    case 'low_angle_tracking': {
      // Dynamic low-angle tracking right beside the mud-churning tires & sprinting boots
      const dollyX = (shotProgress - 0.5) * 1.1;
      return {
        shotType,
        shotLabel: 'PLANO BAIXO TRACKING (35mm Hero)',
        lensMm: 35,
        fov: 46,
        cameraPos: {
          x: hx + 1.35 + dollyX + handheldX + shakeOffsetX,
          y: Math.max(0.45, hy + 0.72 + handheldY + shakeOffsetY),
          z: hz + 3.15,
        },
        lookAtTarget: {
          x: hx - 0.35,
          y: hy + 1.25,
          z: hz - 0.65,
        },
        dutchRollRad: -0.04 + traumaShake * 0.08,
        traumaShake,
        cutIndex,
        shotProgress,
      };
    }

    case 'close_up_emotion': {
      // Tight 85mm medium-close-up framing full M1 helmet, eyes, prosodic jaw, and rifle discipline
      const pushInZ = (1 - minimumJerkEase(shotProgress)) * 0.35;
      return {
        shotType,
        shotLabel: 'CLOSE-UP DRAMÁTICO (85mm Atuação)',
        lensMm: 85,
        fov: 32,
        cameraPos: {
          x: hx + 1.35 + handheldX * 0.5 + shakeOffsetX * 0.5,
          y: hy + 1.56 + handheldY * 0.5 + shakeOffsetY * 0.5,
          z: hz + 2.35 + pushInZ,
        },
        lookAtTarget: {
          x: hx + 0.08,
          y: hy + 1.46,
          z: hz,
        },
        dutchRollRad: 0.02,
        traumaShake,
        cutIndex,
        shotProgress,
      };
    }

    case 'over_the_shoulder': {
      // 50mm Over-The-Shoulder looking past the soldier toward the convoy & bunker objective ahead
      return {
        shotType,
        shotLabel: 'OVER-THE-SHOULDER TÁTICO (50mm)',
        lensMm: 50,
        fov: 38,
        cameraPos: {
          x: hx - 1.75 + handheldX + shakeOffsetX,
          y: hy + 1.82 + handheldY + shakeOffsetY,
          z: hz + 1.25,
        },
        lookAtTarget: {
          x: truckWorldPos.x + 2.8,
          y: truckWorldPos.y + 1.35,
          z: truckWorldPos.z - 0.4,
        },
        dutchRollRad: -0.03,
        traumaShake,
        cutIndex,
        shotProgress,
      };
    }

    case 'dutch_impact_blast': {
      // Wide 24mm Dutch-angle impact shot capturing the explosion shockwave, flying crates, and soldier knockback
      const fovKick = traumaShake * 11;
      return {
        shotType,
        shotLabel: 'IMPACTO DE ARTILHARIA (24mm Dutch)',
        lensMm: 24,
        fov: 56 + fovKick,
        cameraPos: {
          x: hx - 1.1 + shakeOffsetX * 1.4,
          y: Math.max(0.55, hy + 1.15 + shakeOffsetY * 1.4),
          z: hz + 4.25,
        },
        lookAtTarget: {
          x: (hx + explosion.epicenter.x) * 0.5,
          y: hy + 1.15,
          z: (hz + explosion.epicenter.z) * 0.5,
        },
        dutchRollRad: 0.14 * Math.cos(timeSec * 18) + 0.09,
        traumaShake,
        cutIndex,
        shotProgress,
      };
    }

    case 'tailgate_action_mount': {
      // Rear-quarter action camera tracking the soldier grabbing the tailgate and vaulting into the truck bed
      return {
        shotType,
        shotLabel: 'EMBARQUE NA CARROCERIA (40mm Action)',
        lensMm: 40,
        fov: 42,
        cameraPos: {
          x: truckWorldPos.x - 4.45 + shotProgress * 0.85 + handheldX,
          y: truckWorldPos.y + 1.55 + shotProgress * 0.35 + handheldY,
          z: truckWorldPos.z + 2.65 - shotProgress * 0.45,
        },
        lookAtTarget: {
          x: truckWorldPos.x - 2.1,
          y: truckWorldPos.y + 1.35,
          z: truckWorldPos.z,
        },
        dutchRollRad: -0.05 * (1 - shotProgress),
        traumaShake,
        cutIndex,
        shotProgress,
      };
    }

    case 'crane_establishing':
    default: {
      // Sweeping 3D crane shot showing the convoy, soldier, ruined village, and mountain depth
      const sweepArc = (shotProgress - 0.5) * 2.4;
      return {
        shotType: 'crane_establishing',
        shotLabel: 'GRUA CINEMATOGRÁFICA (28mm Panorama 3D)',
        lensMm: 28,
        fov: 50,
        cameraPos: {
          x: hx - 2.4 + sweepArc + handheldX,
          y: hy + 2.85 + shotProgress * 0.95 + handheldY,
          z: hz + 5.6,
        },
        lookAtTarget: {
          x: truckWorldPos.x - 0.4,
          y: truckWorldPos.y + 1.25,
          z: truckWorldPos.z,
        },
        dutchRollRad: 0,
        traumaShake,
        cutIndex,
        shotProgress,
      };
    }
  }
}

/**
 * Evaluates the entire 3D World Stage state for a given scene and normalized progress [0..1].
 * 100% deterministic function of (scene, sceneProgress, sceneIndex).
 */
export function evaluateWorldStageFrame3D(
  scene: StickmanScene,
  sceneProgress: number,
  sceneIndex: number = 0,
  cameraOverride: CinematicShotType | 'auto' = 'auto',
  wpm: number = 155
): WorldStageFrame3D {
  const p = Math.max(0, Math.min(1, sceneProgress));
  // Advance continuously through the 3D world across scenes so the environment transforms!
  const baseSceneDistance = sceneIndex * 22;
  const worldDistanceX = baseSceneDistance + p * 18;

  const zoneIndex = Math.min(2, Math.floor(worldDistanceX / 20));
  const zoneNames = [
    'Zona 1: Estrada de Lama & Floresta de Pinheiros',
    'Zona 2: Vila Italiana Bombardeada & Bunker',
    'Zona 3: Crista de Monte Castello & Trincheira Avançada',
  ];
  const zoneName = zoneNames[zoneIndex] || zoneNames[0];

  // 3D Truck world coordinates with uneven terrain suspension pitch/roll
  const terrainWave1 = Math.sin(worldDistanceX * 0.85);
  const terrainWave2 = Math.cos(worldDistanceX * 1.45);
  const truckChassisBounceY = Math.max(-0.08, terrainWave1 * 0.06 + terrainWave2 * 0.04);
  const truckPitchRad = terrainWave1 * 0.045;
  const truckRollRad = terrainWave2 * 0.035;

  const truckWorldPos = {
    x: worldDistanceX + 0.8,
    y: truckChassisBounceY,
    z: -0.25,
  };

  // Wheel rotation matches forward distance traveled (radius = 0.52m)
  const wheelSpinRad = -(worldDistanceX / 0.52);

  // Estimate hero X before blast knockback
  const estimatedHeroX = truckWorldPos.x - 1.35;
  const explosion = computeExplosionPhysicsState(
    scene,
    p,
    worldDistanceX,
    estimatedHeroX
  );

  const heroRig = compute3DStickmanRigPose(
    scene,
    p,
    worldDistanceX,
    truckWorldPos,
    explosion,
    false,
    wpm
  );

  const secondaryRig = scene.character2
    ? compute3DStickmanRigPose(
        scene,
        p,
        worldDistanceX,
        truckWorldPos,
        explosion,
        true,
        wpm
      )
    : null;

  const shot = resolveCinematicShotAtBeat(
    scene,
    p,
    heroRig,
    truckWorldPos,
    explosion,
    cameraOverride
  );

  return {
    worldDistanceX,
    zoneIndex,
    zoneName,
    truckWorldPos,
    truckPitchRad,
    truckRollRad,
    truckChassisBounceY,
    wheelSpinRad,
    heroRig,
    secondaryRig,
    explosion,
    shot,
  };
}
