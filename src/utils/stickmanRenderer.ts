import {
  StickmanScene,
  SceneCharacter,
  EnvironmentTheme,
  CameraEffect,
  VisualFilter,
  FloatingVfxIcon,
  DynamicManeuver,
  StickmanAction,
} from '../types/stickman';
import {
  calculateLimbAngles,
  blendLimbAngles,
  calculateCameraTransform,
  getActiveWordIndexAtProgress,
  getProsodicSpeechEnvelope,
  ProsodicSpeechEnvelope,
  MotionVariationContext,
  getSceneAnchors,
  resolveBiomechanicalHumanPose,
  solveTwoBoneIK,
  SceneAnchorMap,
} from './stickmanMath';
import { resolveActiveBeatState } from './choreographyEngine';
import {
  constructWorldStage,
  renderConstructedWorldBackground,
  renderVolumetricMilitaryTruck,
  renderSoldierTacticalEquipment,
  renderConstructedWorldForeground,
  ConstructedWorldStage,
} from './sceneConstructor';

export interface RenderOptions {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  scene: StickmanScene;
  sceneProgress: number; // [0..1]
  isSpeaking: boolean;
  aspectRatio: '16:9' | '9:16';
  wpm?: number;
}

export function renderStickmanFrame({
  ctx,
  width,
  height,
  scene,
  sceneProgress,
  isSpeaking,
  wpm = 155,
}: RenderOptions) {
  ctx.clearRect(0, 0, width, height);

  const beatState = resolveActiveBeatState(scene, sceneProgress);
  const sceneAnchors = getSceneAnchors(scene.environment, width, height);
  const worldStage = constructWorldStage(scene, beatState, sceneProgress, width, height);

  ctx.save();
  const activeCamera = beatState.effectiveCamera || scene.cameraEffect;
  const camera = calculateCameraTransform(activeCamera, sceneProgress);
  const effectiveZoom = worldStage.isConstructedWarWorld
    ? Math.max(0.92, worldStage.camera.dynamicZoom + (beatState.framingZoomOffset || 0) * 0.5)
    : Math.max(0.85, camera.zoom + (beatState.framingZoomOffset || 0));
  const centerX = width / 2;
  const centerY = height / 2;

  const camOffsetX = worldStage.isConstructedWarWorld
    ? worldStage.camera.trackingOffsetX
    : camera.offsetX;
  const camOffsetY = worldStage.isConstructedWarWorld
    ? worldStage.camera.trackingOffsetY
    : camera.offsetY;

  ctx.translate(centerX + camOffsetX, centerY + camOffsetY);
  if (worldStage.isConstructedWarWorld && Math.abs(worldStage.camera.rollAngleRad) > 0.0005) {
    ctx.rotate(worldStage.camera.rollAngleRad);
  }
  ctx.scale(effectiveZoom, effectiveZoom);
  ctx.translate(-centerX, -centerY);

  if (worldStage.isConstructedWarWorld) {
    // 1. Render 2.5D Multi-Plane Parallax World Background, Perspective Road, Structures & Explosions
    renderConstructedWorldBackground(
      ctx,
      width,
      height,
      worldStage,
      sceneProgress,
      beatState.elapsedInSceneSec
    );

    // 2. Render Volumetric 2.5D 6x6 FEB Military Truck (with crater-following suspension & mud spray)
    renderVolumetricMilitaryTruck(ctx, worldStage, beatState.elapsedInSceneSec);
  } else {
    // 1. Draw Rich Multi-Layered Background Environment
    drawEnvironment(ctx, width, height, scene.environment, sceneProgress);

    // 1.25 Draw Realistic Ground Texture, Horizon Depth Haze & Specular Light Reflection
    drawRealisticGroundAndDepthLayer(
      ctx,
      width,
      height,
      scene.environment,
      sceneAnchors,
      sceneProgress,
      beatState.elapsedInSceneSec
    );

    // 1.5 Draw Living Environmental Simulation (Autonomous People, Objectives & Physics)
    drawEnvironmentalSimulation(
      ctx,
      width,
      height,
      scene.environment,
      beatState.elapsedInSceneSec,
      sceneProgress,
      beatState.char1XNorm,
      beatState.effectiveAction1
    );
  }

  // 2. Draw Speed Lines if high-speed / action
  const isHighSpeed =
    beatState.effectiveAction1 === 'car_chase' ||
    beatState.effectiveAction1 === 'car_drift' ||
    beatState.effectiveAction1 === 'fight_kungfu' ||
    beatState.effectiveAction1 === 'sword_duel' ||
    beatState.maneuver === 'car_accelerate_surge' ||
    beatState.maneuver === 'car_handbrake_drift' ||
    beatState.maneuver === 'police_ram_sparks' ||
    beatState.maneuver === 'nitro_boost' ||
    activeCamera === 'shake';

  if (isHighSpeed && !worldStage.isConstructedWarWorld) {
    drawSpeedLines(ctx, width, height, sceneProgress);
  }

  // 3. Draw Characters & Vehicles with Biomechanical 2-Bone IK & Foot-Planting
  const groundY = worldStage.isConstructedWarWorld ? worldStage.groundY : sceneAnchors.groundY;
  const isVehicleAction =
    !worldStage.isConstructedWarWorld &&
    (beatState.effectiveAction1 === 'drive_car' ||
      beatState.effectiveAction1 === 'car_chase' ||
      beatState.effectiveAction1 === 'car_drift');

  const effectiveChar1: SceneCharacter = {
    ...scene.character1,
    action: beatState.effectiveAction1,
    expression: beatState.effectiveExpression1,
    prop: beatState.effectiveProp1,
  };

  const effectiveChar2: SceneCharacter | undefined = scene.character2
    ? {
        ...scene.character2,
        action: beatState.effectiveAction2,
      }
    : undefined;

  const motionCtx1: MotionVariationContext = {
    seed: beatState.seed,
    intensity: beatState.intensity,
    anticipation: beatState.anticipation,
    reaction: beatState.reaction,
    settle: beatState.settle,
    weightShift: beatState.weightShift,
  };

  const prosodicEnvelope: ProsodicSpeechEnvelope | undefined = isSpeaking
    ? getProsodicSpeechEnvelope(scene.narration || '', sceneProgress, wpm)
    : undefined;

  if (isVehicleAction) {
    // Draw Vehicle with Stickman inside with dynamic lane swerving and nitro
    const vehicleX = width * beatState.char1XNorm;
    const vehicleY = groundY + beatState.jumpOffsetY * 0.35;

    drawVehicleWithDriver(
      ctx,
      effectiveChar1,
      vehicleX,
      vehicleY,
      sceneProgress,
      isSpeaking,
      effectiveChar1.action,
      scene.environment === 'police_chase_night',
      beatState.maneuver,
      beatState.elapsedInSceneSec,
      beatState.beatProgress,
      beatState.beatIndex,
      motionCtx1,
      prosodicEnvelope
    );

    // If there is an opponent / police car in scene
    if (effectiveChar2) {
      const oppX = width * beatState.char2XNorm;
      drawVehicleWithDriver(
        ctx,
        effectiveChar2,
        oppX,
        groundY + beatState.char2JumpOffsetY * 0.35,
        sceneProgress + 0.1,
        false,
        'car_chase',
        true, // police car
        'none',
        beatState.elapsedInSceneSec + 0.4,
        beatState.beatProgress,
        beatState.beatIndex + 1,
        {
          ...motionCtx1,
          seed: beatState.seed + 73,
        }
      );
    }
  } else {
    // Standard Character 1 with 2-bone IK foot-planting, anatomical spine, prosodic gestures, and scene/truck anchor interaction
    const char1X = worldStage.soldierOverride.active
      ? worldStage.soldierOverride.screenX
      : width * beatState.char1XNorm;
    const char1Y = worldStage.soldierOverride.active
      ? worldStage.soldierOverride.groundY
      : groundY + beatState.jumpOffsetY;
    const char1Flip = worldStage.soldierOverride.active
      ? worldStage.soldierOverride.flipX
      : beatState.flipChar1;
    const char1FacingCos = worldStage.soldierOverride.active
      ? worldStage.soldierOverride.facingCos
      : beatState.facingCos1;

    drawCharacter(
      ctx,
      effectiveChar1,
      char1X,
      char1Y,
      sceneProgress,
      isSpeaking,
      char1Flip,
      height,
      beatState.maneuver,
      beatState.beatProgress,
      beatState.elapsedInSceneSec,
      beatState.beatIndex,
      beatState.prevAction1,
      beatState.transitionBlend,
      beatState.velocityX,
      motionCtx1,
      sceneAnchors,
      prosodicEnvelope,
      char1FacingCos,
      worldStage
    );

    // Optional Character 2
    if (effectiveChar2) {
      const char2X = width * beatState.char2XNorm;
      const char2Y = groundY + beatState.char2JumpOffsetY;

      drawCharacter(
        ctx,
        effectiveChar2,
        char2X,
        char2Y,
        sceneProgress,
        false,
        beatState.flipChar2,
        height,
        'none',
        beatState.beatProgress,
        beatState.elapsedInSceneSec + 0.5,
        beatState.beatIndex + 1,
        undefined,
        1,
        0,
        {
          seed: beatState.seed + 73,
          intensity: beatState.intensity,
          anticipation: beatState.anticipation,
          reaction: beatState.reaction,
          settle: beatState.settle,
          weightShift: -beatState.weightShift,
        },
        sceneAnchors
      );
    }

    // Impact sparks if fighting or striking
    if (
      effectiveChar1.action === 'fight_kungfu' ||
      effectiveChar1.action === 'sword_duel' ||
      beatState.maneuver === 'slide_kick' ||
      beatState.maneuver === 'parry' ||
      beatState.maneuver === 'combat_combo_rush' ||
      beatState.maneuver === 'jump_shock'
    ) {
      const contactX = effectiveChar2
        ? (char1X + width * beatState.char2XNorm) / 2
        : char1X + 45;
      drawImpactEffects(ctx, contactX, groundY - 60, sceneProgress);
    }
  }

  // 3.5 Foreground Depth Pass (2.5D Barbed Wire, Tracers & Dynamic Blast Lighting in War World, or Atmospheric Pass)
  if (worldStage.isConstructedWarWorld) {
    renderConstructedWorldForeground(
      ctx,
      width,
      height,
      worldStage,
      beatState.elapsedInSceneSec
    );
  }
  drawAtmosphericRealismLayer(
    ctx,
    width,
    height,
    scene,
    sceneAnchors,
    sceneProgress,
    beatState.elapsedInSceneSec
  );

  // Floating VFX Icon (follows character dynamically)
  const activeIcon = beatState.effectiveIcon || scene.floatingIcon;
  if (activeIcon && activeIcon !== 'none') {
    const iconX = width * beatState.char1XNorm;
    const iconY = isVehicleAction
      ? groundY - 115 + beatState.jumpOffsetY * 0.35
      : groundY - 155 + beatState.jumpOffsetY;
    drawFloatingIcon(ctx, activeIcon, iconX, iconY, sceneProgress);
  }

  ctx.restore();

  // 4. Visual Film Filters
  if (scene.visualFilter && scene.visualFilter !== 'none') {
    drawVisualFilter(ctx, width, height, scene.visualFilter, sceneProgress);
  }

  // 5. Kinetic Subtitles calibrated with ElevenLabs WPM & punctuation pauses
  drawKineticSubtitles(
    ctx,
    width,
    height,
    scene.narration,
    sceneProgress,
    scene.highlightWords,
    wpm
  );
}

function getCharX(pos: 'left' | 'center' | 'right', width: number): number {
  switch (pos) {
    case 'left':
      return width * 0.28;
    case 'right':
      return width * 0.72;
    case 'center':
    default:
      return width * 0.5;
  }
}

