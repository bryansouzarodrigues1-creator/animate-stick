import {
  StickmanScene,
  SceneCharacter,
  StickmanAction,
} from '../types/stickman';
import { ActiveBeatFrameState } from './choreographyEngine';
import {
  BiomechanicalHumanPose,
  minimumJerkEase,
  organicPerlin1D,
  solveTwoBoneIK,
} from './stickmanMath';

export interface WorldCameraState {
  worldScrollX: number; // Continuous world distance travelled (px)
  trackingOffsetX: number;
  trackingOffsetY: number;
  dynamicZoom: number;
  rollAngleRad: number;
  shockwaveShakeX: number;
  shockwaveShakeY: number;
}

export interface VolumetricTruckState {
  active: boolean;
  screenX: number;
  groundY: number;
  scale: number;
  velocityPxPerSec: number;
  chassisPitchRad: number;
  chassisBounceY: number;
  wheelSpinRad: number;
  axleSuspensionY: [number, number, number]; // rear, mid, front axles
  headlightsOn: boolean;
  braking: boolean;
  tailgateOpen: boolean;
  // Physical world-space anchors for soldier interaction
  sideRunAnchor: { x: number; y: number };
  wheelCoverAnchor: { x: number; y: number };
  tailgateBoardAnchor: { x: number; y: number };
}

export interface StageStructureEntity {
  id: string;
  kind: 'stone_ruin_wall' | 'sandbag_bunker' | 'artillery_crater' | 'milepost_monte_castello';
  screenX: number;
  groundY: number;
  width: number;
  height: number;
  depthExtrusionPx: number;
  damageLevel: number; // [0..1]
  coverAnchor: { x: number; y: number };
}

export interface StageExplosionEvent {
  id: string;
  screenX: number;
  groundY: number;
  ageNorm: number; // [0..1]
  intensity: number;
  shockwaveRadius: number;
  lightRadius: number;
}

export interface ConstructedWorldStage {
  isConstructedWarWorld: boolean;
  camera: WorldCameraState;
  groundY: number;
  truck: VolumetricTruckState;
  structures: StageStructureEntity[];
  explosions: StageExplosionEvent[];
  dynamicLight: {
    active: boolean;
    x: number;
    y: number;
    color: string;
    intensity: number;
  };
  soldierOverride: {
    active: boolean;
    screenX: number;
    groundY: number;
    flipX: boolean;
    facingCos: number;
    isFiringRifle: boolean;
    isBoardingTruck: boolean;
    isCrouchingCover: boolean;
    handIKTargetWorld?: {
      x: number;
      y: number;
      blend: number;
      hand: 'left' | 'right';
    };
  };
}

/**
 * Determines whether a scene should activate the full 2.5D World-Space Constructor
 * (e.g., WWII Battlefield, military truck convoy, soldier running alongside truck, trench assault).
 */
export function isWorldConstructorScene(scene: StickmanScene): boolean {
  if (scene.environment === 'ww2_battlefield') return true;
  const act = scene.character1.action;
  if (
    act === 'truck_run_alongside' ||
    act === 'trench_cover_fire' ||
    act === 'truck_board_convoy'
  ) {
    return true;
  }
  const text = `${scene.title} ${scene.narration} ${(scene.scenePlan?.objectRefs || []).join(' ')}`.toLowerCase();
  return /caminh[aã]o|soldado|guerra|trincheira|monte castello|feb|comboio|artilharia|batalha|pelot[aã]o|fuzil/.test(
    text
  );
}

/**
 * Evaluates road surface elevation & crater dips at a given world X coordinate
 * so truck tires and soldier boots physically follow terrain undulation.
 */
export function sampleTerrainElevationOffset(worldX: number, seed: number = 101): number {
  const craterWave = Math.sin(worldX * 0.018 + seed * 0.1) * Math.cos(worldX * 0.007);
  const dip = craterWave > 0.65 ? (craterWave - 0.65) * 22 : 0;
  const microRoughness = organicPerlin1D(worldX * 0.04, seed) * 2.2;
  return dip + microRoughness;
}

/**
 * Builds the complete 2.5D Volumetric World Stage for the current frame.
 * Pure deterministic function of (scene, beatState, sceneProgress, width, height).
 */