function drawEnvironment(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  env: EnvironmentTheme,
  progress: number
) {
  const groundY = height * 0.72;

  switch (env) {
    case 'highway_sunset': {
      // Warm golden/purple sunset gradient sky
      const skyGrad = ctx.createLinearGradient(0, 0, 0, groundY);
      skyGrad.addColorStop(0, '#1E1B4B');
      skyGrad.addColorStop(0.4, '#701A75');
      skyGrad.addColorStop(0.7, '#EA580C');
      skyGrad.addColorStop(1, '#FDE047');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, width, groundY);

      // Distant giant golden sun
      ctx.fillStyle = '#FEF08A';
      ctx.beginPath();
      ctx.arc(width * 0.7, groundY - 40, 75, 0, Math.PI * 2);
      ctx.fill();

      // Distant mountain ranges
      ctx.fillStyle = '#4C1D95';
      ctx.beginPath();
      ctx.moveTo(0, groundY);
      ctx.lineTo(width * 0.2, groundY - 80);
      ctx.lineTo(width * 0.45, groundY - 50);
      ctx.lineTo(width * 0.65, groundY - 100);
      ctx.lineTo(width * 0.9, groundY - 60);
      ctx.lineTo(width, groundY);
      ctx.closePath();
      ctx.fill();

      // Asphalt Road
      ctx.fillStyle = '#1E293B';
      ctx.fillRect(0, groundY, width, height - groundY);

      // Moving road lines (dashes scrolling fast to the left to simulate speed)
      ctx.strokeStyle = '#FACC15';
      ctx.lineWidth = 5;
      const roadSpeed = (progress * 18) % 1;
      const dashStep = 80;
      for (let x = -dashStep; x < width + dashStep; x += dashStep) {
        const lineX = x - roadSpeed * dashStep;
        ctx.beginPath();
        ctx.moveTo(lineX, groundY + 35);
        ctx.lineTo(lineX + 45, groundY + 35);
        ctx.stroke();
      }

      // Highway Guardrail
      ctx.strokeStyle = '#94A3B8';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, groundY - 8);
      ctx.lineTo(width, groundY - 8);
      ctx.stroke();

      // Guardrail posts passing by
      const postStep = 100;
      const postSpeed = (progress * 22) % 1;
      ctx.fillStyle = '#64748B';
      for (let x = -postStep; x < width + postStep; x += postStep) {
        const postX = x - postSpeed * postStep;
        ctx.fillRect(postX, groundY - 12, 6, 16);
      }

      // Overhead highway direction sign
      ctx.fillStyle = '#15803D'; // green highway sign
      ctx.fillRect(width * 0.55, 30, 200, 50);
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.strokeRect(width * 0.55, 30, 200, 50);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 12px "Plus Jakarta Sans", sans-serif';
      ctx.fillText('HIGHWAY 101 NORTH ➔', width * 0.55 + 15, 52);
      ctx.font = '10px "Plus Jakarta Sans", sans-serif';
      ctx.fillText('DOWNTOWN • NEXT EXIT', width * 0.55 + 15, 68);
      break;
    }

    case 'city_downtown': {
      // Deep twilight city sky
      ctx.fillStyle = '#090D16';
      ctx.fillRect(0, 0, width, height);

      // Layer 1: Distant dark skyscrapers
      ctx.fillStyle = '#0F172A';
      for (let i = 0; i < 9; i++) {
        const bX = i * (width / 8);
        const bW = width / 9 + 10;
        const bH = 180 + (i % 3) * 60;
        ctx.fillRect(bX, groundY - bH, bW, bH);
      }

      // Layer 2: Foreground skyscrapers with glowing windows
      ctx.fillStyle = '#1E293B';
      const buildingWidths = [120, 160, 110, 180, 130, 150];
      let currX = 20;
      buildingWidths.forEach((bw, idx) => {
        const bh = 220 + (idx % 4) * 50;
        const by = groundY - bh;
        ctx.fillStyle = '#1E293B';
        ctx.fillRect(currX, by, bw, bh);

        // Windows
        ctx.fillStyle = '#FEF08A';
        const cols = Math.floor(bw / 20);
        const rows = Math.floor(bh / 24);
        for (let r = 1; r < rows; r++) {
          for (let c = 1; c < cols; c++) {
            if ((r + c + idx) % 3 === 0) {
              ctx.globalAlpha = 0.8;
              ctx.fillRect(currX + c * 20, by + r * 24, 8, 12);
            }
          }
        }
        ctx.globalAlpha = 1;

        // Animated Neon Signs on rooftop
        if (idx === 1) {
          ctx.fillStyle = '#06B6D4';
          ctx.font = 'bold 13px "JetBrains Mono", monospace';
          ctx.fillText('★ CYBER TOWER ★', currX + 15, by - 10);
        } else if (idx === 3) {
          ctx.fillStyle = '#EC4899';
          ctx.font = 'bold 12px "JetBrains Mono", monospace';
          ctx.fillText('FINANCE PLAZA', currX + 25, by - 10);
        }

        currX += bw + 15;
      });

      // City Street
      ctx.fillStyle = '#111827';
      ctx.fillRect(0, groundY, width, height - groundY);

      // Street lamps
      ctx.strokeStyle = '#94A3B8';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(80, groundY);
      ctx.lineTo(80, groundY - 140);
      ctx.lineTo(110, groundY - 140);
      ctx.stroke();

      // Street lamp glowing cone
      ctx.fillStyle = 'rgba(253, 224, 71, 0.25)';
      ctx.beginPath();
      ctx.moveTo(110, groundY - 140);
      ctx.lineTo(50, groundY);
      ctx.lineTo(170, groundY);
      ctx.closePath();
      ctx.fill();

      // Passing cars in background lane
      const bgCarX = ((progress * 1.5) % 1) * width;
      ctx.fillStyle = '#DC2626';
      ctx.fillRect(bgCarX, groundY - 22, 50, 18);
      // Red taillights
      ctx.fillStyle = '#EF4444';
      ctx.fillRect(bgCarX, groundY - 16, 6, 6);
      // Yellow headlights
      ctx.fillStyle = '#FDE047';
      ctx.fillRect(bgCarX + 44, groundY - 16, 6, 6);
      break;
    }

    case 'police_chase_night': {
      // Midnight dark sky
      ctx.fillStyle = '#05070D';
      ctx.fillRect(0, 0, width, height);

      // Alternating Red and Blue Police Sirens illuminating the entire screen
      const sirenPhase = Math.sin(progress * 25);
      const isRed = sirenPhase > 0;
      const sirenColor = isRed ? 'rgba(239, 68, 68, 0.25)' : 'rgba(59, 130, 246, 0.25)';
      ctx.fillStyle = sirenColor;
      ctx.fillRect(0, 0, width, height);

      // Road
      ctx.fillStyle = '#111827';
      ctx.fillRect(0, groundY, width, height - groundY);

      // High speed road dashes
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 6;
      const dashStep = 70;
      const speedOffset = (progress * 30) % 1;
      for (let x = -dashStep; x < width + dashStep; x += dashStep) {
        const lx = x - speedOffset * dashStep;
        ctx.beginPath();
        ctx.moveTo(lx, groundY + 30);
        ctx.lineTo(lx + 40, groundY + 30);
        ctx.stroke();
      }

      // Police beacon flare in corner
      ctx.fillStyle = isRed ? '#EF4444' : '#3B82F6';
      ctx.font = 'bold 16px "JetBrains Mono", monospace';
      ctx.fillText('🚨 PURSUIT PROTOCOL ACTIVE', width - 280, 45);
      break;
    }

    case 'bank_heist': {
      // Grand Bank Vault & Marble Columns
      ctx.fillStyle = '#0B1120';
      ctx.fillRect(0, 0, width, height);

      // Classical Marble Columns
      ctx.fillStyle = '#334155';
      const colStep = width / 6;
      for (let i = 0; i < 6; i++) {
        const cx = i * colStep + 30;
        ctx.fillRect(cx, 0, 36, groundY);
        // Column capital
        ctx.fillRect(cx - 8, 0, 52, 16);
        ctx.fillRect(cx - 8, groundY - 16, 52, 16);
      }

      // Massive Steel Vault Door in Center
      const vaultX = width * 0.5;
      const vaultY = groundY - 140;
      ctx.fillStyle = '#475569';
      ctx.beginPath();
      ctx.arc(vaultX, vaultY, 110, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#94A3B8';
      ctx.lineWidth = 6;
      ctx.stroke();

      // Vault Wheel mechanism
      ctx.strokeStyle = '#CBD5E1';
      ctx.lineWidth = 8;
      const wheelAngle = progress * 6;
      for (let i = 0; i < 6; i++) {
        const a = wheelAngle + (i / 6) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(vaultX, vaultY);
        ctx.lineTo(vaultX + Math.cos(a) * 65, vaultY + Math.sin(a) * 65);
        ctx.stroke();
      }

      // Red laser security beams sweeping
      const laserY = groundY - 50 + Math.sin(progress * 10) * 35;
      ctx.strokeStyle = '#EF4444';
      ctx.lineWidth = 2.5;
      ctx.shadowColor = '#EF4444';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.moveTo(0, laserY);
      ctx.lineTo(width, laserY);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Marble polished floor
      ctx.fillStyle = '#1E293B';
      ctx.fillRect(0, groundY, width, height - groundY);
      break;
    }

    case 'luxury_penthouse': {
      // Luxury skyscraper interior with glass wall
      ctx.fillStyle = '#090D16';
      ctx.fillRect(0, 0, width, height);

      // Floor-to-ceiling glass wall showing glowing night city
      ctx.fillStyle = '#1E293B';
      for (let i = 0; i < 12; i++) {
        const h = 140 + (i % 4) * 40;
        ctx.fillRect(i * (width / 11), groundY - h, width / 12, h);
      }

      // Glass reflection frame
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 4;
      ctx.strokeRect(40, 30, width - 80, groundY - 30);

      // Polished dark wooden floor
      ctx.fillStyle = '#1C1917';
      ctx.fillRect(0, groundY, width, height - groundY);
      ctx.strokeStyle = '#292524';
      ctx.lineWidth = 2;
      for (let x = 0; x < width; x += 60) {
        ctx.beginPath();
        ctx.moveTo(x, groundY);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      break;
    }

    case 'cyber_highway': {
      // Tron neon wireframe highway
      ctx.fillStyle = '#050510';
      ctx.fillRect(0, 0, width, height);

      // Neon grid horizon
      ctx.strokeStyle = '#06B6D4';
      ctx.lineWidth = 1.5;
      for (let y = groundY; y < height; y += 22) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
      const pX = (progress * 30) % 50;
      for (let x = -50; x < width + 50; x += 50) {
        ctx.beginPath();
        ctx.moveTo(x + pX, groundY);
        ctx.lineTo((x + pX - width / 2) * 2.2 + width / 2, height);
        ctx.stroke();
      }

      // Flying hovercars in sky
      const hoverX = ((progress * 1.8) % 1) * width;
      ctx.fillStyle = '#F43F5E';
      ctx.fillRect(hoverX, groundY - 180, 45, 12);
      ctx.shadowColor = '#F43F5E';
      ctx.shadowBlur = 12;
      ctx.strokeRect(hoverX, groundY - 180, 45, 12);
      ctx.shadowBlur = 0;
      break;
    }

    case 'sketch_grid': {
      ctx.fillStyle = '#FAFAFA';
      ctx.fillRect(0, 0, width, height);
      ctx.strokeStyle = '#E2E8F0';
      ctx.lineWidth = 1;
      const step = 40;
      for (let x = 0; x < width; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
      ctx.strokeStyle = '#1E293B';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, groundY);
      ctx.lineTo(width, groundY);
      ctx.stroke();
      break;
    }

    case 'finance_trading': {
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(0, 0, width, height);
      ctx.strokeStyle = '#1E293B';
      ctx.lineWidth = 1;
      for (let y = 50; y < height; y += 60) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
      const candleCount = 18;
      const candleWidth = width / (candleCount + 4);
      for (let i = 0; i < candleCount; i++) {
        const x = candleWidth * (i + 2);
        const isUp = i % 3 !== 0;
        const candleHeight = 40 + Math.sin(i * 1.5 + progress * 4) * 30;
        const yBase = groundY - 140 - (isUp ? i * 8 : -i * 3);
        ctx.strokeStyle = isUp ? '#22C55E' : '#EF4444';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, yBase - candleHeight - 15);
        ctx.lineTo(x, yBase + 15);
        ctx.stroke();
        ctx.fillStyle = isUp ? '#22C55E' : '#EF4444';
        ctx.fillRect(x - 8, yBase - candleHeight, 16, candleHeight);
      }
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, groundY);
      ctx.lineTo(width, groundY);
      ctx.stroke();
      ctx.fillStyle = '#38BDF8';
      ctx.font = 'bold 16px "JetBrains Mono", monospace';
      ctx.fillText('+248.5% ATH 🚀', width - 160, 40);
      break;
    }

    case 'japanese_dojo': {
      ctx.fillStyle = '#1A1412';
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = '#DC2626';
      ctx.beginPath();
      ctx.arc(width * 0.5, height * 0.35, 120, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#291D17';
      ctx.fillRect(0, groundY, width, height - groundY);
      ctx.strokeStyle = '#D97706';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, groundY);
      ctx.lineTo(width, groundY);
      ctx.stroke();
      ctx.fillStyle = '#1C130E';
      ctx.fillRect(40, 0, 24, height);
      ctx.fillRect(width - 64, 0, 24, height);
      break;
    }

    case 'hacker_den': {
      ctx.fillStyle = '#090D16';
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = '#10B981';
      ctx.font = '12px "JetBrains Mono", monospace';
      for (let i = 0; i < 8; i++) {
        const lineY = 60 + i * 26;
        const text = `const AI_CORE_${i} = async () => compileModel({ iter: ${Math.floor(progress * 1000 + i * 42)} });`;
        ctx.globalAlpha = 0.35 + (i % 2) * 0.2;
        ctx.fillText(text, 50, lineY);
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#1E293B';
      ctx.fillRect(width * 0.3, groundY - 30, width * 0.4, 30);
      ctx.fillRect(width * 0.32, groundY, 12, height - groundY);
      ctx.fillRect(width * 0.66, groundY, 12, height - groundY);
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, groundY);
      ctx.lineTo(width, groundY);
      ctx.stroke();
      break;
    }

    case 'spotlight_dark': {
      ctx.fillStyle = '#050505';
      ctx.fillRect(0, 0, width, height);
      const grad = ctx.createRadialGradient(
        width * 0.5,
        groundY - 100,
        20,
        width * 0.5,
        groundY - 100,
        width * 0.45
      );
      grad.addColorStop(0, 'rgba(255, 255, 255, 0.4)');
      grad.addColorStop(0.5, 'rgba(255, 255, 255, 0.08)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(width * 0.5, 0);
      ctx.lineTo(width * 0.15, groundY);
      ctx.lineTo(width * 0.85, groundY);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.beginPath();
      ctx.ellipse(width * 0.5, groundY, width * 0.25, 25, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case 'street_night': {
      ctx.fillStyle = '#0B0F19';
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = '#111827';
      ctx.fillRect(60, groundY - 260, 100, 260);
      ctx.fillRect(200, groundY - 320, 140, 320);
      ctx.fillRect(380, groundY - 220, 90, 220);
      ctx.fillRect(width - 240, groundY - 300, 120, 300);
      ctx.strokeStyle = '#94A3B8';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(width * 0.18, groundY);
      ctx.lineTo(width * 0.18, groundY - 220);
      ctx.lineTo(width * 0.24, groundY - 220);
      ctx.stroke();
      ctx.fillStyle = '#FDE047';
      ctx.beginPath();
      ctx.arc(width * 0.24, groundY - 220, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1F2937';
      ctx.fillRect(0, groundY, width, height - groundY);
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, groundY);
      ctx.lineTo(width, groundY);
      ctx.stroke();
      break;
    }

    case 'money_vault': {
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = '#EAB308';
      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 3; c++) {
          ctx.fillRect(60 + c * 35, groundY - 20 - r * 22, 30, 18);
        }
      }
      ctx.fillStyle = '#16A34A';
      for (let r = 0; r < 5; r++) {
        ctx.fillRect(width - 150, groundY - 25 - r * 22, 70, 20);
      }
      ctx.strokeStyle = '#E2E8F0';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, groundY);
      ctx.lineTo(width, groundY);
      ctx.stroke();
      break;
    }

    case 'zombie_apocalypse': {
      // Toxic twilight sky over ruined metropolis
      const skyGrad = ctx.createLinearGradient(0, 0, 0, groundY);
      skyGrad.addColorStop(0, '#090D0B');
      skyGrad.addColorStop(0.55, '#1A241E');
      skyGrad.addColorStop(1, '#2D1E18');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, width, height);

      // Blood-orange apocalyptic moon
      ctx.fillStyle = 'rgba(239, 68, 68, 0.28)';
      ctx.beginPath();
      ctx.arc(width * 0.78, height * 0.22, 58, 0, Math.PI * 2);
      ctx.fill();

      // Ruined buildings with jagged rooftops & flickering fires
      const ruins = [
        { x: 40, w: 95, h: 240 },
        { x: 155, w: 120, h: 310 },
        { x: 310, w: 85, h: 190 },
        { x: width - 380, w: 110, h: 280 },
        { x: width - 240, w: 130, h: 330 },
        { x: width - 95, w: 80, h: 210 },
      ];
      for (let i = 0; i < ruins.length; i++) {
        const b = ruins[i];
        ctx.fillStyle = '#111615';
        ctx.fillRect(b.x, groundY - b.h, b.w, b.h);
        for (let wy = groundY - b.h + 25; wy < groundY - 30; wy += 32) {
          for (let wx = b.x + 14; wx < b.x + b.w - 18; wx += 26) {
            const lit = (wx + wy + i) % 7 === 0;
            ctx.fillStyle = lit ? 'rgba(249, 115, 22, 0.45)' : '#090C0B';
            ctx.fillRect(wx, wy, 12, 16);
          }
        }
      }

      // Cracked asphalt ground
      ctx.fillStyle = '#141816';
      ctx.fillRect(0, groundY, width, height - groundY);
      ctx.strokeStyle = '#334139';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, groundY);
      ctx.lineTo(width, groundY);
      ctx.stroke();
      break;
    }

    case 'trillionaire_sandbox': {
      // Golden billionaire metropolis with mega-assets & helipad
      const skyGrad = ctx.createLinearGradient(0, 0, 0, groundY);
      skyGrad.addColorStop(0, '#070B19');
      skyGrad.addColorStop(0.6, '#0F172A');
      skyGrad.addColorStop(1, '#1E293B');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, width, height);

      // Distant glass skyscrapers with golden illumination
      for (let i = 0; i < 8; i++) {
        const bx = 50 + i * (width / 8);
        const bh = 160 + ((i * 53) % 150);
        ctx.fillStyle = '#0F1A2C';
        ctx.fillRect(bx, groundY - bh, 70, bh);
        ctx.strokeStyle = 'rgba(234, 179, 8, 0.35)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(bx, groundY - bh, 70, bh);
      }

      // Luxury marble plaza floor
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(0, groundY, width, height - groundY);
      ctx.strokeStyle = '#F59E0B';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, groundY);
      ctx.lineTo(width, groundY);
      ctx.stroke();
      break;
    }

    case 'bunker_survival': {
      // Underground reinforced steel bunker with radar & supply shelves
      ctx.fillStyle = '#0B0F14';
      ctx.fillRect(0, 0, width, height);

      // Concrete blast walls & steel ribs
      ctx.strokeStyle = '#1E293B';
      ctx.lineWidth = 8;
      for (let x = 80; x < width; x += 180) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, groundY);
        ctx.stroke();
      }

      // Glowing survival radar screen on bunker wall
      const radarX = width * 0.5;
      const radarY = groundY - 195;
      ctx.fillStyle = '#051A14';
      ctx.beginPath();
      ctx.arc(radarX, radarY, 55, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#10B981';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(radarX, radarY, 32, 0, Math.PI * 2);
      ctx.stroke();
      const sweepAngle = progress * Math.PI * 6;
      ctx.beginPath();
      ctx.moveTo(radarX, radarY);
      ctx.lineTo(radarX + Math.cos(sweepAngle) * 52, radarY + Math.sin(sweepAngle) * 52);
      ctx.strokeStyle = '#34D399';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Bunker floor
      ctx.fillStyle = '#111827';
      ctx.fillRect(0, groundY, width, height - groundY);
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, groundY);
      ctx.lineTo(width, groundY);
      ctx.stroke();
      break;
    }

    case 'global_simulation': {
      // World simulation grid with atmospheric curvature & data nodes
      const bg = ctx.createLinearGradient(0, 0, 0, height);
      bg.addColorStop(0, '#040914');
      bg.addColorStop(1, '#0F172A');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, width, height);

      ctx.strokeStyle = 'rgba(56, 189, 248, 0.12)';
      ctx.lineWidth = 1;
      for (let x = 0; x < width; x += 64) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, groundY);
        ctx.stroke();
      }
      for (let y = 40; y < groundY; y += 52) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      ctx.fillStyle = '#091326';
      ctx.fillRect(0, groundY, width, height - groundY);
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, groundY);
      ctx.lineTo(width, groundY);
      ctx.stroke();
      break;
    }

    case 'space_station': {
      // Orbital observation deck overlooking Earth curvature & starfield
      const spaceGrad = ctx.createLinearGradient(0, 0, 0, groundY);
      spaceGrad.addColorStop(0, '#02040A');
      spaceGrad.addColorStop(0.7, '#061024');
      spaceGrad.addColorStop(1, '#0C1E3E');
      ctx.fillStyle = spaceGrad;
      ctx.fillRect(0, 0, width, height);

      // Stars
      ctx.fillStyle = '#E2E8F0';
      for (let i = 0; i < 36; i++) {
        const sx = ((i * 173) % width);
        const sy = ((i * 89) % (groundY - 40));
        ctx.fillRect(sx, sy, i % 3 === 0 ? 2 : 1.2, i % 3 === 0 ? 2 : 1.2);
      }

      // Earth horizon glow outside viewport window
      const planetGrad = ctx.createRadialGradient(
        width * 0.5,
        groundY + 260,
        180,
        width * 0.5,
        groundY + 260,
        420
      );
      planetGrad.addColorStop(0, 'rgba(56, 189, 248, 0.55)');
      planetGrad.addColorStop(0.5, 'rgba(14, 165, 233, 0.18)');
      planetGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = planetGrad;
      ctx.beginPath();
      ctx.arc(width * 0.5, groundY + 260, 420, Math.PI, Math.PI * 2);
      ctx.fill();

      // Reinforced titanium deck floor
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(0, groundY, width, height - groundY);
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(0, groundY);
      ctx.lineTo(width, groundY);
      ctx.stroke();
      break;
    }

    case 'traffic_jam': {
      // Urban rush-hour overpass with multi-lane headlights & smog haze
      const sky = ctx.createLinearGradient(0, 0, 0, groundY);
      sky.addColorStop(0, '#18181B');
      sky.addColorStop(0.6, '#3F3F46');
      sky.addColorStop(1, '#713F12');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, width, groundY);

      // Distant cars queued on highway
      for (let i = 0; i < 8; i++) {
        const cx = 40 + i * (width / 8) + Math.sin(progress * 2 + i) * 4;
        ctx.fillStyle = i % 2 === 0 ? '#1E293B' : '#334155';
        ctx.fillRect(cx, groundY - 26, 54, 22);
        ctx.fillStyle = '#EF4444';
        ctx.fillRect(cx + 2, groundY - 18, 8, 6);
        ctx.fillRect(cx + 44, groundY - 18, 8, 6);
      }

      ctx.fillStyle = '#18181B';
      ctx.fillRect(0, groundY, width, height - groundY);
      break;
    }

    case 'secret_lab': {
      // High-tech containment laboratory with bioluminescent stasis pods
      ctx.fillStyle = '#051016';
      ctx.fillRect(0, 0, width, height);

      for (let i = 0; i < 3; i++) {
        const px = width * (0.24 + i * 0.26);
        const podGrad = ctx.createLinearGradient(px - 28, groundY - 175, px + 28, groundY - 20);
        podGrad.addColorStop(0, 'rgba(6, 182, 212, 0.35)');
        podGrad.addColorStop(1, 'rgba(16, 185, 129, 0.12)');
        ctx.fillStyle = podGrad;
        ctx.fillRect(px - 28, groundY - 175, 56, 155);
        ctx.strokeStyle = '#22D3EE';
        ctx.lineWidth = 2;
        ctx.strokeRect(px - 28, groundY - 175, 56, 155);
      }

      ctx.fillStyle = '#0B1724';
      ctx.fillRect(0, groundY, width, height - groundY);
      break;
    }

    case 'interrogation_room': {
      // Noir concrete interrogation room with overhead pendant lamp & two-way mirror
      ctx.fillStyle = '#0C0F14';
      ctx.fillRect(0, 0, width, height);

      // Two-way mirror on back wall
      ctx.fillStyle = 'rgba(30, 41, 59, 0.65)';
      ctx.fillRect(width * 0.22, groundY - 185, width * 0.56, 110);
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 3;
      ctx.strokeRect(width * 0.22, groundY - 185, width * 0.56, 110);

      // Overhead swinging lamp cone
      const swing = Math.sin(progress * Math.PI * 2) * 18;
      const cone = ctx.createRadialGradient(
        width * 0.5 + swing,
        groundY - 95,
        15,
        width * 0.5 + swing,
        groundY - 95,
        width * 0.38
      );
      cone.addColorStop(0, 'rgba(254, 240, 138, 0.32)');
      cone.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = cone;
      ctx.fillRect(0, 0, width, groundY);

      ctx.fillStyle = '#141820';
      ctx.fillRect(0, groundY, width, height - groundY);
      break;
    }
  }
}