export function constructWorldStage(
  scene: StickmanScene,
  beatState: ActiveBeatFrameState,
  sceneProgress: number,
  width: number,
  height: number
): ConstructedWorldStage {
  const isWarWorld = isWorldConstructorScene(scene);
  const groundY = height * 0.74;
  const sec = beatState.elapsedInSceneSec;
  const seed = beatState.seed || scene.seed || 1945;

  if (!isWarWorld) {
    return {
      isConstructedWarWorld: false,
      camera: {
        worldScrollX: sec * 60,
        trackingOffsetX: 0,
        trackingOffsetY: 0,
        dynamicZoom: 1,
        rollAngleRad: 0,
        shockwaveShakeX: 0,
        shockwaveShakeY: 0,
      },
      groundY: height * 0.72,
      truck: {
        active: false,
        screenX: 0,
        groundY: height * 0.72,
        scale: 1,
        velocityPxPerSec: 0,
        chassisPitchRad: 0,
        chassisBounceY: 0,
        wheelSpinRad: 0,
        axleSuspensionY: [0, 0, 0],
        headlightsOn: false,
        braking: false,
        tailgateOpen: false,
        sideRunAnchor: { x: 0, y: 0 },
        wheelCoverAnchor: { x: 0, y: 0 },
        tailgateBoardAnchor: { x: 0, y: 0 },
      },
      structures: [],
      explosions: [],
      dynamicLight: {
        active: false,
        x: width * 0.5,
        y: height * 0.3,
        color: '#F97316',
        intensity: 0,
      },
      soldierOverride: {
        active: false,
        screenX: width * beatState.char1XNorm,
        groundY: height * 0.72,
        flipX: beatState.flipChar1,
        facingCos: beatState.facingCos1,
        isFiringRifle: false,
        isBoardingTruck: false,
        isCrouchingCover: false,
      },
    };
  }

  // Determine the dramatic stage mode from the active action or scene narrative
  const act: StickmanAction = beatState.effectiveAction1;
  const isBrakingCover =
    act === 'trench_cover_fire' ||
    act === 'gun_aim' ||
    act === 'zombie_survive_barricade';
  const isBoardingClimax = act === 'truck_board_convoy';

  // 1. World-Space Travelling Scroll (Truck & Soldier advancing across battlefield)
  const baseSpeedPxPerSec = isBrakingCover
    ? Math.max(18, 130 * (1 - minimumJerkEase(Math.min(1, sceneProgress * 1.8))))
    : isBoardingClimax
    ? 145 + sceneProgress * 65
    : 158;

  const worldScrollX =
    sec * baseSpeedPxPerSec +
    (beatState.beatIndex * 45 + minimumJerkEase(beatState.beatProgress) * 35);

  // 2. Artillery Explosions & Ballistic Shockwaves
  const explosions: StageExplosionEvent[] = [];
  const blastConfigs = [
    { triggerSec: 0.85, duration: 1.55, relX: 0.76, intensity: 0.92 },
    { triggerSec: 2.35, duration: 1.65, relX: 0.24, intensity: 1.0 },
    { triggerSec: 3.85, duration: 1.5, relX: 0.68, intensity: 0.88 },
  ];

  let shockwaveShakeX = 0;
  let shockwaveShakeY = 0;
  let strongestBlast: StageExplosionEvent | null = null;

  for (let i = 0; i < blastConfigs.length; i++) {
    const cfg = blastConfigs[i];
    const dt = sec - cfg.triggerSec;
    if (dt >= 0 && dt <= cfg.duration) {
      const ageNorm = dt / cfg.duration;
      const blastScreenX = width * cfg.relX - (dt * baseSpeedPxPerSec * 0.22);
      const shockwaveRadius = ageNorm * 240 * cfg.intensity;
      const ev: StageExplosionEvent = {
        id: `blast_${i}`,
        screenX: blastScreenX,
        groundY: groundY - 6,
        ageNorm,
        intensity: cfg.intensity,
        shockwaveRadius,
        lightRadius: (1 - ageNorm) * 320 * cfg.intensity,
      };
      explosions.push(ev);

      if (!strongestBlast || (1 - ageNorm) * cfg.intensity > (1 - strongestBlast.ageNorm) * strongestBlast.intensity) {
        strongestBlast = ev;
      }

      // Physical camera shockwave impulse when shell detonates
      const shockDecay = Math.pow(1 - ageNorm, 2.2) * cfg.intensity;
      shockwaveShakeX += Math.sin(dt * 52 + i * 3) * 7.5 * shockDecay;
      shockwaveShakeY += Math.cos(dt * 44 + i * 2) * 5.5 * shockDecay;
    }
  }

  // 3. Volumetric 2.5D Military Truck Kinematics & Terrain-Following Suspension
  const truckBaseNormX = isBrakingCover
    ? 0.44 - minimumJerkEase(sceneProgress) * 0.04
    : isBoardingClimax
    ? 0.46 + minimumJerkEase(sceneProgress) * 0.12
    : 0.43 + Math.sin(sec * 0.85) * 0.035;

  const truckScreenX = width * truckBaseNormX;
  const rearAxleWorldX = worldScrollX + truckScreenX - 95;
  const midAxleWorldX = worldScrollX + truckScreenX - 42;
  const frontAxleWorldX = worldScrollX + truckScreenX + 82;

  const suspRear = sampleTerrainElevationOffset(rearAxleWorldX, seed);
  const suspMid = sampleTerrainElevationOffset(midAxleWorldX, seed + 7);
  const suspFront = sampleTerrainElevationOffset(frontAxleWorldX, seed + 13);

  const brakeNoseDive = isBrakingCover
    ? Math.sin(Math.min(1, sceneProgress * 2.2) * Math.PI) * 0.045
    : 0;
  const accelSquat = isBoardingClimax ? -0.028 : -0.012;
  const terrainPitch = (suspFront - suspRear) * 0.0018;
  const chassisPitchRad = terrainPitch + brakeNoseDive + accelSquat;
  const chassisBounceY =
    (suspRear + suspMid + suspFront) / 3 +
    organicPerlin1D(sec * 4.2, seed + 31) * 2.2;

  const wheelRadius = 26;
  const wheelSpinRad = (worldScrollX / wheelRadius) % (Math.PI * 2);

  const sideRunAnchor = {
    x: truckScreenX + 18,
    y: groundY + 12,
  };
  const wheelCoverAnchor = {
    x: truckScreenX + 74,
    y: groundY - 38 + chassisBounceY,
  };
  const tailgateBoardAnchor = {
    x: truckScreenX - 134,
    y: groundY - 46 + chassisBounceY,
  };

  const truck: VolumetricTruckState = {
    active: true,
    screenX: truckScreenX,
    groundY,
    scale: 1.0,
    velocityPxPerSec: baseSpeedPxPerSec,
    chassisPitchRad,
    chassisBounceY,
    wheelSpinRad,
    axleSuspensionY: [suspRear, suspMid, suspFront],
    headlightsOn: true,
    braking: isBrakingCover,
    tailgateOpen: isBoardingClimax,
    sideRunAnchor,
    wheelCoverAnchor,
    tailgateBoardAnchor,
  };

  // 4. World-Space 2.5D Structures (Ruined Stone Walls, Sandbag Bunkers, Craters, Mileposts)
  const structureSpacing = 540;
  const baseStructIndex = Math.floor(worldScrollX / structureSpacing);
  const structures: StageStructureEntity[] = [];

  for (let offset = -1; offset <= 2; offset++) {
    const idx = baseStructIndex + offset;
    const worldX = idx * structureSpacing + 280;
    const screenX = worldX - (worldScrollX % structureSpacing) + offset * structureSpacing - (baseStructIndex * structureSpacing) + (baseStructIndex * structureSpacing);
    // Clean cyclic world-to-screen mapping
    const cyclicScreenX = ((worldX - worldScrollX * 0.92) % (width * 1.45) + width * 1.45) % (width * 1.45) - width * 0.22;

    const kindMod = Math.abs(idx) % 3;
    const kind: StageStructureEntity['kind'] =
      kindMod === 0
        ? 'sandbag_bunker'
        : kindMod === 1
        ? 'stone_ruin_wall'
        : 'milepost_monte_castello';

    structures.push({
      id: `struct_${idx}`,
      kind,
      screenX: cyclicScreenX,
      groundY: groundY + 6,
      width: kind === 'stone_ruin_wall' ? 96 : kind === 'sandbag_bunker' ? 84 : 36,
      height: kind === 'stone_ruin_wall' ? 82 : kind === 'sandbag_bunker' ? 42 : 54,
      depthExtrusionPx: 18,
      damageLevel: 0.35 + ((Math.abs(idx * 37) % 50) / 100),
      coverAnchor: {
        x: cyclicScreenX - 18,
        y: groundY - 32,
      },
    });
  }

  // 5. Soldier Choreographed Interaction with the Truck, Road, and Cover
  let soldierX = width * beatState.char1XNorm;
  let soldierY = groundY + 10 + beatState.jumpOffsetY;
  let flipX = beatState.flipChar1;
  let facingCos = beatState.facingCos1;
  let isFiringRifle = false;
  let isBoardingTruck = false;
  let isCrouchingCover = false;
  let handIKTargetWorld: ConstructedWorldStage['soldierOverride']['handIKTargetWorld'];

  if (isBrakingCover) {
    // Soldier takes tactical cover right beside the truck's armored front fender / wheel arch,
    // turns to scan/check the rear during beat 1, then aims & fires forward in beats 2-3!
    const coverTargetX = truck.wheelCoverAnchor.x - 16 + Math.sin(sec * 1.4) * 8;
    soldierX = coverTargetX;
    soldierY = groundY + 8;
    isCrouchingCover = true;
    isFiringRifle = beatState.beatIndex % 2 === 0 || beatState.beatProgress > 0.35;

    // Brief tactical glance back in middle beat, otherwise facing forward toward enemy line
    const lookBackWindow = beatState.beatIndex === 1 && beatState.beatProgress < 0.48;
    flipX = lookBackWindow;
    facingCos = lookBackWindow
      ? -minimumJerkEase(Math.min(1, beatState.beatProgress * 3))
      : minimumJerkEase(Math.min(1, beatState.beatProgress * 2.5));

    // Left hand braces physically on the truck's fender when glancing/reloading
    if (!isFiringRifle) {
      handIKTargetWorld = {
        x: truck.wheelCoverAnchor.x,
        y: truck.wheelCoverAnchor.y,
        blend: 0.78,
        hand: 'left',
      };
    }
  } else if (isBoardingClimax) {
    // Soldier sprints from behind the truck to the tailgate, grabs the tailgate bar via IK, and mounts the convoy!
    const climbPhase = minimumJerkEase(Math.max(0, Math.min(1, (sceneProgress - 0.32) / 0.55)));
    const runApproachX = truck.tailgateBoardAnchor.x - 48 * (1 - climbPhase);
    soldierX = runApproachX;
    soldierY =
      groundY +
      8 -
      climbPhase * 34 -
      Math.sin(climbPhase * Math.PI) * 16;
    flipX = false;
    facingCos = 1;
    isBoardingTruck = climbPhase > 0.15;

    handIKTargetWorld = {
      x: truck.tailgateBoardAnchor.x + 8,
      y: truck.tailgateBoardAnchor.y,
      blend: Math.min(0.9, climbPhase * 1.25),
      hand: 'left',
    };
  } else {
    // Soldier sprints alongside the moving military truck in the foreground lane,
    // dodging craters, turning briefly to check the truck cab/convoy, and surging ahead!
    const relativeOffset =
      Math.sin(sec * 1.15) * 46 + (beatState.char1XNorm - 0.5) * 75;
    soldierX = truck.sideRunAnchor.x + relativeOffset;
    const footTerrainDip = sampleTerrainElevationOffset(worldScrollX + soldierX, seed + 19) * 0.45;
    soldierY = groundY + 11 + footTerrainDip + beatState.jumpOffsetY;

    // Natural head/torso check toward the truck cab during specific beat windows while running forward
    const checkConvoyTurn =
      beatState.beatIndex === 1 &&
      beatState.beatProgress > 0.25 &&
      beatState.beatProgress < 0.62;
    if (checkConvoyTurn) {
      const turnPulse = Math.sin(((beatState.beatProgress - 0.25) / 0.37) * Math.PI);
      facingCos = 1 - turnPulse * 0.58; // 3/4 foreshortened glance toward camera/truck
    } else {
      facingCos = 1;
    }
    flipX = false;
    isFiringRifle = beatState.maneuver === 'combat_combo_rush';

    // When running close to the truck cab door, left hand briefly touches/steadies against the truck bed rail
    if (Math.abs(relativeOffset) < 22) {
      handIKTargetWorld = {
        x: truck.screenX + 12,
        y: groundY - 42 + chassisBounceY,
        blend: 0.45,
        hand: 'left',
      };
    }
  }

  // 6. Dynamic Travelling Camera Tracking (follows midpoint of Truck + Soldier with organic handheld breath)
  const focusMidX = (truckScreenX * 0.45 + soldierX * 0.55) - width * 0.48;
  const handheldSwayX = organicPerlin1D(sec * 1.6, seed + 71) * 5.5;
  const handheldSwayY = organicPerlin1D(sec * 2.1, seed + 89) * 3.8;

  const trackingOffsetX = -focusMidX * 0.35 + handheldSwayX + shockwaveShakeX;
  const trackingOffsetY = handheldSwayY + shockwaveShakeY;
  const dynamicZoom =
    1.03 +
    (isBrakingCover ? 0.06 : isBoardingClimax ? 0.08 : 0.02) +
    (strongestBlast ? (1 - strongestBlast.ageNorm) * 0.035 : 0);
  const rollAngleRad =
    organicPerlin1D(sec * 1.2, seed + 43) * 0.008 +
    shockwaveShakeX * 0.0012;

  const dynamicLight = strongestBlast
    ? {
        active: true,
        x: strongestBlast.screenX,
        y: strongestBlast.groundY - 40,
        color: '#FB923C',
        intensity: Math.max(0, (1 - strongestBlast.ageNorm) * strongestBlast.intensity),
      }
    : {
        active: true,
        x: truckScreenX + 190,
        y: groundY - 28,
        color: '#FDE047',
        intensity: 0.42,
      };

  return {
    isConstructedWarWorld: true,
    camera: {
      worldScrollX,
      trackingOffsetX,
      trackingOffsetY,
      dynamicZoom,
      rollAngleRad,
      shockwaveShakeX,
      shockwaveShakeY,
    },
    groundY,
    truck,
    structures,
    explosions,
    dynamicLight,
    soldierOverride: {
      active: true,
      screenX: soldierX,
      groundY: soldierY,
      flipX,
      facingCos,
      isFiringRifle,
      isBoardingTruck,
      isCrouchingCover,
      handIKTargetWorld,
    },
  };
}