/**
 * Adds realistic tactile ground perspective lines, horizon aerial depth haze,
 * and dynamic specular ground reflections driven by `SceneAnchorMap`.
 */
function drawRealisticGroundAndDepthLayer(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  env: EnvironmentTheme,
  anchors: SceneAnchorMap,
  progress: number,
  elapsedSec: number
) {
  if (env === 'sketch_grid') return;

  const groundY = anchors.groundY;
  const t = elapsedSec > 0 ? elapsedSec : progress * 5;

  ctx.save();

  // 1. Aerial Perspective Horizon Depth Mist (separates background architecture from foreground actors)
  const horizonMist = ctx.createLinearGradient(0, groundY - 95, 0, groundY + 18);
  horizonMist.addColorStop(0, 'rgba(0, 0, 0, 0)');
  horizonMist.addColorStop(0.75, anchors.lightSource.ambientTint);
  horizonMist.addColorStop(1, 'rgba(15, 23, 42, 0.42)');
  ctx.fillStyle = horizonMist;
  ctx.fillRect(0, groundY - 95, width, 113);

  // 2. Ground Plane Depth Gradient & Tactile Perspective Lines
  const groundGrad = ctx.createLinearGradient(0, groundY, 0, height);
  groundGrad.addColorStop(0, 'rgba(15, 23, 42, 0.15)');
  groundGrad.addColorStop(0.35, 'rgba(9, 13, 22, 0.48)');
  groundGrad.addColorStop(1, 'rgba(2, 6, 14, 0.85)');
  ctx.fillStyle = groundGrad;
  ctx.fillRect(0, groundY, width, height - groundY);

  // Perspective pavement / floor seams converging toward horizon center
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.11)';
  ctx.lineWidth = 1;
  const vanishX = width * 0.5;
  const scrollOffset =
    env === 'highway_sunset' || env === 'police_chase_night' || env === 'cyber_highway'
      ? ((t * 120) % 90)
      : 0;

  for (let i = -6; i <= 6; i++) {
    const baseX = vanishX + i * 95 - scrollOffset;
    ctx.beginPath();
    ctx.moveTo(baseX, groundY);
    ctx.lineTo(vanishX + (baseX - vanishX) * 2.35, height);
    ctx.stroke();
  }

  // Horizontal depth strips on the ground plane
  const stripOffsets = [10, 26, 48, 78, 116];
  for (const dy of stripOffsets) {
    if (groundY + dy >= height) continue;
    ctx.beginPath();
    ctx.moveTo(0, groundY + dy);
    ctx.lineTo(width, groundY + dy);
    ctx.stroke();
  }

  // 3. Specular Ground Light Pool below primary light source
  const lightPool = ctx.createRadialGradient(
    anchors.lightSource.x,
    groundY + 18,
    8,
    anchors.lightSource.x,
    groundY + 18,
    width * 0.34
  );
  lightPool.addColorStop(0, anchors.lightSource.ambientTint);
  lightPool.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = lightPool;
  ctx.fillRect(0, groundY, width, height - groundY);

  // Crisp curb / ground rim highlight line
  ctx.strokeStyle = 'rgba(226, 232, 240, 0.22)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, groundY + 1);
  ctx.lineTo(width, groundY + 1);
  ctx.stroke();

  ctx.restore();
}

/**
 * Executes `scene.scenePlan.environmentPlan` weather, atmosphere, and lightingMood
 * directly on the Canvas 2D context (rain + splashes, volumetric fog, crepuscular rays,
 * bioluminescent glow, and foreground depth silhouettes).
 */
function drawAtmosphericRealismLayer(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  scene: StickmanScene,
  anchors: SceneAnchorMap,
  progress: number,
  elapsedSec: number
) {
  const envPlan = scene.scenePlan?.environmentPlan;
  const weather = envPlan?.weatherOrAtmosphere || 'clear';
  const lightingMood = envPlan?.lightingMood || 'neutral';
  const groundY = anchors.groundY;
  const t = elapsedSec > 0 ? elapsedSec : progress * 5;

  ctx.save();

  // 1. Directional Volumetric Lighting Mood (God-rays / Bioluminescence / Cold Noir / Strobe)
  if (lightingMood === 'warm_golden' || scene.environment === 'highway_sunset') {
    const rayGrad = ctx.createLinearGradient(
      anchors.lightSource.x,
      anchors.lightSource.y,
      width * 0.3,
      groundY
    );
    rayGrad.addColorStop(0, 'rgba(253, 224, 71, 0.16)');
    rayGrad.addColorStop(1, 'rgba(251, 146, 60, 0.0)');
    ctx.fillStyle = rayGrad;
    ctx.beginPath();
    ctx.moveTo(anchors.lightSource.x - 40, 0);
    ctx.lineTo(anchors.lightSource.x + 90, 0);
    ctx.lineTo(width * 0.85, groundY);
    ctx.lineTo(width * 0.12, groundY);
    ctx.closePath();
    ctx.fill();
  } else if (lightingMood === 'bioluminescent' || weather === 'neon_haze') {
    const bioGrad = ctx.createRadialGradient(
      anchors.lightSource.x,
      groundY - 90,
      15,
      anchors.lightSource.x,
      groundY - 90,
      width * 0.42
    );
    bioGrad.addColorStop(0, 'rgba(16, 185, 129, 0.14)');
    bioGrad.addColorStop(0.6, 'rgba(6, 182, 212, 0.06)');
    bioGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = bioGrad;
    ctx.fillRect(0, 0, width, height);
  } else if (lightingMood === 'cold_noir' || lightingMood === 'high_contrast') {
    const rimGrad = ctx.createLinearGradient(0, 0, 0, height);
    rimGrad.addColorStop(0, 'rgba(15, 23, 42, 0.24)');
    rimGrad.addColorStop(0.5, 'rgba(0, 0, 0, 0)');
    rimGrad.addColorStop(1, 'rgba(2, 6, 23, 0.32)');
    ctx.fillStyle = rimGrad;
    ctx.fillRect(0, 0, width, height);
  }

  // 2. Weather & Atmospheric Particles
  if (weather === 'rain') {
    ctx.strokeStyle = 'rgba(186, 230, 253, 0.38)';
    ctx.lineWidth = 1.4;
    for (let i = 0; i < 42; i++) {
      const rx = ((i * 97 + t * 240) % (width + 80)) - 40;
      const ry = ((i * 61 + t * 560) % (groundY + 20));
      ctx.beginPath();
      ctx.moveTo(rx, ry);
      ctx.lineTo(rx - 9, ry + 22);
      ctx.stroke();

      // Ground puddle splash ripple
      if (ry > groundY - 18) {
        const rippleR = ((t * 18 + i) % 8) + 2;
        ctx.strokeStyle = 'rgba(186, 230, 253, 0.24)';
        ctx.beginPath();
        ctx.ellipse(rx, groundY + 4 + (i % 3) * 4, rippleR * 1.8, rippleR * 0.45, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  } else if (weather === 'fog' || weather === 'toxic_mist') {
    const mistColor =
      weather === 'toxic_mist'
        ? 'rgba(74, 222, 128, 0.09)'
        : 'rgba(203, 213, 225, 0.09)';
    ctx.fillStyle = mistColor;
    for (let b = 0; b < 3; b++) {
      const bandX = Math.sin(t * 0.35 + b * 1.7) * 45;
      const bandY = groundY - 38 + b * 16;
      ctx.beginPath();
      ctx.ellipse(width * 0.5 + bandX, bandY, width * 0.55, 22 + b * 5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (weather === 'smoke_ash') {
    for (let i = 0; i < 18; i++) {
      const ax = ((i * 113 + Math.sin(t * 1.5 + i) * 28) % width);
      const ay = groundY - ((t * 48 + i * 37) % (groundY * 0.85));
      ctx.fillStyle = i % 3 === 0 ? 'rgba(251, 146, 60, 0.55)' : 'rgba(148, 163, 184, 0.25)';
      ctx.beginPath();
      ctx.arc(ax, ay, i % 3 === 0 ? 2.2 : 3.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();
}

/**
 * Renders a complex, living environmental simulation with autonomous stickman agents ("Pessoas"),
 * explicit goal badges ("Objetivos"), and real-time physical interactions ("Física": gravity drops,
 * barricade impacts, knockback impulses, and real-time simulation counters).
 */
function drawEnvironmentalSimulation(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  theme: EnvironmentTheme,
  elapsedSec: number,
  progress: number,
  protagonistXNorm: number,
  protagonistAction: StickmanAction
) {
  const groundY = height * 0.72;
  const t = elapsedSec > 0 ? elapsedSec : progress * 5.0;

  const isZombieWorld =
    theme === 'zombie_apocalypse' ||
    theme === 'bunker_survival' ||
    protagonistAction === 'zombie_survive_barricade' ||
    protagonistAction === 'scavenge_supplies';

  const isTrillionWorld =
    theme === 'trillionaire_sandbox' ||
    theme === 'money_vault' ||
    theme === 'luxury_penthouse' ||
    protagonistAction === 'trillion_buy_everything';

  ctx.save();

  if (isZombieWorld) {
    // 1. Rescue Helicopter flying in sky + Physical Parachute Supply Crate Drop (Gravity & Ground Bounce)
    const heliX = width * (0.18 + ((t * 0.055) % 0.65));
    const heliY = height * 0.15 + Math.sin(t * 2.2) * 5;

    ctx.save();
    ctx.translate(heliX, heliY);
    ctx.fillStyle = '#334155';
    ctx.beginPath();
    ctx.ellipse(0, 0, 32, 13, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#94A3B8';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-30, 0);
    ctx.lineTo(-62, -6);
    ctx.stroke();
    const rotorSpan = Math.cos(t * 18) * 48;
    ctx.beginPath();
    ctx.moveTo(-rotorSpan, -15);
    ctx.lineTo(rotorSpan, -15);
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Volumetric Searchlight Cone scanning the ground
    const beamGrad = ctx.createLinearGradient(0, 10, 40, groundY - heliY);
    beamGrad.addColorStop(0, 'rgba(253, 224, 71, 0.25)');
    beamGrad.addColorStop(1, 'rgba(253, 224, 71, 0.02)');
    ctx.fillStyle = beamGrad;
    ctx.beginPath();
    ctx.moveTo(-6, 10);
    ctx.lineTo(-45 + Math.sin(t * 0.9) * 30, groundY - heliY);
    ctx.lineTo(55 + Math.sin(t * 0.9) * 30, groundY - heliY);
    ctx.lineTo(6, 10);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Physical Supply Crate dropping under Gravity (y = y0 + 1/2 g t^2 with ground bounce)
    const dropCycle = (t * 0.28) % 1;
    const crateX = width * 0.22;
    let crateY: number;
    let parachuteOpen = true;
    if (dropCycle < 0.72) {
      const fallNorm = dropCycle / 0.72;
      crateY = heliY + 25 + fallNorm * fallNorm * (groundY - heliY - 47);
    } else {
      parachuteOpen = false;
      const bounceT = (dropCycle - 0.72) / 0.28;
      const bounceHeight = Math.abs(Math.sin(bounceT * Math.PI * 2)) * (1 - bounceT) * 18;
      crateY = groundY - 22 - bounceHeight;
    }

    if (parachuteOpen) {
      ctx.strokeStyle = '#CBD5E1';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(crateX - 18, crateY - 28);
      ctx.lineTo(crateX - 8, crateY);
      ctx.moveTo(crateX + 18, crateY - 28);
      ctx.lineTo(crateX + 8, crateY);
      ctx.stroke();
      ctx.fillStyle = '#F97316';
      ctx.beginPath();
      ctx.arc(crateX, crateY - 26, 20, Math.PI, 0);
      ctx.fill();
    }

    ctx.fillStyle = '#D97706';
    ctx.fillRect(crateX - 13, crateY, 26, 22);
    ctx.strokeStyle = '#FEF08A';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(crateX - 13, crateY, 26, 22);
    ctx.fillStyle = '#FEF08A';
    ctx.font = 'bold 9px "Inter", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('📦 SUPRIMENTOS', crateX, crateY - 5);

    // 2. Physical Barricade at Midground Right (x = 0.57 * width) with Impact Physics
    const barricadeX = width * 0.57;
    const zombieHitPulse = Math.max(0, Math.sin(t * 2.6));
    const barricadeShakeX = zombieHitPulse > 0.75 ? Math.sin(t * 30) * 2.5 : 0;

    ctx.save();
    ctx.translate(barricadeX + barricadeShakeX, groundY);
    ctx.fillStyle = '#78350F';
    ctx.fillRect(-14, -68, 12, 68);
    ctx.fillRect(4, -58, 12, 58);
    ctx.save();
    ctx.rotate(-0.22);
    ctx.fillStyle = '#92400E';
    ctx.fillRect(-26, -48, 52, 10);
    ctx.rotate(0.42);
    ctx.fillRect(-26, -30, 52, 10);
    ctx.restore();

    const integrity = Math.max(42, Math.round(88 - progress * 24));
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.fillRect(-44, -92, 88, 16);
    ctx.fillStyle = integrity > 60 ? '#22C55E' : '#F59E0B';
    ctx.fillRect(-42, -90, (84 * integrity) / 100, 12);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 9px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`BARRICADA ${integrity}%`, 0, -81);

    if (zombieHitPulse > 0.7) {
      ctx.fillStyle = '#FBBF24';
      for (let s = 0; s < 4; s++) {
        const sx = -18 - s * 7 * zombieHitPulse;
        const sy = -45 + s * 9 - zombieHitPulse * 12;
        ctx.fillRect(sx, sy, 4, 2);
      }
    }
    ctx.restore();

    // 3. Autonomous Zombie Horde Agents (Right side, shambling toward barricade with knockback physics)
    const zombieConfigs = [
      { baseX: 0.65, speed: 0.025, scale: 0.56, label: '🧟 ZUMBI [INFECTAR]' },
      { baseX: 0.75, speed: 0.019, scale: 0.52, label: '🧟 HORDA [ATAQUE]' },
      { baseX: 0.85, speed: 0.022, scale: 0.54, label: '🧟 INFECTADO' },
    ];
    for (let i = 0; i < zombieConfigs.length; i++) {
      const z = zombieConfigs[i];
      const knockback = i === 0 && zombieHitPulse > 0.75 ? 0.025 : 0;
      const zx = width * (z.baseX - ((t * z.speed) % 0.07) + knockback);
      drawAutonomousMiniAgent(
        ctx,
        zx,
        groundY,
        t + i * 1.7,
        '#4ADE80',
        z.scale,
        true,
        'zombie',
        z.label
      );
    }

    // 4. Autonomous Survivor Agents (Left side, carrying supplies & fortifying shelter)
    const survivorX1 = width * (0.12 + Math.sin(t * 0.45) * 0.05);
    drawAutonomousMiniAgent(
      ctx,
      survivorX1,
      groundY,
      t + 0.8,
      '#38BDF8',
      0.52,
      Math.cos(t * 0.45) < 0,
      'carry_crate',
      '🏃 SOBREVIVENTE [LEVAR ÁGUA]'
    );

    drawSimulationHudBanner(
      ctx,
      20,
      18,
      '🧟 SIMULAÇÃO AMBIENTAL: APOCALIPSE ZUMBI',
      `SOBREVIVENTES: ${Math.max(12, 94 - Math.floor(progress * 35))}%  •  FÍSICA: GRAVIDADE & BARRICADA ATIVA`,
      '#EF4444'
    );
  } else if (isTrillionWorld) {
    // 1. Real-Time 1 Trillion Countdown & Mega-Asset Physics Simulation
    const spentSoFar = Math.floor((progress * 0.35 + (t % 10) * 0.015) * 1_000_000_000_000);
    const remaining = Math.max(0, 1_000_000_000_000 - spentSoFar);
    const formattedRemaining = remaining.toLocaleString('pt-BR');

    drawSimulationHudBanner(
      ctx,
      20,
      18,
      '💎 DESAFIO: GASTAR R$ 1 TRILHÃO EM 30 DIAS (-R$ 385.802 / SEG)',
      `SALDO RESTANTE: R$ ${formattedRemaining}  •  ATIVOS FÍSICOS EM ENTREGA`,
      '#F59E0B'
    );

    // 2. Private Jet soaring across upper sky delivering assets
    const jetX = width * (((t * 0.08) % 1.1) - 0.05);
    const jetY = height * 0.17;
    ctx.save();
    ctx.translate(jetX, jetY);
    ctx.fillStyle = '#F8FAFC';
    ctx.beginPath();
    ctx.moveTo(35, 0);
    ctx.lineTo(-25, -8);
    ctx.lineTo(-32, -20);
    ctx.lineTo(-28, 6);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#F59E0B';
    ctx.font = 'bold 9px "JetBrains Mono", monospace';
    ctx.fillText('✈️ JATO G700 (-R$ 420M)', -45, -24);
    ctx.restore();

    // 3. Physical Mega-Purchases Dropping with Parachute & Ground Bounce
    const assets = [
      { xNorm: 0.18, label: '🏝️ ILHA PRIVADA (-R$ 1.8B)', color: '#10B981', offset: 0 },
      { xNorm: 0.78, label: '🛥️ SUPERIATE (-R$ 950M)', color: '#38BDF8', offset: 1.6 },
    ];
    for (const asset of assets) {
      const cycle = (t * 0.25 + asset.offset) % 1;
      const ax = width * asset.xNorm;
      const bounce =
        cycle < 0.7
          ? (cycle / 0.7) * (groundY - 120)
          : groundY - 120 - Math.abs(Math.sin(((cycle - 0.7) / 0.3) * Math.PI * 2)) * 14;
      const ay = 95 + bounce;

      ctx.fillStyle = '#1E293B';
      ctx.fillRect(ax - 24, ay - 24, 48, 24);
      ctx.strokeStyle = asset.color;
      ctx.lineWidth = 2;
      ctx.strokeRect(ax - 24, ay - 24, 48, 24);

      ctx.fillStyle = asset.color;
      ctx.font = 'bold 9px "Inter", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(asset.label, ax, ay - 30);
    }

    // 4. Autonomous Staff, Engineers & Bankers Moving with Objectives
    const agents = [
      {
        xBase: 0.24,
        speed: 0.035,
        color: '#F59E0B',
        role: 'carry_crate' as const,
        label: '💼 BANQUEIRO [COMPRAR PRÉDIO]',
      },
      {
        xBase: 0.68,
        speed: -0.03,
        color: '#10B981',
        role: 'citizen' as const,
        label: '👷 ENGENHEIRO [CONSTRUIR MANSÃO]',
      },
      {
        xBase: 0.84,
        speed: -0.025,
        color: '#60A5FA',
        role: 'carry_crate' as const,
        label: '📦 ENTREGA [BARRAS DE OURO]',
      },
    ];
    for (let i = 0; i < agents.length; i++) {
      const ag = agents[i];
      const wave = Math.sin(t * 0.55 + i * 2.1) * 0.07;
      const ax = width * (ag.xBase + wave);
      const facingLeft = Math.cos(t * 0.55 + i * 2.1) < 0;
      drawAutonomousMiniAgent(
        ctx,
        ax,
        groundY,
        t + i * 1.3,
        ag.color,
        0.53,
        facingLeft,
        ag.role,
        ag.label
      );
    }
  } else {
    // General Living Environment: Autonomous Background Citizens / Specialists with Objectives & Physics
    const bgAgents = [
      {
        xBase: 0.16,
        color: '#64748B',
        role: 'citizen' as const,
        label: '🎯 AGENTE [MONITORANDO CENÁRIO]',
      },
      {
        xBase: 0.82,
        color: '#475569',
        role: 'carry_crate' as const,
        label: '⚡ EQUIPE [OBJETIVO EM CURSO]',
      },
    ];
    for (let i = 0; i < bgAgents.length; i++) {
      const ag = bgAgents[i];
      const wave = Math.sin(t * 0.42 + i * 2.4) * 0.06;
      const ax = width * (ag.xBase + wave);
      if (Math.abs(ag.xBase + wave - protagonistXNorm) < 0.12) continue;
      const facingLeft = Math.cos(t * 0.42 + i * 2.4) < 0;
      drawAutonomousMiniAgent(
        ctx,
        ax,
        groundY,
        t + i * 1.9,
        ag.color,
        0.48,
        facingLeft,
        ag.role,
        ag.label
      );
    }
  }

  ctx.restore();
}

/**
 * Draws a compact, controlled-physics autonomous stickman in the environment
 * with its own independent walk/shamble cycle, physical prop, and objective tag.
 */
function drawAutonomousMiniAgent(
  ctx: CanvasRenderingContext2D,
  x: number,
  groundY: number,
  timeSec: number,
  color: string,
  scale: number,
  flipHorizontal: boolean,
  role: 'zombie' | 'carry_crate' | 'citizen',
  objectiveLabel: string
) {
  ctx.save();
  ctx.translate(x, groundY);
  ctx.scale(scale, scale);

  // Ground contact shadow under autonomous agent
  ctx.fillStyle = 'rgba(2, 6, 23, 0.34)';
  ctx.beginPath();
  ctx.ellipse(0, 2, 18, 4.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Draw floating objective badge above agent
  ctx.save();
  ctx.font = 'bold 14px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  const badgeW = Math.max(120, ctx.measureText(objectiveLabel).width + 16);
  ctx.fillStyle = 'rgba(15, 23, 42, 0.82)';
  ctx.fillRect(-badgeW / 2, -162, badgeW, 22);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(-badgeW / 2, -162, badgeW, 22);
  ctx.fillStyle = '#F8FAFC';
  ctx.fillText(objectiveLabel, 0, -146);
  ctx.restore();

  if (flipHorizontal) {
    ctx.scale(-1, 1);
  }

  // Biomechanical 2-Bone IK walk/shamble cycle with proximal-to-distal arm lag
  const cadence = role === 'zombie' ? 1.85 : 2.35;
  const cycle = timeSec * cadence;
  const strideSpan = role === 'zombie' ? 16 : 18;
  const liftHeight = role === 'zombie' ? 7 : 10;
  const bobY = Math.abs(Math.cos(cycle)) * 2.4;

  const lean = role === 'zombie' ? 0.26 : role === 'carry_crate' ? 0.14 : 0.08;
  const hipX = Math.sin(lean) * 3;
  const hipY = -56 - bobY;
  const lumbarX = hipX + Math.sin(lean * 0.7) * 22;
  const lumbarY = hipY - Math.cos(lean * 0.7) * 22;
  const neckX = hipX + Math.sin(lean) * 46;
  const neckY = hipY - Math.cos(lean) * 46;
  const headX = neckX + Math.sin(lean) * 13;
  const headY = neckY - 13;

  // Solve 2-Bone IK legs planted on ground plane (y = -1)
  const phaseL = Math.sin(cycle);
  const liftL = Math.max(0, Math.cos(cycle)) * liftHeight;
  const ikLegL = solveTwoBoneIK(hipX - 2, hipY, hipX + phaseL * strideSpan, -1 - liftL, 28, 28, 1);

  const phaseR = Math.sin(cycle + Math.PI);
  const liftR = Math.max(0, Math.cos(cycle + Math.PI)) * liftHeight;
  const ikLegR = solveTwoBoneIK(hipX + 2, hipY, hipX + phaseR * strideSpan, -1 - liftR, 28, 28, 1);

  // Back Leg
  drawTaperedLimbSegment(ctx, hipX - 2, hipY, ikLegL.midX, ikLegL.midY, 5.8, 4.4, color, true);
  drawTaperedLimbSegment(ctx, ikLegL.midX, ikLegL.midY, ikLegL.endX, ikLegL.endY, 4.4, 3.2, color, true);

  // Anatomical S-Spine
  drawTaperedLimbSegment(ctx, hipX, hipY, lumbarX, lumbarY, 6.2, 5.8, color, false);
  drawTaperedLimbSegment(ctx, lumbarX, lumbarY, neckX, neckY, 5.8, 6.4, color, false);

  // Front Leg
  drawTaperedLimbSegment(ctx, hipX + 2, hipY, ikLegR.midX, ikLegR.midY, 6.0, 4.6, color, false);
  drawTaperedLimbSegment(ctx, ikLegR.midX, ikLegR.midY, ikLegR.endX, ikLegR.endY, 4.6, 3.4, color, false);

  // Head
  ctx.fillStyle = '#0F172A';
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(headX, headY, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Articulated 2-Segment Arms based on role (with proximal-to-distal phase lag)
  const shoulderX = neckX;
  const shoulderY = neckY + 6;
  if (role === 'zombie') {
    const reachWave = Math.sin(cycle - 0.25) * 4.5;
    const ikArmL = solveTwoBoneIK(shoulderX, shoulderY, shoulderX + 30, shoulderY + 6 - reachWave, 20, 18, -1);
    const ikArmR = solveTwoBoneIK(shoulderX, shoulderY, shoulderX + 34, shoulderY + 2 + reachWave, 20, 18, -1);
    drawTaperedLimbSegment(ctx, shoulderX, shoulderY, ikArmL.midX, ikArmL.midY, 4.6, 3.6, color, true);
    drawTaperedLimbSegment(ctx, ikArmL.midX, ikArmL.midY, ikArmL.endX, ikArmL.endY, 3.6, 2.8, color, true);
    drawTaperedLimbSegment(ctx, shoulderX, shoulderY, ikArmR.midX, ikArmR.midY, 4.8, 3.8, color, false);
    drawTaperedLimbSegment(ctx, ikArmR.midX, ikArmR.midY, ikArmR.endX, ikArmR.endY, 3.8, 3.0, color, false);
  } else if (role === 'carry_crate') {
    const crateBob = Math.sin(cycle * 2 - 0.2) * 1.8;
    const ikArm = solveTwoBoneIK(shoulderX, shoulderY, shoulderX + 20, shoulderY + 18 + crateBob, 20, 18, -1);
    drawTaperedLimbSegment(ctx, shoulderX, shoulderY, ikArm.midX, ikArm.midY, 4.8, 3.8, color, false);
    drawTaperedLimbSegment(ctx, ikArm.midX, ikArm.midY, ikArm.endX, ikArm.endY, 3.8, 3.0, color, false);
    ctx.fillStyle = '#F59E0B';
    ctx.fillRect(shoulderX + 12, shoulderY + 6 + crateBob, 24, 20);
    ctx.strokeStyle = '#FEF08A';
    ctx.lineWidth = 2;
    ctx.strokeRect(shoulderX + 12, shoulderY + 6 + crateBob, 24, 20);
  } else {
    const armPhaseR = Math.sin(cycle + Math.PI - 0.18) * 15;
    const armPhaseL = Math.sin(cycle - 0.18) * 15;
    const ikArmL = solveTwoBoneIK(shoulderX, shoulderY, shoulderX + armPhaseL, shoulderY + 28, 20, 18, -1);
    const ikArmR = solveTwoBoneIK(shoulderX, shoulderY, shoulderX + armPhaseR, shoulderY + 28, 20, 18, -1);
    drawTaperedLimbSegment(ctx, shoulderX, shoulderY, ikArmL.midX, ikArmL.midY, 4.6, 3.6, color, true);
    drawTaperedLimbSegment(ctx, ikArmL.midX, ikArmL.midY, ikArmL.endX, ikArmL.endY, 3.6, 2.8, color, true);
    drawTaperedLimbSegment(ctx, shoulderX, shoulderY, ikArmR.midX, ikArmR.midY, 4.8, 3.8, color, false);
    drawTaperedLimbSegment(ctx, ikArmR.midX, ikArmR.midY, ikArmR.endX, ikArmR.endY, 3.8, 3.0, color, false);
  }

  ctx.restore();
}

function drawSimulationHudBanner(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  title: string,
  subtitle: string,
  accentColor: string
) {
  ctx.save();
  ctx.fillStyle = 'rgba(9, 13, 22, 0.84)';
  ctx.fillRect(x, y, 470, 42);
  ctx.fillStyle = accentColor;
  ctx.fillRect(x, y, 4, 42);
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, 470, 42);

  ctx.fillStyle = '#F8FAFC';
  ctx.font = 'bold 11px "Inter", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(title, x + 12, y + 16);

  ctx.fillStyle = '#94A3B8';
  ctx.font = '10px "JetBrains Mono", monospace';
  ctx.fillText(subtitle, x + 12, y + 33);
  ctx.restore();
}

/**
 * Renders a full detailed sports car or police interceptor with the stickman driver inside!
 */
function drawVehicleWithDriver(
  ctx: CanvasRenderingContext2D,
  char: SceneCharacter,
  x: number,
  groundY: number,
  progress: number,
  isSpeaking: boolean,
  action: StickmanScene['character1']['action'],
  isPoliceCar: boolean = false,
  maneuver: DynamicManeuver = 'none',
  elapsedSec: number = 0,
  beatProgress: number = 0.5,
  beatIndex: number = 0,
  motionContext?: MotionVariationContext,
  prosodicEnvelope?: ProsodicSpeechEnvelope
) {
  ctx.save();
  ctx.translate(x, groundY);

  // Dynamic suspension pitch, launch squat, and drift angles based on real-time maneuver
  const impulse = Math.sin(beatProgress * Math.PI);
  if (maneuver === 'drift_left' || maneuver === 'car_handbrake_drift') {
    ctx.rotate(-0.11 - impulse * 0.04);
  } else if (maneuver === 'drift_right') {
    ctx.rotate(0.11 + impulse * 0.04);
  } else if (maneuver === 'nitro_boost' || maneuver === 'car_accelerate_surge') {
    ctx.rotate(-0.05 - impulse * 0.03); // nose lifts under V8 torque
  } else if (maneuver === 'swerve_dodge' || maneuver === 'car_lane_swerve') {
    ctx.rotate(Math.sin(elapsedSec * 7.5) * 0.08);
  }

  const carLength = 230;
  const carHeight = 70;
  const wheelRadius = 24;
  const wheelBaseY = 2;

  // Multi-harmonic suspension bounce
  const bounceY =
    Math.sin((elapsedSec || progress * 5) * 14) * 1.6 +
    Math.cos((elapsedSec || progress * 5) * 23) * 0.8;
  ctx.translate(0, bounceY);

  // 1. Draw Dual Exhaust Flames (Nitro) if chasing, drifting or nitro boost
  const hasNitro =
    action === 'car_chase' ||
    action === 'car_drift' ||
    maneuver === 'nitro_boost' ||
    maneuver === 'car_accelerate_surge';
  if (hasNitro) {
    const isNitroBoost = maneuver === 'nitro_boost' || maneuver === 'car_accelerate_surge';
    const flameLen = (isNitroBoost ? 85 : 50) + Math.sin(progress * 35) * 25;
    ctx.save();

    // Twin exhaust pipes (upper and lower)
    for (const pipeY of [-14, -20]) {
      // Inner Plasma Core
      ctx.fillStyle = isNitroBoost ? '#C084FC' : '#67E8F9';
      ctx.beginPath();
      ctx.moveTo(-110, pipeY - 3);
      ctx.lineTo(-110 - flameLen * 0.7, pipeY);
      ctx.lineTo(-110, pipeY + 3);
      ctx.fill();

      // Outer Fiery Jet
      ctx.fillStyle = isNitroBoost ? '#EC4899' : '#3B82F6';
      ctx.beginPath();
      ctx.moveTo(-110, pipeY - 6);
      ctx.lineTo(-110 - flameLen, pipeY);
      ctx.lineTo(-110, pipeY + 6);
      ctx.fill();

      // Ember Particles spitting back
      ctx.fillStyle = '#FDE047';
      for (let p = 0; p < 4; p++) {
        const emberX = -110 - flameLen - ((progress * 180 + p * 25) % 50);
        const emberY = pipeY + Math.sin(progress * 40 + p) * 8;
        ctx.fillRect(emberX, emberY, 2.5, 2.5);
      }
    }
    ctx.restore();
  }

  // Tire Smoke & Skid Sparks during Drifts and Hard Turns
  const isDrifting =
    action === 'car_drift' ||
    maneuver === 'car_handbrake_drift' ||
    maneuver === 'drift_left' ||
    maneuver === 'drift_right';
  if (isDrifting) {
    ctx.save();
    // Billowy smoke clouds puffing out from rear wheel
    for (let s = 0; s < 5; s++) {
      const smokeProgress = (progress * 8 + s * 0.2) % 1;
      const smokeX = -68 - smokeProgress * 80;
      const smokeY = wheelBaseY - smokeProgress * 25 - Math.sin(s * 1.5) * 6;
      const smokeR = 12 + smokeProgress * 22;
      const alpha = Math.max(0, 0.45 * (1 - smokeProgress));
      ctx.fillStyle = `rgba(241, 245, 249, ${alpha})`;
      ctx.beginPath();
      ctx.arc(smokeX, smokeY, smokeR, 0, Math.PI * 2);
      ctx.fill();
    }
    // Friction asphalt sparks
    ctx.fillStyle = '#FBBF24';
    for (let sp = 0; sp < 6; sp++) {
      const sparkX = -68 - Math.sin(progress * 60 + sp * 2) * 45;
      const sparkY = wheelBaseY + Math.cos(progress * 45 + sp) * 4;
      ctx.fillRect(sparkX, sparkY, 3, 3);
    }
    ctx.restore();
  }

  // 2. Draw Stickman Driver SEATED inside cockpit
  ctx.save();
  ctx.translate(0, -carHeight * 0.4);
  drawCharacter(
    ctx,
    char,
    -10, // driver seat position
    0,
    progress,
    isSpeaking,
    false,
    600,
    maneuver,
    beatProgress,
    elapsedSec,
    beatIndex,
    undefined,
    1,
    0,
    motionContext,
    undefined,
    prosodicEnvelope,
    1
  );

  // Steering wheel in hands
  ctx.strokeStyle = '#1E293B';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(28, -25, 14, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // 3. Draw Sleek Car Body (over the stickman's lower body)
  ctx.save();
  const carGrad = ctx.createLinearGradient(-100, -carHeight, 120, 0);
  if (isPoliceCar) {
    carGrad.addColorStop(0, '#0F172A'); // black rear
    carGrad.addColorStop(0.5, '#F8FAFC'); // white door
    carGrad.addColorStop(1, '#0F172A'); // black hood
  } else {
    // Luxury Sports Car (Vibrant Red or Cyber Cyan)
    const primaryColor = char.color === '#DC2626' ? '#DC2626' : '#2563EB';
    carGrad.addColorStop(0, '#0F172A');
    carGrad.addColorStop(0.3, primaryColor);
    carGrad.addColorStop(0.8, '#60A5FA');
    carGrad.addColorStop(1, '#1D4ED8');
  }

  ctx.fillStyle = carGrad;
  ctx.strokeStyle = '#0F172A';
  ctx.lineWidth = 4;

  // Aerodynamic chassis contour
  ctx.beginPath();
  ctx.moveTo(-105, -12); // rear bumper
  ctx.lineTo(-105, -34); // rear wing
  ctx.lineTo(-90, -42); // rear boot
  ctx.lineTo(-50, -42); // rear deck
  ctx.lineTo(-30, -carHeight - 12); // rear windshield
  ctx.lineTo(25, -carHeight - 12); // roof
  ctx.lineTo(55, -38); // front windshield slope
  ctx.lineTo(115, -28); // hood front nose
  ctx.lineTo(125, -10); // front bumper
  ctx.lineTo(95, -10); // front wheel arch right
  ctx.arc(72, -10, wheelRadius + 4, 0, Math.PI, true); // front wheel arch
  ctx.lineTo(-45, -10); // underbody
  ctx.arc(-68, -10, wheelRadius + 4, 0, Math.PI, true); // rear wheel arch
  ctx.lineTo(-105, -10);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Windshield Glass reflection
  ctx.fillStyle = 'rgba(56, 189, 248, 0.45)';
  ctx.beginPath();
  ctx.moveTo(-25, -carHeight - 8);
  ctx.lineTo(22, -carHeight - 8);
  ctx.lineTo(50, -40);
  ctx.lineTo(-5, -40);
  ctx.closePath();
  ctx.fill();

  // Police Siren Light Bar & Ground Strobe Reflections
  if (isPoliceCar) {
    const isSirenRed = Math.sin(progress * 25) > 0;
    ctx.fillStyle = isSirenRed ? '#EF4444' : '#3B82F6';
    ctx.fillRect(-5, -carHeight - 24, 25, 10);
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = 18;
    ctx.strokeRect(-5, -carHeight - 24, 25, 10);
    ctx.shadowBlur = 0;

    // Road strobe ground reflection
    ctx.fillStyle = isSirenRed ? 'rgba(239, 68, 68, 0.22)' : 'rgba(59, 130, 246, 0.22)';
    ctx.beginPath();
    ctx.ellipse(0, wheelBaseY + 6, 160, 22, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Headlight Light Cone (beaming forward on the road)
  ctx.fillStyle = 'rgba(253, 224, 71, 0.35)';
  ctx.beginPath();
  ctx.moveTo(125, -20);
  ctx.lineTo(260, -60);
  ctx.lineTo(260, 40);
  ctx.closePath();
  ctx.fill();

  // Front Headlight Lens
  ctx.fillStyle = '#FEF08A';
  ctx.beginPath();
  ctx.ellipse(118, -20, 5, 8, 0, 0, Math.PI * 2);
  ctx.fill();

  // Rear Taillight Lens
  ctx.fillStyle = '#EF4444';
  ctx.fillRect(-105, -28, 6, 12);

  // 4. Draw Rotating Wheels with Chrome Rims & Spokes
  const wheelSpinAngle = progress * 40;
  drawWheel(ctx, -68, wheelBaseY - 10, wheelRadius, wheelSpinAngle);
  drawWheel(ctx, 72, wheelBaseY - 10, wheelRadius, wheelSpinAngle);

  ctx.restore();
  ctx.restore();
}

function drawWheel(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  angle: number
) {
  ctx.save();
  ctx.translate(cx, cy);

  // Outer black tire
  ctx.fillStyle = '#0F172A';
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();

  // Rim outer circle
  ctx.strokeStyle = '#94A3B8';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.72, 0, Math.PI * 2);
  ctx.stroke();

  // Inner hub
  ctx.fillStyle = '#E2E8F0';
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.25, 0, Math.PI * 2);
  ctx.fill();

  // Spinning alloy spokes
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 2.5;
  for (let i = 0; i < 5; i++) {
    const a = angle + (i / 5) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(a) * r * 0.7, Math.sin(a) * r * 0.7);
    ctx.stroke();
  }

  ctx.restore();
}

function drawSpeedLines(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  progress: number
) {
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.lineWidth = 2;
  const numLines = 26;
  const centerX = width * 0.5;
  const centerY = height * 0.58;
  const innerRadius = 130;
  const outerRadius = Math.max(width, height);

  for (let i = 0; i < numLines; i++) {
    const angle = (i / numLines) * Math.PI * 2 + progress * 2.5;
    const lenJitter = Math.sin(i * 3 + progress * 12) * 45;
    const x1 = centerX + Math.cos(angle) * (innerRadius + lenJitter);
    const y1 = centerY + Math.sin(angle) * (innerRadius + lenJitter);
    const x2 = centerX + Math.cos(angle) * outerRadius;
    const y2 = centerY + Math.sin(angle) * outerRadius;

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawTaperedLimbSegment(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  widthStart: number,
  widthEnd: number,
  color: string,
  isBackLimb: boolean = false
) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  if (len < 0.5) return;

  const nx = -dy / len;
  const ny = dx / len;
  const r1 = widthStart * 0.5;
  const r2 = widthEnd * 0.5;

  ctx.save();
  if (isBackLimb) {
    ctx.globalAlpha = 0.82;
  }

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x1 + nx * r1, y1 + ny * r1);
  ctx.lineTo(x2 + nx * r2, y2 + ny * r2);
  ctx.arc(x2, y2, r2, Math.atan2(ny, nx), Math.atan2(-ny, -nx), false);
  ctx.lineTo(x1 - nx * r1, y1 - ny * r1);
  ctx.arc(x1, y1, r1, Math.atan2(-ny, -nx), Math.atan2(ny, nx), false);
  ctx.closePath();
  ctx.fill();

  // Subtle volumetric rim-light highlight along the upper/front edge of front limbs
  if (!isBackLimb) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(x1 + nx * (r1 * 0.65), y1 + ny * (r1 * 0.65));
    ctx.lineTo(x2 + nx * (r2 * 0.65), y2 + ny * (r2 * 0.65));
    ctx.stroke();
  }

  ctx.restore();
}

function drawCharacter(
  ctx: CanvasRenderingContext2D,
  char: SceneCharacter,
  x: number,
  groundY: number,
  progress: number,
  isSpeaking: boolean,
  flipX: boolean,
  viewHeight: number,
  maneuver: DynamicManeuver = 'none',
  beatProgress: number = 0,
  elapsedSec?: number,
  beatIndex: number = 0,
  prevAction?: StickmanAction,
  transitionBlend: number = 1,
  velocityX: number = 0,
  motionContext?: MotionVariationContext,
  sceneAnchors?: SceneAnchorMap,
  prosodicEnvelope?: ProsodicSpeechEnvelope,
  facingCos: number = 1,
  worldStage?: ConstructedWorldStage
) {
  ctx.save();
  ctx.translate(x, groundY);

  // Calculate current target limb angles with independent multi-harmonic oscillators and deterministic motionContext
  const targetAngles = calculateLimbAngles(
    char.action,
    progress,
    isSpeaking,
    elapsedSec,
    beatProgress,
    maneuver,
    beatIndex,
    motionContext
  );

  // Smoothly blend from previous beat's pose during beat transition so limbs flow organically
  let angles = targetAngles;
  if (prevAction && prevAction !== char.action && transitionBlend < 1) {
    const fromAngles = calculateLimbAngles(
      prevAction,
      progress,
      isSpeaking,
      elapsedSec,
      1.0,
      'none',
      Math.max(0, beatIndex - 1),
      motionContext
    );
    angles = blendLimbAngles(fromAngles, targetAngles, transitionBlend);
  }

  // Optional 2-Bone IK hand target toward nearby environmental anchor or moving 2.5D military truck
  let handTargetLocal: { x: number; y: number; blend: number; hand?: 'left' | 'right' } | undefined;
  if (worldStage?.soldierOverride.active && worldStage.soldierOverride.handIKTargetWorld) {
    const ikW = worldStage.soldierOverride.handIKTargetWorld;
    const worldDx = ikW.x - x;
    const worldDy = ikW.y - groundY;
    handTargetLocal = {
      x: (flipX ? -worldDx : worldDx) * 0.65,
      y: Math.max(-88, Math.min(-18, worldDy)),
      blend: ikW.blend,
      hand: ikW.hand,
    };
  } else if (sceneAnchors?.interactionAnchor) {
    const worldDx = sceneAnchors.interactionAnchor.x - x;
    const worldDy = sceneAnchors.interactionAnchor.y - groundY;
    const distToAnchor = Math.hypot(worldDx, worldDy);
    const isInteractiveAction =
      char.action === 'zombie_survive_barricade' ||
      char.action === 'work_computer' ||
      char.action === 'scavenge_supplies' ||
      char.action === 'command_crowd';

    if (isInteractiveAction && distToAnchor < 145) {
      const localX = (flipX ? -worldDx : worldDx) * 0.45;
      const localY = Math.max(-72, Math.min(-24, worldDy));
      const proximityBlend = Math.max(0, Math.min(0.65, (1 - distToAnchor / 145) * 0.65));
      handTargetLocal = {
        x: localX,
        y: localY,
        blend: proximityBlend,
        hand: 'right',
      };
    }
  }

  const pose = resolveBiomechanicalHumanPose(
    angles,
    char.action,
    progress,
    elapsedSec,
    beatProgress,
    velocityX,
    motionContext,
    handTargetLocal,
    prosodicEnvelope,
    facingCos
  );

  // 1. Dynamic Ground Ambient Occlusion & Planted Foot Shadows (drawn before flip/acrobatic rotation)
  const isSeatedVehicle =
    char.action === 'drive_car' ||
    char.action === 'car_chase' ||
    char.action === 'car_drift' ||
    char.action === 'car_police';
  if (!isSeatedVehicle) {
    const elevation = Math.max(0, -angles.verticalOffset);
    const shadowScale = Math.max(0.45, 1 - elevation / 65);
    const shadowAlpha = Math.max(0.14, 0.36 * shadowScale);

    ctx.save();
    ctx.fillStyle = `rgba(2, 6, 23, ${shadowAlpha})`;
    ctx.beginPath();
    ctx.ellipse(0, 3, 26 * shadowScale, 6.5 * shadowScale, 0, 0, Math.PI * 2);
    ctx.fill();

    const signX = flipX ? -1 : 1;
    if (pose.leftLeg.planted) {
      ctx.fillStyle = 'rgba(2, 6, 23, 0.42)';
      ctx.beginPath();
      ctx.ellipse(pose.leftLeg.ankleX * signX, 2, 8, 2.8, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    if (pose.rightLeg.planted) {
      ctx.fillStyle = 'rgba(2, 6, 23, 0.42)';
      ctx.beginPath();
      ctx.ellipse(pose.rightLeg.ankleX * signX, 2, 8, 2.8, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  if (flipX) {
    ctx.scale(-1, 1);
  }

  // Dynamic acrobatic rotations and physical maneuvers
  if (maneuver === 'backflip' || maneuver === 'backflip_celebrate') {
    ctx.translate(0, -60);
    ctx.rotate(beatProgress * Math.PI * 2);
    ctx.translate(0, 60);
  } else if (maneuver === 'spin_360' || maneuver === 'combat_combo_rush') {
    ctx.translate(0, -60);
    ctx.rotate(-beatProgress * Math.PI * 2);
    ctx.translate(0, 60);
  } else if (maneuver === 'slide_kick' || maneuver === 'dodge_slide') {
    const slideTilt = Math.sin(beatProgress * Math.PI) * 0.34;
    ctx.rotate(slideTilt);
  } else if (maneuver === 'stumble' || maneuver === 'jump_shock') {
    ctx.rotate(Math.sin(beatProgress * Math.PI * 3) * 0.16);
  }

  const scale = char.scale || (viewHeight > 700 ? 1.15 : 1.0);
  ctx.scale(scale, scale);

  const color = char.color || '#0F172A';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = color;
  ctx.fillStyle = color;

  // 2. Back Leg (Left Leg) — Tapered Thigh -> Calf -> Foot with depth shading
  drawTaperedLimbSegment(
    ctx,
    pose.leftHipX,
    pose.leftHipY,
    pose.leftLeg.kneeX,
    pose.leftLeg.kneeY,
    7.2,
    5.4,
    color,
    true
  );
  drawTaperedLimbSegment(
    ctx,
    pose.leftLeg.kneeX,
    pose.leftLeg.kneeY,
    pose.leftLeg.ankleX,
    pose.leftLeg.ankleY,
    5.4,
    3.8,
    color,
    true
  );
  drawTaperedLimbSegment(
    ctx,
    pose.leftLeg.ankleX,
    pose.leftLeg.ankleY,
    pose.leftLeg.toeX,
    pose.leftLeg.toeY,
    4.2,
    3.0,
    color,
    true
  );

  // 3. Back Arm (Left Arm) — Tapered Upper Arm -> Forearm -> Hand
  drawTaperedLimbSegment(
    ctx,
    pose.leftShoulderX,
    pose.leftShoulderY,
    pose.leftArm.elbowX,
    pose.leftArm.elbowY,
    6.0,
    4.6,
    color,
    true
  );
  drawTaperedLimbSegment(
    ctx,
    pose.leftArm.elbowX,
    pose.leftArm.elbowY,
    pose.leftArm.wristX,
    pose.leftArm.wristY,
    4.6,
    3.5,
    color,
    true
  );
  drawTaperedLimbSegment(
    ctx,
    pose.leftArm.wristX,
    pose.leftArm.wristY,
    pose.leftArm.handX,
    pose.leftArm.handY,
    3.8,
    2.8,
    color,
    true
  );
  // Left Hand articulated thumb & finger silhouette
  drawTaperedLimbSegment(
    ctx,
    pose.leftArm.wristX,
    pose.leftArm.wristY,
    pose.leftArm.thumbX,
    pose.leftArm.thumbY,
    2.4,
    1.6,
    color,
    true
  );
  drawTaperedLimbSegment(
    ctx,
    pose.leftArm.handX,
    pose.leftArm.handY,
    pose.leftArm.fingerX,
    pose.leftArm.fingerY,
    2.4,
    1.5,
    color,
    true
  );

  // 4. Anatomical Pelvis, 3-Segment S-Curve Torso & Clavicle Shoulder Girdle
  drawTaperedLimbSegment(
    ctx,
    pose.leftHipX,
    pose.leftHipY,
    pose.rightHipX,
    pose.rightHipY,
    5.5,
    5.5,
    color,
    false
  );
  drawTaperedLimbSegment(
    ctx,
    pose.pelvisX,
    pose.pelvisY,
    pose.lumbarX,
    pose.lumbarY,
    6.8,
    6.4,
    color,
    false
  );
  drawTaperedLimbSegment(
    ctx,
    pose.lumbarX,
    pose.lumbarY,
    pose.thoraxX,
    pose.thoraxY,
    6.4,
    7.4 + pose.chestBreath * 0.25,
    color,
    false
  );
  drawTaperedLimbSegment(
    ctx,
    pose.thoraxX,
    pose.thoraxY,
    pose.neckX,
    pose.neckY,
    7.2,
    5.2,
    color,
    false
  );
  drawTaperedLimbSegment(
    ctx,
    pose.leftShoulderX,
    pose.leftShoulderY,
    pose.rightShoulderX,
    pose.rightShoulderY,
    5.6,
    5.6,
    color,
    false
  );

  // 5. Front Leg (Right Leg) — Tapered Thigh -> Calf -> Foot with rim highlight
  drawTaperedLimbSegment(
    ctx,
    pose.rightHipX,
    pose.rightHipY,
    pose.rightLeg.kneeX,
    pose.rightLeg.kneeY,
    7.4,
    5.5,
    color,
    false
  );
  drawTaperedLimbSegment(
    ctx,
    pose.rightLeg.kneeX,
    pose.rightLeg.kneeY,
    pose.rightLeg.ankleX,
    pose.rightLeg.ankleY,
    5.5,
    3.9,
    color,
    false
  );
  drawTaperedLimbSegment(
    ctx,
    pose.rightLeg.ankleX,
    pose.rightLeg.ankleY,
    pose.rightLeg.toeX,
    pose.rightLeg.toeY,
    4.4,
    3.2,
    color,
    false
  );

  // 6. Front Arm (Right Arm) — Tapered Upper Arm -> Forearm -> Hand & Articulated Fingers
  drawTaperedLimbSegment(
    ctx,
    pose.rightShoulderX,
    pose.rightShoulderY,
    pose.rightArm.elbowX,
    pose.rightArm.elbowY,
    6.2,
    4.8,
    color,
    false
  );
  drawTaperedLimbSegment(
    ctx,
    pose.rightArm.elbowX,
    pose.rightArm.elbowY,
    pose.rightArm.wristX,
    pose.rightArm.wristY,
    4.8,
    3.6,
    color,
    false
  );
  drawTaperedLimbSegment(
    ctx,
    pose.rightArm.wristX,
    pose.rightArm.wristY,
    pose.rightArm.handX,
    pose.rightArm.handY,
    4.0,
    3.0,
    color,
    false
  );
  drawTaperedLimbSegment(
    ctx,
    pose.rightArm.wristX,
    pose.rightArm.wristY,
    pose.rightArm.thumbX,
    pose.rightArm.thumbY,
    2.6,
    1.7,
    color,
    false
  );
  drawTaperedLimbSegment(
    ctx,
    pose.rightArm.handX,
    pose.rightArm.handY,
    pose.rightArm.fingerX,
    pose.rightArm.fingerY,
    2.6,
    1.6,
    color,
    false
  );

  // Subtle anatomical joint articulation highlights (knee, elbow, wrist, shoulder)
  ctx.save();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
  for (const [jx, jy, jr] of [
    [pose.rightShoulderX, pose.rightShoulderY, 2.2],
    [pose.rightArm.elbowX, pose.rightArm.elbowY, 1.8],
    [pose.rightArm.wristX, pose.rightArm.wristY, 1.5],
    [pose.rightLeg.kneeX, pose.rightLeg.kneeY, 2.0],
    [pose.rightLeg.ankleX, pose.rightLeg.ankleY, 1.6],
  ]) {
    ctx.beginPath();
    ctx.arc(jx, jy, jr, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  const handLX = pose.leftArm.handX;
  const handLY = pose.leftArm.handY;
  const handRX = pose.rightArm.handX;
  const handRY = pose.rightArm.handY;
  const wristAngleR = pose.rightArm.wristAngle;

  // 7. Props in Hands
  if (char.prop === 'sword' || char.action === 'sword_duel') {
    ctx.save();
    ctx.lineWidth = 6;
    ctx.strokeStyle = color === '#DC2626' ? '#EF4444' : '#38BDF8';
    ctx.shadowColor = ctx.strokeStyle;
    ctx.shadowBlur = 15;
    const swordAngle = wristAngleR - 0.65;
    ctx.beginPath();
    ctx.moveTo(handRX, handRY);
    ctx.lineTo(handRX + Math.sin(swordAngle) * 72, handRY - Math.cos(swordAngle) * 72);
    ctx.stroke();
    ctx.restore();
  } else if (char.prop === 'laptop' || char.action === 'work_computer') {
    ctx.fillStyle = '#64748B';
    ctx.fillRect(handRX - 15, handRY + 5, 40, 6);
    ctx.fillStyle = '#06B6D4';
    ctx.fillRect(handRX + 10, handRY - 25, 6, 30);
  } else if (char.prop === 'money' || char.action === 'money_celebrate') {
    ctx.fillStyle = '#22C55E';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText('💰', handLX - 25, handLY - 10);
    ctx.fillText('💵', handRX + 10, handRY - 15);
  } else if (char.prop === 'coffee') {
    ctx.fillStyle = '#EA580C';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText('☕', handRX + 5, handRY);
  } else if (char.prop === 'briefcase' || char.action === 'walk_city') {
    ctx.fillStyle = '#475569';
    ctx.fillRect(handRX - 8, handRY + 4, 18, 14);
    ctx.strokeStyle = '#94A3B8';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(handRX - 8, handRY + 4, 18, 14);
  } else if (char.prop === 'shield' || char.action === 'zombie_survive_barricade') {
    ctx.save();
    ctx.fillStyle = '#1E293B';
    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(handLX - 8, handLY - 18, 14, 34, 4);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  // 8. Head with cervical neck link & dynamic secondary scarf physics
  const headRadius = 18;
  const headCenterX = pose.headCenterX;
  const headCenterY = pose.headCenterY;

  drawTaperedLimbSegment(
    ctx,
    pose.neckX,
    pose.neckY,
    headCenterX,
    headCenterY + headRadius * 0.65,
    4.6,
    4.2,
    color,
    false
  );

  const phaseSec = elapsedSec !== undefined ? elapsedSec : progress * 5;
  const windDrag = Math.min(28, Math.max(-28, -velocityX * 65));
  const wave1 = Math.sin(phaseSec * 9.5) * 9;
  const wave2 = Math.cos(phaseSec * 12.2) * 13;

  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 3.5;
  ctx.globalAlpha = 0.78;
  ctx.beginPath();
  ctx.moveTo(pose.neckX - 4, pose.neckY + 3);
  ctx.quadraticCurveTo(
    pose.neckX - 20 + windDrag * 0.5,
    pose.neckY + 5 + wave1,
    pose.neckX - 38 + windDrag,
    pose.neckY + 9 + wave2
  );
  ctx.stroke();
  ctx.restore();

  // Stylized Head Sphere with subtle 3D inner shading
  ctx.save();
  ctx.lineWidth = 4.8;
  ctx.strokeStyle = color;
  const headGrad = ctx.createRadialGradient(
    headCenterX + 4,
    headCenterY - 5,
    3,
    headCenterX,
    headCenterY,
    headRadius
  );
  headGrad.addColorStop(0, '#FFFFFF');
  headGrad.addColorStop(0.82, '#F8FAFC');
  headGrad.addColorStop(1, '#E2E8F0');
  ctx.fillStyle = headGrad;
  ctx.beginPath();
  ctx.arc(headCenterX, headCenterY, headRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // 9. Expressive Human Face with Gaze Tracking, Brow Musculature & Prosodic Lip-Sync
  drawFace(
    ctx,
    headCenterX,
    headCenterY,
    char.expression,
    isSpeaking,
    progress,
    velocityX,
    pose.headTilt,
    prosodicEnvelope
  );

  // 10. Coherent Tactical Equipment Rig (M1 Steel Helmet, FEB Field Pack, Webbing, M1 Garand Rifle & Muzzle Flash)
  renderSoldierTacticalEquipment(
    ctx,
    pose,
    char,
    phaseSec,
    Boolean(worldStage?.isConstructedWarWorld),
    Boolean(worldStage?.soldierOverride.isFiringRifle || char.action === 'trench_cover_fire')
  );

  ctx.restore();
}

function drawFace(
  ctx: CanvasRenderingContext2D,
  headX: number,
  headY: number,
  expression: SceneCharacter['expression'],
  isSpeaking: boolean,
  progress: number,
  velocityX: number = 0,
  headTilt: number = 0,
  prosodicEnvelope?: ProsodicSpeechEnvelope
) {
  ctx.save();
  ctx.fillStyle = '#0F172A';
  ctx.strokeStyle = '#0F172A';
  ctx.lineWidth = 2.2;
  ctx.lineCap = 'round';

  // Subtle pupil gaze shift following motion & head tilt
  const gazeX = Math.max(-2.2, Math.min(2.2, velocityX * 14 + headTilt * 4));
  const gazeY = Math.max(-1.5, Math.min(1.5, headTilt * 3));

  const eyeOffsetX = 5 + gazeX * 0.45;
  const eyeY = headY - 2 + gazeY * 0.35;
  const leftEyeX = headX + eyeOffsetX - 3.5;
  const rightEyeX = headX + eyeOffsetX + 4.8;

  // Natural periodic blink (~every 3.5s)
  const isBlinking = Math.sin(progress * 26 + 0.7) > 0.955;

  const activeProsody =
    isSpeaking && prosodicEnvelope && !prosodicEnvelope.isBreathPause
      ? prosodicEnvelope.syllablePulse * (0.65 + prosodicEnvelope.emphasisBoost * 0.55)
      : 0;

  // 1. Expressive Eyebrow Musculature
  ctx.save();
  ctx.lineWidth = 2.1;
  if (expression === 'angry' || expression === 'intense' || expression === 'determined') {
    const furrow = expression === 'angry' ? 3.2 : 2.1;
    ctx.beginPath();
    ctx.moveTo(leftEyeX - 3.5, eyeY - 5.5);
    ctx.lineTo(leftEyeX + 2.2, eyeY - 5.5 + furrow);
    ctx.moveTo(rightEyeX + 3.5, eyeY - 5.5);
    ctx.lineTo(rightEyeX - 2.2, eyeY - 5.5 + furrow);
    ctx.stroke();
  } else if (expression === 'shocked') {
    ctx.beginPath();
    ctx.arc(leftEyeX, eyeY - 4.8, 3.6, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(rightEyeX, eyeY - 4.8, 3.6, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();
  } else if (expression === 'sad') {
    ctx.beginPath();
    ctx.moveTo(leftEyeX - 3.5, eyeY - 3.2);
    ctx.lineTo(leftEyeX + 2.2, eyeY - 5.8);
    ctx.moveTo(rightEyeX + 3.5, eyeY - 3.2);
    ctx.lineTo(rightEyeX - 2.2, eyeY - 5.8);
    ctx.stroke();
  } else {
    // Calm / Confident / Talking subtle brow arch synchronized with syllable prosody
    const speakLift = isSpeaking
      ? prosodicEnvelope
        ? activeProsody * 1.35
        : Math.sin(progress * 18) * 0.8
      : 0;
    ctx.beginPath();
    ctx.moveTo(leftEyeX - 3, eyeY - 4.8 - speakLift);
    ctx.lineTo(leftEyeX + 2, eyeY - 5.2 - speakLift);
    ctx.moveTo(rightEyeX - 2, eyeY - 5.2 - speakLift);
    ctx.lineTo(rightEyeX + 3, eyeY - 4.8 - speakLift);
    ctx.stroke();
  }
  ctx.restore();

  // 2. Eyes & Pupils
  if (expression === 'laughing') {
    ctx.beginPath();
    ctx.arc(leftEyeX, eyeY, 2.8, Math.PI, 0);
    ctx.arc(rightEyeX, eyeY, 2.8, Math.PI, 0);
    ctx.stroke();
  } else if (isBlinking && expression !== 'shocked') {
    ctx.beginPath();
    ctx.moveTo(leftEyeX - 2.8, eyeY);
    ctx.lineTo(leftEyeX + 2.4, eyeY);
    ctx.moveTo(rightEyeX - 2.4, eyeY);
    ctx.lineTo(rightEyeX + 2.8, eyeY);
    ctx.stroke();
  } else {
    const eyeRadius = expression === 'shocked' ? 3.2 : 2.3;
    ctx.beginPath();
    ctx.arc(leftEyeX, eyeY, eyeRadius, 0, Math.PI * 2);
    ctx.arc(rightEyeX, eyeY, eyeRadius, 0, Math.PI * 2);
    ctx.fill();

    // Specular eye catchlight for lifelike expression
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(leftEyeX + 0.7, eyeY - 0.7, 0.85, 0, Math.PI * 2);
    ctx.arc(rightEyeX + 0.7, eyeY - 0.7, 0.85, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0F172A';
  }

  // 3. Mouth & Prosodic Phoneme Articulation
  const mouthX = headX + eyeOffsetX + 0.8;
  const mouthY = headY + 6.8;

  if (isSpeaking && (!prosodicEnvelope || !prosodicEnvelope.isBreathPause)) {
    // Prosodic syllable-synchronized jaw & lip aperture (pauses naturally during punctuation breath breaks)
    const syllableOpen = prosodicEnvelope
      ? Math.max(0.9, activeProsody * 4.4 + 0.7)
      : Math.abs(Math.sin(progress * 24) * 0.7 + Math.cos(progress * 39) * 0.3) * 4.8 + 1.1;
    const mouthWidth = prosodicEnvelope
      ? 3.2 + prosodicEnvelope.syllablePulse * 1.4
      : 3.6 + Math.sin(progress * 17) * 1.1;
    ctx.beginPath();
    ctx.ellipse(mouthX, mouthY, mouthWidth, syllableOpen, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    switch (expression) {
      case 'shocked':
        ctx.beginPath();
        ctx.ellipse(mouthX, mouthY + 1, 3.8, 4.6, 0, 0, Math.PI * 2);
        ctx.stroke();
        break;
      case 'angry':
      case 'intense':
      case 'determined':
        ctx.beginPath();
        ctx.moveTo(mouthX - 4.8, mouthY + 0.8);
        ctx.lineTo(mouthX + 4.8, mouthY - 0.4);
        ctx.stroke();
        break;
      case 'sad':
        ctx.beginPath();
        ctx.arc(mouthX, mouthY + 3.5, 4.5, Math.PI * 1.15, Math.PI * 1.85);
        ctx.stroke();
        break;
      case 'smile':
      case 'confident':
        ctx.beginPath();
        ctx.arc(mouthX, mouthY - 1.5, 5.4, 0.12 * Math.PI, 0.88 * Math.PI);
        ctx.stroke();
        break;
      case 'laughing':
        ctx.beginPath();
        ctx.arc(mouthX, mouthY - 1, 5.6, 0, Math.PI);
        ctx.fill();
        break;
      case 'talking':
      default:
        ctx.beginPath();
        ctx.moveTo(mouthX - 3.5, mouthY);
        ctx.lineTo(mouthX + 4.2, mouthY);
        ctx.stroke();
        break;
    }
  }

  ctx.restore();
}

function drawImpactEffects(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  progress: number
) {
  const flashT = (progress * 6) % 1;
  if (flashT < 0.45) {
    ctx.save();
    ctx.translate(x, y);

    // 1. Expanding Shockwave Ring
    const ringRadius = 15 + flashT * 70;
    const ringAlpha = Math.max(0, 0.7 * (1 - flashT / 0.45));
    ctx.strokeStyle = `rgba(250, 204, 21, ${ringAlpha})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, ringRadius, 0, Math.PI * 2);
    ctx.stroke();

    // 2. High-speed Slash Cut Arc
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 4;
    ctx.shadowColor = '#38BDF8';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.moveTo(-45, -35);
    ctx.lineTo(45, 35);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // 3. Golden Starburst Spokes
    ctx.strokeStyle = '#FACC15';
    ctx.lineWidth = 2.5;
    const spokes = 10;
    for (let i = 0; i < spokes; i++) {
      const angle = (i / spokes) * Math.PI * 2 + progress * 8;
      const len = 20 + Math.sin(i * 3 + flashT * 12) * 25;
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * 8, Math.sin(angle) * 8);
      ctx.lineTo(Math.cos(angle) * len, Math.sin(angle) * len);
      ctx.stroke();
    }
    ctx.restore();
  }
}

function drawKineticSubtitles(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  narration: string,
  progress: number,
  highlightWords?: string[],
  wpm: number = 155
) {
  if (!narration || narration.trim() === '') return;

  const words = narration.trim().split(/\s+/);
  if (words.length === 0) return;

  const activeWordIdx = getActiveWordIndexAtProgress(narration, progress, wpm);

  const chunkSize = 4;
  const chunkStart = Math.max(
    0,
    Math.min(
      words.length - chunkSize,
      Math.floor(activeWordIdx / chunkSize) * chunkSize
    )
  );
  const visibleWords = words.slice(chunkStart, chunkStart + chunkSize);

  ctx.save();

  const subY = height * 0.88;
  const fontSize = width < 600 ? 24 : 32;
  ctx.font = `900 ${fontSize}px "Plus Jakarta Sans", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const WORD_GAP = width < 600 ? 16 : 22;

  const wordWidths = visibleWords.map((w) => ctx.measureText(w.toUpperCase()).width);
  const totalWordsWidth = wordWidths.reduce((a, b) => a + b, 0);
  const totalChunkWidth = totalWordsWidth + (visibleWords.length - 1) * WORD_GAP;

  let currentX = width / 2 - totalChunkWidth / 2;

  visibleWords.forEach((word, idx) => {
    const globalIdx = chunkStart + idx;
    const isActive = globalIdx === activeWordIdx;
    const isHighlight =
      highlightWords &&
      highlightWords.some((hw) => word.toLowerCase().includes(hw.toLowerCase()));

    const wordW = wordWidths[idx];
    const wordCenterX = currentX + wordW / 2;

    ctx.save();
    ctx.translate(wordCenterX, subY);

    if (isActive) {
      const scale = 1.25;
      ctx.scale(scale, scale);
    }

    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 7;
    ctx.lineJoin = 'round';
    ctx.miterLimit = 2;
    ctx.strokeText(word.toUpperCase(), 0, 0);

    if (isActive) {
      ctx.fillStyle = '#FACC15';
    } else if (isHighlight) {
      ctx.fillStyle = '#4ADE80';
    } else {
      ctx.fillStyle = '#FFFFFF';
    }
    ctx.fillText(word.toUpperCase(), 0, 0);

    ctx.restore();

    currentX += wordW + WORD_GAP;
  });

  ctx.restore();
}

const FLOATING_ICON_MAP: Record<FloatingVfxIcon, string> = {
  none: '',
  exclamation: '❗',
  question: '❓',
  lightbulb: '💡',
  money_bag: '💰',
  fire: '🔥',
  skull: '💀',
  chart_up: '📈',
  chart_down: '📉',
  target: '🎯',
  lightning: '⚡',
  coffee: '☕',
  heart: '❤️',
};

export function drawFloatingIcon(
  ctx: CanvasRenderingContext2D,
  icon: FloatingVfxIcon,
  x: number,
  y: number,
  progress: number
) {
  const emoji = FLOATING_ICON_MAP[icon];
  if (!emoji) return;

  const bounce = Math.sin(progress * Math.PI * 4) * 8;
  const currentY = y + bounce;

  ctx.save();
  ctx.translate(x, currentY);

  // Glow halo
  const glow = ctx.createRadialGradient(0, 0, 8, 0, 0, 28);
  glow.addColorStop(0, 'rgba(255, 255, 255, 0.4)');
  glow.addColorStop(0.5, 'rgba(56, 189, 248, 0.25)');
  glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, 28, 0, Math.PI * 2);
  ctx.fill();

  // Glass backing bubble
  ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, 20, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Icon emoji
  ctx.font = '22px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(emoji, 0, 1);

  ctx.restore();
}

export function drawVisualFilter(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  filter: VisualFilter,
  progress: number
) {
  if (filter === 'none') return;

  switch (filter) {
    case 'cinemascope': {
      // 2.35:1 Letterbox Bars at top and bottom
      const barH = height * 0.085;
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, width, barH);
      ctx.fillRect(0, height - barH, width, barH);
      break;
    }
    case 'vignette': {
      // Cinematic radial corner shadow
      const maxRadius = Math.sqrt(width * width + height * height) / 2;
      const grad = ctx.createRadialGradient(
        width / 2,
        height / 2,
        width * 0.25,
        width / 2,
        height / 2,
        maxRadius
      );
      grad.addColorStop(0, 'rgba(0, 0, 0, 0)');
      grad.addColorStop(0.65, 'rgba(0, 0, 0, 0.35)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0.85)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);
      break;
    }
    case 'crt_cyber': {
      // Cyber scanlines
      ctx.save();
      ctx.fillStyle = 'rgba(0, 255, 200, 0.03)';
      for (let y = 0; y < height; y += 4) {
        ctx.fillRect(0, y, width, 1.5);
      }
      ctx.restore();
      break;
    }
    case 'film_grain': {
      // Film grain particles
      ctx.save();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
      const seed = Math.floor(progress * 100);
      for (let i = 0; i < 60; i++) {
        const px = ((seed * (i + 1) * 37) % 1000) / 1000 * width;
        const py = ((seed * (i + 3) * 73) % 1000) / 1000 * height;
        ctx.fillRect(px, py, 2, 2);
      }
      ctx.restore();
      break;
    }
    case 'money_rain': {
      // Falling currency dollars
      ctx.save();
      ctx.font = '20px sans-serif';
      ctx.fillStyle = '#4ADE80';
      for (let i = 0; i < 16; i++) {
        const itemX = ((i * 137) % width);
        const speed = 150 + (i % 5) * 40;
        const itemY = ((progress * speed * 2 + i * 40) % (height + 50)) - 30;
        ctx.fillText(i % 2 === 0 ? '💵' : '💰', itemX, itemY);
      }
      ctx.restore();
      break;
    }
    case 'fire_sparks': {
      // Rising ember sparks
      ctx.save();
      for (let i = 0; i < 24; i++) {
        const sparkX = ((i * 97) % width) + Math.sin(progress * 10 + i) * 15;
        const speed = 180 + (i % 6) * 35;
        const sparkY = height - ((progress * speed * 2 + i * 30) % height);
        ctx.fillStyle = i % 2 === 0 ? '#FB923C' : '#FBBF24';
        ctx.beginPath();
        ctx.arc(sparkX, sparkY, 2.5 + (i % 3), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      break;
    }
  }
}