/**
 * Renders the multi-plane 2.5D parallax battlefield environment, perspective road,
 * craters, ruined stone structures, sandbag bunkers, and distant artillery horizon.
 */
export function renderConstructedWorldBackground(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  stage: ConstructedWorldStage,
  sceneProgress: number,
  elapsedSec: number
) {
  const { groundY, camera, structures, explosions } = stage;
  const scroll = camera.worldScrollX;

  ctx.save();

  // 1. Stormy Overcast War Sky with Artillery Horizon Glow (Monte Castello 1945)
  const skyGrad = ctx.createLinearGradient(0, 0, 0, groundY);
  skyGrad.addColorStop(0, '#0F172A');
  skyGrad.addColorStop(0.42, '#1E293B');
  skyGrad.addColorStop(0.78, '#334155');
  skyGrad.addColorStop(1, '#475569');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, width, groundY);

  // Distant artillery horizon glow pulsing in the clouds
  const horizonPulse = 0.22 + Math.abs(Math.sin(elapsedSec * 1.9)) * 0.16;
  const horizonGlow = ctx.createRadialGradient(
    width * 0.68,
    groundY - 35,
    15,
    width * 0.68,
    groundY - 35,
    width * 0.55
  );
  horizonGlow.addColorStop(0, `rgba(249, 115, 22, ${horizonPulse})`);
  horizonGlow.addColorStop(0.5, `rgba(234, 88, 12, ${horizonPulse * 0.45})`);
  horizonGlow.addColorStop(1, 'rgba(15, 23, 42, 0)');
  ctx.fillStyle = horizonGlow;
  ctx.fillRect(0, 0, width, groundY);

  // 2. Parallax Layer Z = 0.12: Apennine Mountain Ridge (Monte Castello)
  ctx.fillStyle = '#1E293B';
  ctx.beginPath();
  ctx.moveTo(0, groundY);
  for (let x = 0; x <= width + 40; x += 40) {
    const wx = x + scroll * 0.12;
    const ridgeH =
      95 +
      Math.sin(wx * 0.0045) * 42 +
      Math.cos(wx * 0.011) * 24;
    ctx.lineTo(x, groundY - ridgeH);
  }
  ctx.lineTo(width, groundY);
  ctx.closePath();
  ctx.fill();

  // Anti-aircraft searchlights & distant tracer streaks in the sky
  ctx.save();
  for (let b = 0; b < 2; b++) {
    const baseBx = width * (0.28 + b * 0.46) - ((scroll * 0.08) % 160);
    const swayAngle = -0.35 + Math.sin(elapsedSec * 0.7 + b * 2) * 0.28;
    ctx.save();
    ctx.translate(baseBx, groundY - 65);
    ctx.rotate(swayAngle);
    const beamGrad = ctx.createLinearGradient(0, 0, 0, -height * 0.75);
    beamGrad.addColorStop(0, 'rgba(254, 240, 138, 0.18)');
    beamGrad.addColorStop(1, 'rgba(254, 240, 138, 0)');
    ctx.fillStyle = beamGrad;
    ctx.beginPath();
    ctx.moveTo(-6, 0);
    ctx.lineTo(-48, -height * 0.75);
    ctx.lineTo(48, -height * 0.75);
    ctx.lineTo(6, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();

  // 3. Parallax Layer Z = 0.35: Bombed Italian Village Silhouettes, Ruined Bell Tower & Burnt Trees
  const midSpan = 420;
  for (let m = -1; m <= 3; m++) {
    const rawX = m * midSpan - ((scroll * 0.35) % midSpan);
    // Ruined stone building with 2.5D side wall depth
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(rawX + 40, groundY - 92, 68, 92);
    // 2.5D extruded side wall
    ctx.fillStyle = '#1E293B';
    ctx.beginPath();
    ctx.moveTo(rawX + 108, groundY - 92);
    ctx.lineTo(rawX + 124, groundY - 82);
    ctx.lineTo(rawX + 124, groundY);
    ctx.lineTo(rawX + 108, groundY);
    ctx.closePath();
    ctx.fill();

    // Jagged bombed roof silhouette
    ctx.fillStyle = '#0F172A';
    ctx.beginPath();
    ctx.moveTo(rawX + 40, groundY - 92);
    ctx.lineTo(rawX + 56, groundY - 114);
    ctx.lineTo(rawX + 74, groundY - 96);
    ctx.lineTo(rawX + 95, groundY - 108);
    ctx.lineTo(rawX + 108, groundY - 92);
    ctx.closePath();
    ctx.fill();

    //Glowing fire inside bombed window
    const flicker = 0.55 + Math.sin(elapsedSec * 9 + m) * 0.2;
    ctx.fillStyle = `rgba(249, 115, 22, ${flicker})`;
    ctx.fillRect(rawX + 58, groundY - 68, 12, 18);
    ctx.fillRect(rawX + 82, groundY - 68, 12, 18);

    // Scorched winter pine tree
    const treeX = rawX + 230;
    ctx.strokeStyle = '#1E293B';
    ctx.lineWidth = 4.5;
    ctx.beginPath();
    ctx.moveTo(treeX, groundY);
    ctx.lineTo(treeX + 4, groundY - 78);
    ctx.moveTo(treeX + 2, groundY - 52);
    ctx.lineTo(treeX - 16, groundY - 66);
    ctx.moveTo(treeX + 3, groundY - 64);
    ctx.lineTo(treeX + 19, groundY - 76);
    ctx.stroke();
  }

  // 4. Perspective Muddy Battlefield Ground & Convoy Road (Z = 0.68 to 1.25)
  const groundGrad = ctx.createLinearGradient(0, groundY - 12, 0, height);
  groundGrad.addColorStop(0, '#292524'); // muddy verge
  groundGrad.addColorStop(0.22, '#44403C'); // rutted clay road
  groundGrad.addColorStop(0.65, '#292524'); // deep wet mud
  groundGrad.addColorStop(1, '#0C0A09');
  ctx.fillStyle = groundGrad;
  ctx.fillRect(0, groundY - 10, width, height - groundY + 10);

  // Scrolling Tire Ruts, Mud Puddles & Shell Craters in Perspective
  const rutStep = 90;
  const rutOffset = (scroll * 0.92) % rutStep;
  for (let rx = -rutStep; rx < width + rutStep; rx += rutStep) {
    const drawX = rx - rutOffset;
    // Upper and lower tire tracks
    ctx.strokeStyle = 'rgba(28, 25, 23, 0.72)';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(drawX, groundY + 4);
    ctx.lineTo(drawX + 58, groundY + 6);
    ctx.moveTo(drawX + 12, groundY + 22);
    ctx.lineTo(drawX + 72, groundY + 24);
    ctx.stroke();

    // Specular wet mud puddle reflection
    ctx.fillStyle = 'rgba(148, 163, 184, 0.16)';
    ctx.beginPath();
    ctx.ellipse(drawX + 35, groundY + 14, 24, 4.2, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // 5. Render 2.5D Extruded Midground Structures (Stone Walls, Sandbag Bunkers, Milepost)
  for (const st of structures) {
    ctx.save();
    ctx.translate(st.screenX, st.groundY);

    // Directional ground shadow
    ctx.fillStyle = 'rgba(2, 6, 23, 0.42)';
    ctx.beginPath();
    ctx.ellipse(0, 4, st.width * 0.65, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    if (st.kind === 'stone_ruin_wall') {
      const halfW = st.width * 0.5;
      // Front face of stone wall
      ctx.fillStyle = '#57534E';
      ctx.strokeStyle = '#1C1917';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-halfW, 0);
      ctx.lineTo(-halfW, -st.height);
      ctx.lineTo(-halfW + 24, -st.height - 8);
      ctx.lineTo(6, -st.height + 14);
      ctx.lineTo(halfW, -st.height + 6);
      ctx.lineTo(halfW, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // 2.5D Extruded Right Depth Face
      ctx.fillStyle = '#44403C';
      ctx.beginPath();
      ctx.moveTo(halfW, -st.height + 6);
      ctx.lineTo(halfW + st.depthExtrusionPx, -st.height + 14);
      ctx.lineTo(halfW + st.depthExtrusionPx, -4);
      ctx.lineTo(halfW, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Stone block mortar lines
      ctx.strokeStyle = 'rgba(28, 25, 23, 0.55)';
      ctx.lineWidth = 1.5;
      for (let row = 16; row < st.height - 10; row += 16) {
        ctx.beginPath();
        ctx.moveTo(-halfW + 4, -row);
        ctx.lineTo(halfW - 4, -row);
        ctx.stroke();
      }
    } else if (st.kind === 'sandbag_bunker') {
      // Stacked 2.5D sandbags with volumetric shading
      const bagRows = [
        { y: -8, count: 4 },
        { y: -20, count: 3 },
        { y: -31, count: 2 },
      ];
      for (const r of bagRows) {
        for (let b = 0; b < r.count; b++) {
          const bx = (b - (r.count - 1) / 2) * 22;
          ctx.fillStyle = '#A8A29E';
          ctx.strokeStyle = '#292524';
          ctx.lineWidth = 1.8;
          ctx.beginPath();
          ctx.roundRect(bx - 11, r.y - 6, 22, 12, 5);
          ctx.fill();
          ctx.stroke();
          // 2.5D side cap on rightmost sandbag
          if (b === r.count - 1) {
            ctx.fillStyle = '#78716C';
            ctx.beginPath();
            ctx.roundRect(bx + 8, r.y - 5, 8, 11, 3);
            ctx.fill();
            ctx.stroke();
          }
        }
      }
    } else if (st.kind === 'milepost_monte_castello') {
      // Tactical wooden road signpost ("MONTE CASTELLO 2 KM")
      ctx.fillStyle = '#78350F';
      ctx.fillRect(-3, -52, 6, 52);
      ctx.fillStyle = '#FDE047';
      ctx.strokeStyle = '#1C1917';
      ctx.lineWidth = 1.5;
      ctx.fillRect(-38, -48, 76, 16);
      ctx.strokeRect(-38, -48, 76, 16);
      ctx.fillStyle = '#0F172A';
      ctx.font = 'bold 7.5px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('M. CASTELLO ➔', 0, -37);
    }

    ctx.restore();
  }

  // 6. Render Artillery Explosions, Dirt Plumes & Supersonic Shockwaves
  for (const exp of explosions) {
    ctx.save();
    ctx.translate(exp.screenX, exp.groundY);
    const alpha = Math.max(0, 1 - exp.ageNorm);

    // Expanding supersonic shockwave ring
    ctx.strokeStyle = `rgba(254, 243, 199, ${alpha * 0.65})`;
    ctx.lineWidth = 3.5 * (1 - exp.ageNorm * 0.6);
    ctx.beginPath();
    ctx.arc(0, -18, exp.shockwaveRadius, Math.PI, Math.PI * 2);
    ctx.stroke();

    // Fiery core flash (early phase)
    if (exp.ageNorm < 0.55) {
      const coreAlpha = (1 - exp.ageNorm / 0.55) * 0.9;
      const coreR = 28 + exp.ageNorm * 95;
      const fireGrad = ctx.createRadialGradient(0, -24, 4, 0, -24, coreR);
      fireGrad.addColorStop(0, `rgba(255, 255, 255, ${coreAlpha})`);
      fireGrad.addColorStop(0.35, `rgba(251, 191, 36, ${coreAlpha})`);
      fireGrad.addColorStop(0.7, `rgba(239, 68, 68, ${coreAlpha * 0.8})`);
      fireGrad.addColorStop(1, 'rgba(28, 25, 23, 0)');
      ctx.fillStyle = fireGrad;
      ctx.beginPath();
      ctx.arc(0, -24, coreR, 0, Math.PI * 2);
      ctx.fill();
    }

    // Erupting dark dirt & smoke column with gravity fallback
    ctx.fillStyle = `rgba(28, 25, 23, ${alpha * 0.85})`;
    for (let c = 0; c < 9; c++) {
      const angle = -Math.PI * 0.18 - (c / 8) * Math.PI * 0.64;
      const speed = 75 + (c % 3) * 42;
      const t = exp.ageNorm * 1.4;
      const px = Math.cos(angle) * speed * t;
      const py = Math.sin(angle) * speed * t + 0.5 * 140 * t * t;
      const plumeR = 10 + (c % 4) * 5 + exp.ageNorm * 14;
      ctx.beginPath();
      ctx.arc(px, Math.min(0, py), plumeR, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  ctx.restore();
}

/**
 * Renders the Volumetric 2.5D Bedford/GMC 6x6 FEB Military Truck with:
 * - 3D perspective extruded cab, radiator grille, and canvas troop ribs
 * - 3 axles / 6 rotating mud-tread tires with independent crater suspension
 * - Flying mud/dust plumes kicked up by the tires
 * - Volumetric headlight beams & diesel exhaust smoke
 * - Seated FEB driver silhouette inside the cab
 */
export function renderVolumetricMilitaryTruck(
  ctx: CanvasRenderingContext2D,
  stage: ConstructedWorldStage,
  elapsedSec: number
) {
  const { truck } = stage;
  if (!truck.active) return;

  ctx.save();
  ctx.translate(truck.screenX, truck.groundY);

  // 1. Deep Volumetric Ground Shadow under the 6x6 chassis
  ctx.fillStyle = 'rgba(2, 6, 23, 0.55)';
  ctx.beginPath();
  ctx.ellipse(-6, 5, 162, 16, 0, 0, Math.PI * 2);
  ctx.fill();

  // Apply chassis suspension bounce & braking/acceleration pitch
  ctx.save();
  ctx.translate(0, truck.chassisBounceY);
  ctx.rotate(truck.chassisPitchRad);

  const depthX = 16; // 2.5D perspective extrusion offset
  const depthY = -9;

  // 2. Diesel Exhaust Smoke Plume (streaming backward according to truck velocity)
  for (let s = 0; s < 7; s++) {
    const smokeCycle = (elapsedSec * 2.6 + s * 0.14) % 1;
    const sx = -132 - smokeCycle * 95;
    const sy = -18 - smokeCycle * 34 + Math.sin(elapsedSec * 8 + s) * 4;
    const sr = 8 + smokeCycle * 22;
    const sAlpha = Math.max(0, (1 - smokeCycle) * 0.38);
    ctx.fillStyle = `rgba(51, 65, 85, ${sAlpha})`;
    ctx.beginPath();
    ctx.arc(sx, sy, sr, 0, Math.PI * 2);
    ctx.fill();
  }

  // 3. Back-Row Wheels (Far side of 6x6 axles in 2.5D depth)
  const axlePositionsX = [-96, -44, 82];
  for (let i = 0; i < 3; i++) {
    drawMilitaryTruckWheel(
      ctx,
      axlePositionsX[i] + depthX * 0.75,
      -22 + depthY * 0.55 + truck.axleSuspensionY[i] * 0.7,
      24,
      truck.wheelSpinRad,
      true
    );
  }

  // 4. Heavy Steel Ladder Chassis Frame & Undercarriage Differential
  ctx.fillStyle = '#1C1917';
  ctx.fillRect(-134, -34, 240, 12);
  ctx.fillStyle = '#292524';
  ctx.fillRect(-75, -26, 42, 8);

  // 5. 2.5D Cargo Bed & Ribbed Olive-Drab Canvas Troop Canopy
  // 5a. Inside dark hollow of rear troop compartment (depth interior)
  ctx.fillStyle = '#141A12';
  ctx.fillRect(-132, -106, 26, 68);

  // 5b. 2.5D Extruded Roof & Far-Side Plane of Canvas Canopy
  ctx.fillStyle = '#2E3B23';
  ctx.beginPath();
  ctx.moveTo(-132, -108);
  ctx.lineTo(-132 + depthX, -108 + depthY);
  ctx.lineTo(18 + depthX, -108 + depthY);
  ctx.lineTo(18, -108);
  ctx.closePath();
  ctx.fill();

  // 5c. Main Side Canvas Canopy with Volumetric Structural Ribs
  const canopyGrad = ctx.createLinearGradient(0, -110, 0, -42);
  canopyGrad.addColorStop(0, '#4D5D3B');
  canopyGrad.addColorStop(0.6, '#3B492C');
  canopyGrad.addColorStop(1, '#29331E');
  ctx.fillStyle = canopyGrad;
  ctx.strokeStyle = '#1A2112';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.roundRect(-132, -108, 150, 56, [8, 8, 2, 2]);
  ctx.fill();
  ctx.stroke();

  // Vertical canvas structural ribs & shading folds
  for (let rx = -108; rx <= -4; rx += 26) {
    ctx.strokeStyle = 'rgba(20, 26, 14, 0.55)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(rx, -106);
    ctx.lineTo(rx, -52);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(163, 184, 138, 0.22)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(rx + 2, -106);
    ctx.lineTo(rx + 2, -52);
    ctx.stroke();
  }

  // 5d. Wooden/Steel Cargo Sideboards & Tailgate
  ctx.fillStyle = '#364427';
  ctx.strokeStyle = '#1A2112';
  ctx.lineWidth = 2.2;
  ctx.fillRect(-134, -56, 154, 24);
  ctx.strokeRect(-134, -56, 154, 24);

  // Horizontal wooden plank slats & steel reinforcement brackets
  ctx.strokeStyle = '#1A2112';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-134, -44);
  ctx.lineTo(20, -44);
  ctx.stroke();

  // Allied White Tactical Star & "FEB - BRASIL" Stencil on Cargo Bed
  drawAlliedStarEmblem(ctx, -58, -80, 13);
  ctx.fillStyle = '#E2E8F0';
  ctx.font = 'bold 9px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('FEB • 1º R.I.', -58, -46);

  // If boarding climax, draw dropped tailgate ramp
  if (truck.tailgateOpen) {
    ctx.save();
    ctx.translate(-134, -34);
    ctx.rotate(0.45);
    ctx.fillStyle = '#364427';
    ctx.strokeStyle = '#1A2112';
    ctx.lineWidth = 2;
    ctx.fillRect(-24, -4, 24, 6);
    ctx.strokeRect(-24, -4, 24, 6);
    ctx.restore();
  }

  // 6. 2.5D Extruded Armored Military Cab & Engine Hood (Bedford / GMC CCKW)
  // 6a. 2.5D Top Roof & Hood Extrusion
  ctx.fillStyle = '#4B5938';
  ctx.beginPath();
  ctx.moveTo(22, -94);
  ctx.lineTo(22 + depthX, -94 + depthY);
  ctx.lineTo(62 + depthX, -94 + depthY);
  ctx.lineTo(62, -94);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(68, -62);
  ctx.lineTo(68 + depthX, -62 + depthY);
  ctx.lineTo(118 + depthX, -56 + depthY);
  ctx.lineTo(118, -56);
  ctx.closePath();
  ctx.fill();

  // 6b. 2.5D Front Radiator Grille Face (angled in perspective)
  ctx.fillStyle = '#262E1C';
  ctx.strokeStyle = '#141A0E';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(118, -56);
  ctx.lineTo(118 + depthX, -56 + depthY);
  ctx.lineTo(118 + depthX, -28 + depthY);
  ctx.lineTo(118, -28);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Vertical steel radiator grille bars
  ctx.strokeStyle = '#52633E';
  ctx.lineWidth = 1.4;
  for (let g = 3; g <= 13; g += 3.2) {
    ctx.beginPath();
    ctx.moveTo(118 + g, -54 + (g / depthX) * depthY);
    ctx.lineTo(118 + g, -30 + (g / depthX) * depthY);
    ctx.stroke();
  }

  // 6c. Main Cab & Hood Side Profile
  const cabGrad = ctx.createLinearGradient(20, -94, 118, -28);
  cabGrad.addColorStop(0, '#445232');
  cabGrad.addColorStop(0.55, '#384528');
  cabGrad.addColorStop(1, '#2B361E');
  ctx.fillStyle = cabGrad;
  ctx.strokeStyle = '#1A2112';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(22, -32);
  ctx.lineTo(22, -94);
  ctx.lineTo(58, -94);
  ctx.lineTo(68, -62);
  ctx.lineTo(118, -56);
  ctx.lineTo(118, -28);
  ctx.lineTo(104, -28);
  ctx.arc(82, -26, 28, 0, Math.PI, true); // Front armored wheel arch
  ctx.lineTo(22, -32);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // 6d. Cab Window & Seated FEB Driver Silhouette
  ctx.fillStyle = '#0F172A';
  ctx.beginPath();
  ctx.moveTo(28, -88);
  ctx.lineTo(54, -88);
  ctx.lineTo(62, -64);
  ctx.lineTo(28, -64);
  ctx.closePath();
  ctx.fill();

  // Driver inside cab (with M1 helmet & hands on steering wheel)
  ctx.fillStyle = '#1E293B';
  ctx.beginPath();
  ctx.arc(43, -74, 6.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#4D5D3B';
  ctx.beginPath();
  ctx.arc(43, -76, 7.5, Math.PI, 0);
  ctx.fill();

  // Specular windshield glass reflection
  ctx.fillStyle = 'rgba(186, 230, 253, 0.28)';
  ctx.beginPath();
  ctx.moveTo(30, -87);
  ctx.lineTo(44, -87);
  ctx.lineTo(36, -65);
  ctx.lineTo(30, -65);
  ctx.closePath();
  ctx.fill();

  // Engine hood louvers & "COBRA FUMANDO" shield badge on cab door
  ctx.fillStyle = '#16A34A';
  ctx.strokeStyle = '#FACC15';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.roundRect(35, -56, 16, 16, 3);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#FACC15';
  ctx.font = 'bold 7px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('🐍', 43, -45);

  // Heavy front steel bumper
  ctx.fillStyle = '#1C1917';
  ctx.fillRect(114, -34, 14, 9);

  // 7. Volumetric Headlight Cones Cutting Through Battlefield Smoke
  if (truck.headlightsOn) {
    ctx.save();
    const beamGrad = ctx.createLinearGradient(120, -46, 340, -10);
    beamGrad.addColorStop(0, 'rgba(254, 240, 138, 0.52)');
    beamGrad.addColorStop(0.45, 'rgba(253, 224, 71, 0.22)');
    beamGrad.addColorStop(1, 'rgba(253, 224, 71, 0)');
    ctx.fillStyle = beamGrad;
    ctx.beginPath();
    ctx.moveTo(120, -48);
    ctx.lineTo(340, -95);
    ctx.lineTo(340, 28);
    ctx.lineTo(120, -40);
    ctx.closePath();
    ctx.fill();

    // Glowing headlamp lenses (near & 2.5D far headlamp)
    ctx.fillStyle = '#FEF08A';
    ctx.beginPath();
    ctx.arc(119, -45, 4.5, 0, Math.PI * 2);
    ctx.arc(119 + depthX * 0.85, -45 + depthY * 0.85, 3.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Red brake light glow when braking for ambush/artillery
  if (truck.braking) {
    ctx.fillStyle = '#EF4444';
    ctx.beginPath();
    ctx.arc(-134, -36, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(239, 68, 68, 0.28)';
    ctx.beginPath();
    ctx.arc(-138, -36, 18, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore(); // end chassis pitch/bounce

  // 8. Front-Row Articulated 6x6 Mud-Tread Tires + Physical Mud/Dust Spray
  for (let i = 0; i < 3; i++) {
    const wx = axlePositionsX[i];
    const wy = -24 + truck.axleSuspensionY[i];
    drawMilitaryTruckWheel(ctx, wx, wy, 26, truck.wheelSpinRad, false);

    // Physical mud clods & dust plume kicked up behind each rotating tire
    if (truck.velocityPxPerSec > 25) {
      for (let m = 0; m < 4; m++) {
        const mudPhase = (elapsedSec * 5.5 + i * 0.35 + m * 0.25) % 1;
        const mx = wx - 14 - mudPhase * (42 + (truck.velocityPxPerSec * 0.15));
        const my = -4 - Math.sin(mudPhase * Math.PI) * (14 + m * 4);
        const mr = (1 - mudPhase) * 3.8;
        ctx.fillStyle = m % 2 === 0 ? 'rgba(68, 64, 60, 0.78)' : 'rgba(120, 113, 108, 0.52)';
        ctx.beginPath();
        ctx.arc(mx, my, Math.max(1, mr), 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  ctx.restore();
}

function drawMilitaryTruckWheel(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  spinAngle: number,
  isBackRow: boolean
) {
  ctx.save();
  ctx.translate(cx, cy);
  if (isBackRow) {
    ctx.globalAlpha = 0.72;
  }

  // 2.5D Tire Tread Thickness Extrusion
  ctx.fillStyle = '#090D16';
  ctx.beginPath();
  ctx.arc(4, -2, r, 0, Math.PI * 2);
  ctx.fill();

  // Main Heavy Rubber Mud Tire
  ctx.fillStyle = '#1C1917';
  ctx.strokeStyle = '#0C0A09';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Rotating aggressive off-road tire lugs around perimeter
  const numLugs = 12;
  ctx.strokeStyle = '#292524';
  ctx.lineWidth = 3;
  for (let i = 0; i < numLugs; i++) {
    const a = spinAngle + (i / numLugs) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * (r - 3.5), Math.sin(a) * (r - 3.5));
    ctx.lineTo(Math.cos(a) * (r + 1.2), Math.sin(a) * (r + 1.2));
    ctx.stroke();
  }

  // Olive-drab heavy steel military wheel rim
  ctx.fillStyle = '#3B492C';
  ctx.strokeStyle = '#1A2112';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.58, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Rotating lug bolts & axle hubcap
  ctx.fillStyle = '#A8A29E';
  for (let b = 0; b < 6; b++) {
    const ba = spinAngle + (b / 6) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(Math.cos(ba) * r * 0.36, Math.sin(ba) * r * 0.36, 1.9, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = '#262E1C';
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawAlliedStarEmblem(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number
) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = 'rgba(241, 245, 249, 0.78)';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(0, 0, radius + 3, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = 'rgba(248, 250, 252, 0.88)';
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const outerAngle = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    const innerAngle = outerAngle + Math.PI / 5;
    const ox = Math.cos(outerAngle) * radius;
    const oy = Math.sin(outerAngle) * radius;
    const ix = Math.cos(innerAngle) * (radius * 0.42);
    const iy = Math.sin(innerAngle) * (radius * 0.42);
    if (i === 0) ctx.moveTo(ox, oy);
    else ctx.lineTo(ox, oy);
    ctx.lineTo(ix, iy);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/**
 * Renders the Brazilian WWII Soldier (FEB) coherent tactical equipment directly onto
 * the biomechanical stickman rig:
 * - M1 Steel Helmet with camouflage netting & chinstrap
 * - Tactical Olive-Drab Field Pack & Webbing Belt with Canteen
 * - M1 Garand Rifle held across the hands with optional muzzle flash & ejecting brass
 * - Boot mud splashes when planted feet push off the muddy road
 */
export function renderSoldierTacticalEquipment(
  ctx: CanvasRenderingContext2D,
  pose: BiomechanicalHumanPose,
  char: SceneCharacter,
  elapsedSec: number,
  isWarSoldier: boolean,
  isFiringRifle: boolean
) {
  const hasMilitaryGear =
    isWarSoldier ||
    char.prop === 'rifle' ||
    (char.equipment && char.equipment.length > 0) ||
    char.action === 'truck_run_alongside' ||
    char.action === 'trench_cover_fire' ||
    char.action === 'truck_board_convoy';

  if (!hasMilitaryGear) return;

  // 1. Boot Mud Splashes when running on the battlefield road
  for (const leg of [pose.leftLeg, pose.rightLeg]) {
    if (leg.planted) {
      ctx.save();
      ctx.fillStyle = 'rgba(68, 64, 60, 0.72)';
      for (let d = 0; d < 3; d++) {
        const phase = (elapsedSec * 7 + d * 0.3) % 1;
        const dx = leg.ankleX - 6 - phase * 18;
        const dy = leg.ankleY - Math.sin(phase * Math.PI) * (7 + d * 3);
        ctx.beginPath();
        ctx.arc(dx, dy, 2.2 * (1 - phase), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  // 2. Tactical Field Pack (Mochila de Campanha FEB) & Webbing Belt on Torso
  ctx.save();
  const packX = (pose.thoraxX + pose.lumbarX) * 0.5 - 11;
  const packY = (pose.thoraxY + pose.lumbarY) * 0.5 - 10;
  ctx.fillStyle = '#3F4E30';
  ctx.strokeStyle = '#1A2112';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.roundRect(packX - 7, packY - 12, 13, 24, 4);
  ctx.fill();
  ctx.stroke();

  // Rolled blanket on top of field pack
  ctx.fillStyle = '#57534E';
  ctx.beginPath();
  ctx.roundRect(packX - 8, packY - 17, 14, 6, 3);
  ctx.fill();
  ctx.stroke();

  // Webbing suspender straps across chest & canteen at hip
  ctx.strokeStyle = '#65754E';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(pose.leftShoulderX, pose.leftShoulderY);
  ctx.lineTo(pose.pelvisX - 3, pose.pelvisY);
  ctx.moveTo(pose.rightShoulderX, pose.rightShoulderY);
  ctx.lineTo(pose.pelvisX + 3, pose.pelvisY);
  ctx.stroke();

  // Hip ammo pouches & canteen
  ctx.fillStyle = '#4D5D3B';
  ctx.fillRect(pose.pelvisX - 7, pose.pelvisY - 4, 14, 6);
  ctx.restore();

  // 3. Articulated M1 Garand Rifle locked to the Soldier's Hands
  ctx.save();
  const gripX = pose.rightArm.handX;
  const gripY = pose.rightArm.handY;
  const aimDx = isFiringRifle ? 1.0 : pose.leftArm.handX - gripX + 22;
  const aimDy = isFiringRifle ? -0.06 : (pose.leftArm.handY - gripY) * 0.35 - 4;
  const rifleAngle = Math.atan2(aimDy, Math.max(12, aimDx));

  // Recoil kick when firing
  const firePulse = isFiringRifle ? Math.max(0, Math.sin(elapsedSec * 22)) : 0;
  const recoilOffset = -firePulse * 4.5;

  ctx.translate(gripX + Math.cos(rifleAngle) * recoilOffset, gripY + Math.sin(rifleAngle) * recoilOffset);
  ctx.rotate(rifleAngle);

  // Wooden rifle stock & fore-end (Walnut M1 Garand)
  ctx.fillStyle = '#78350F';
  ctx.strokeStyle = '#1C1917';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(-18, 4);
  ctx.lineTo(-18, -2);
  ctx.lineTo(26, -3.5);
  ctx.lineTo(26, 1.5);
  ctx.lineTo(-4, 2.5);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Gunmetal receiver, gas cylinder & long barrel
  ctx.fillStyle = '#334155';
  ctx.fillRect(-2, -5, 16, 3.5);
  ctx.strokeStyle = '#1E293B';
  ctx.lineWidth = 3.2;
  ctx.beginPath();
  ctx.moveTo(14, -3);
  ctx.lineTo(48, -3);
  ctx.stroke();

  // Front sight & bayonet lug
  ctx.fillStyle = '#0F172A';
  ctx.fillRect(43, -6, 2.5, 4);

  // Dynamic Muzzle Flash & Tracer Cone when firing
  if (isFiringRifle && firePulse > 0.35) {
    const flashLen = 24 + firePulse * 28;
    const flashGrad = ctx.createRadialGradient(52, -3, 2, 56, -3, flashLen);
    flashGrad.addColorStop(0, '#FFFFFF');
    flashGrad.addColorStop(0.35, '#FDE047');
    flashGrad.addColorStop(0.75, '#F97316');
    flashGrad.addColorStop(1, 'rgba(249, 115, 22, 0)');
    ctx.fillStyle = flashGrad;
    ctx.beginPath();
    ctx.moveTo(48, -3);
    ctx.lineTo(48 + flashLen, -12);
    ctx.lineTo(48 + flashLen * 1.2, -3);
    ctx.lineTo(48 + flashLen, 6);
    ctx.closePath();
    ctx.fill();

    // Ejecting brass cartridge casing spinning upward
    const brassT = (elapsedSec * 11) % 1;
    const bx = 4 - brassT * 18;
    const by = -6 - Math.sin(brassT * Math.PI) * 16;
    ctx.fillStyle = '#FACC15';
    ctx.fillRect(bx, by, 4, 1.8);
  }

  ctx.restore();

  // 4. M1 Steel Helmet (Capacete de Aço da FEB com Rede Tática) on Head
  ctx.save();
  ctx.translate(pose.headCenterX, pose.headCenterY);
  ctx.rotate(pose.headTilt * 0.85);

  const helmetGrad = ctx.createLinearGradient(-20, -24, 20, -2);
  helmetGrad.addColorStop(0, '#52633E');
  helmetGrad.addColorStop(0.6, '#3B492C');
  helmetGrad.addColorStop(1, '#262E1C');
  ctx.fillStyle = helmetGrad;
  ctx.strokeStyle = '#141A0E';
  ctx.lineWidth = 2.2;

  // Dome of M1 Helmet with flared front visor brim
  ctx.beginPath();
  ctx.arc(0, -3, 19.5, Math.PI * 0.94, Math.PI * 2.06);
  ctx.quadraticCurveTo(23, -2, 22, 1);
  ctx.lineTo(-21, 2);
  ctx.quadraticCurveTo(-22, -1, -19.5, -5);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Tactical mesh netting cross-hatching on helmet dome
  ctx.strokeStyle = 'rgba(20, 26, 14, 0.45)';
  ctx.lineWidth = 1.1;
  for (let nx = -12; nx <= 12; nx += 6) {
    ctx.beginPath();
    ctx.moveTo(nx, -20);
    ctx.lineTo(nx + 5, -3);
    ctx.moveTo(nx + 5, -20);
    ctx.lineTo(nx, -3);
    ctx.stroke();
  }

  // Leather chinstrap under jawline
  ctx.strokeStyle = '#57534E';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(-10, 1);
  ctx.quadraticCurveTo(-2, 17, 7, 13);
  ctx.stroke();

  ctx.restore();
}

/**
 * Renders the Foreground Parallax Layer (Z = 1.35: scrolling barbed-wire timber posts,
 * flying mud/smoke particles, tracer streaks, and volumetric dynamic rim lighting).
 */
export function renderConstructedWorldForeground(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  stage: ConstructedWorldStage,
  elapsedSec: number
) {
  if (!stage.isConstructedWarWorld) return;

  const { camera, groundY, dynamicLight } = stage;
  const fgScroll = camera.worldScrollX * 1.38;

  ctx.save();

  // 1. Foreground Barbed-Wire Obstacles & Trench Stakes (Parallax Z = 1.38)
  const stakeSpacing = 480;
  const stakeOffset = fgScroll % stakeSpacing;
  ctx.save();
  ctx.globalAlpha = 0.78;
  for (let sx = -stakeSpacing; sx < width + stakeSpacing; sx += stakeSpacing) {
    const postX = sx - stakeOffset + 140;
    const postBaseY = height - 8;

    // Crossed wooden X-trench stakes in foreground
    ctx.strokeStyle = '#1C1917';
    ctx.lineWidth = 6.5;
    ctx.beginPath();
    ctx.moveTo(postX - 18, postBaseY);
    ctx.lineTo(postX + 16, postBaseY - 64);
    ctx.moveTo(postX + 18, postBaseY);
    ctx.lineTo(postX - 16, postBaseY - 64);
    ctx.stroke();

    // Coiled barbed wire strands between stakes
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(postX - 45, postBaseY - 46);
    ctx.lineTo(postX + 45, postBaseY - 42);
    ctx.moveTo(postX - 45, postBaseY - 28);
    ctx.lineTo(postX + 45, postBaseY - 32);
    ctx.stroke();
  }
  ctx.restore();

  // 2. High-Velocity Tracer Rounds Streaking Across Battlefield
  for (let tr = 0; tr < 3; tr++) {
    const trCycle = (elapsedSec * 1.85 + tr * 0.37) % 1;
    if (trCycle < 0.55) {
      const p = trCycle / 0.55;
      const tx = width * 0.15 + p * width * 0.82;
      const ty = groundY - 75 - tr * 38 - p * 26;
      const traceGrad = ctx.createLinearGradient(tx - 65, ty + 4, tx, ty);
      traceGrad.addColorStop(0, 'rgba(253, 224, 71, 0)');
      traceGrad.addColorStop(0.7, 'rgba(251, 146, 60, 0.75)');
      traceGrad.addColorStop(1, '#FFFFFF');
      ctx.strokeStyle = traceGrad;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(tx - 65, ty + 4);
      ctx.lineTo(tx, ty);
      ctx.stroke();
    }
  }

  // 3. Airborne Battlefield Embers, Ash & Mud Droplets
  for (let p = 0; p < 18; p++) {
    const px = ((p * 97 - fgScroll * (0.65 + (p % 3) * 0.2)) % width + width) % width;
    const py = ((p * 61 + elapsedSec * (28 + (p % 4) * 12)) % (height * 0.88));
    const isEmber = p % 3 === 0;
    ctx.fillStyle = isEmber ? 'rgba(251, 146, 60, 0.78)' : 'rgba(168, 162, 158, 0.35)';
    ctx.beginPath();
    ctx.arc(px, py, isEmber ? 2.1 : 2.8, 0, Math.PI * 2);
    ctx.fill();
  }

  // 4. Dynamic Point-Light Atmospheric Wash from Artillery / Headlights
  if (dynamicLight.active && dynamicLight.intensity > 0.05) {
    const lightGrad = ctx.createRadialGradient(
      dynamicLight.x,
      dynamicLight.y,
      10,
      dynamicLight.x,
      dynamicLight.y,
      width * 0.48
    );
    lightGrad.addColorStop(
      0,
      `rgba(251, 146, 60, ${Math.min(0.28, dynamicLight.intensity * 0.25)})`
    );
    lightGrad.addColorStop(1, 'rgba(15, 23, 42, 0)');
    ctx.fillStyle = lightGrad;
    ctx.fillRect(0, 0, width, height);
  }

  // 5. Subtle Cinematic HUD Telemetry Pill (Top-Left World Constructor Indicator)
  ctx.fillStyle = 'rgba(9, 13, 22, 0.84)';
  ctx.fillRect(18, 16, 488, 40);
  ctx.fillStyle = '#22C55E';
  ctx.fillRect(18, 16, 4, 40);
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.28)';
  ctx.lineWidth = 1;
  ctx.strokeRect(18, 16, 488, 40);

  ctx.fillStyle = '#F8FAFC';
  ctx.font = 'bold 11px "Inter", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(
    '🇧🇷 CONSTRUTOR DE CENA 2.5D: FEB • MONTE CASTELLO (CAMINHÃO 6x6 + FÍSICA + IK)',
    30,
    32
  );
  ctx.fillStyle = '#94A3B8';
  ctx.font = '10px "JetBrains Mono", monospace';
  const distMeters = (camera.worldScrollX / 32).toFixed(1);
  ctx.fillText(
    `TRAVELLING: ${distMeters}m  •  SUSPENSÃO 6x6 ATIVA  •  INTERAÇÃO FÍSICA COM CAMINHÃO & COBERTURA`,
    30,
    48
  );

  ctx.restore();
}
