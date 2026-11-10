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
  MotionVariationContext,
} from './stickmanMath';
import { resolveActiveBeatState } from './choreographyEngine';

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

  ctx.save();
  const activeCamera = beatState.effectiveCamera || scene.cameraEffect;
  const camera = calculateCameraTransform(activeCamera, sceneProgress);
  const effectiveZoom = Math.max(0.85, camera.zoom + (beatState.framingZoomOffset || 0));
  const centerX = width / 2;
  const centerY = height / 2;

  ctx.translate(centerX + camera.offsetX, centerY + camera.offsetY);
  ctx.scale(effectiveZoom, effectiveZoom);
  ctx.translate(-centerX, -centerY);

  // 1. Draw Rich Background Environment
  drawEnvironment(ctx, width, height, scene.environment, sceneProgress);

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

  if (isHighSpeed) {
    drawSpeedLines(ctx, width, height, sceneProgress);
  }

  // 3. Draw Characters & Vehicles with Fluid Multi-Harmonic Kinematics
  const groundY = height * 0.72;
  const isVehicleAction =
    beatState.effectiveAction1 === 'drive_car' ||
    beatState.effectiveAction1 === 'car_chase' ||
    beatState.effectiveAction1 === 'car_drift';

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
      motionCtx1
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
    // Standard Character 1 with loose multi-joint kinematics, pose blending, and acrobatic maneuvers
    const char1X = width * beatState.char1XNorm;
    const char1Y = groundY + beatState.jumpOffsetY;

    drawCharacter(
      ctx,
      effectiveChar1,
      char1X,
      char1Y,
      sceneProgress,
      isSpeaking,
      beatState.flipChar1,
      height,
      beatState.maneuver,
      beatState.beatProgress,
      beatState.elapsedInSceneSec,
      beatState.beatIndex,
      beatState.prevAction1,
      beatState.transitionBlend,
      beatState.velocityX,
      motionCtx1
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
        }
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
  }
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

  // Controlled walk cycle
  const cycle = timeSec * 2.4;
  const stepL = Math.sin(cycle) * 0.48;
  const stepR = -stepL;
  const bobY = Math.abs(Math.sin(cycle)) * 3;

  ctx.translate(0, -bobY);
  ctx.strokeStyle = color;
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const lean = role === 'zombie' ? 0.28 : 0.08;
  const hipX = 0;
  const hipY = -52;
  const neckX = Math.sin(lean) * 48;
  const neckY = hipY - Math.cos(lean) * 48;
  const headX = neckX + Math.sin(lean) * 14;
  const headY = neckY - 14;

  // Legs
  ctx.beginPath();
  ctx.moveTo(hipX, hipY);
  ctx.lineTo(hipX + Math.sin(stepL) * 26, 0);
  ctx.moveTo(hipX, hipY);
  ctx.lineTo(hipX + Math.sin(stepR) * 26, 0);
  ctx.stroke();

  // Spine
  ctx.beginPath();
  ctx.moveTo(hipX, hipY);
  ctx.lineTo(neckX, neckY);
  ctx.stroke();

  // Head
  ctx.fillStyle = '#0F172A';
  ctx.beginPath();
  ctx.arc(headX, headY, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Arms based on role
  if (role === 'zombie') {
    const reachWave = Math.sin(cycle * 0.8) * 5;
    ctx.beginPath();
    ctx.moveTo(neckX, neckY + 6);
    ctx.lineTo(neckX + 34, neckY + 4 + reachWave);
    ctx.moveTo(neckX, neckY + 10);
    ctx.lineTo(neckX + 30, neckY + 14 - reachWave);
    ctx.stroke();
  } else if (role === 'carry_crate') {
    ctx.beginPath();
    ctx.moveTo(neckX, neckY + 6);
    ctx.lineTo(neckX + 22, neckY + 22);
    ctx.stroke();
    ctx.fillStyle = '#F59E0B';
    ctx.fillRect(neckX + 12, neckY + 8, 24, 20);
    ctx.strokeStyle = '#FEF08A';
    ctx.lineWidth = 2;
    ctx.strokeRect(neckX + 12, neckY + 8, 24, 20);
  } else {
    ctx.beginPath();
    ctx.moveTo(neckX, neckY + 6);
    ctx.lineTo(neckX + Math.sin(stepR) * 20, neckY + 32);
    ctx.moveTo(neckX, neckY + 6);
    ctx.lineTo(neckX + Math.sin(stepL) * 20, neckY + 32);
    ctx.stroke();
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
  motionContext?: MotionVariationContext
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
    motionContext
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
  motionContext?: MotionVariationContext
) {
  ctx.save();
  ctx.translate(x, groundY);
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

  const color = char.color || '#0F172A';

  ctx.lineWidth = 5.5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = color;
  ctx.fillStyle = color;

  const hipY = -75 + angles.verticalOffset;
  const spineLength = 55;
  const neckX = Math.sin(angles.bodyLean) * spineLength;
  const neckY = hipY - Math.cos(angles.bodyLean) * spineLength - (angles.shoulderShrug || 0);

  // Mid-spine control point for flexible curved rubber-hose torso
  const spineCurveOffset = (angles.spineCurve || 0) * 28;
  const midSpineX = neckX * 0.5 + spineCurveOffset;
  const midSpineY = (hipY + neckY) * 0.5;

  // Articulated 3-segment Legs (Thigh -> Shin -> Ankle/Foot)
  const legLenUpper = 38;
  const legLenLower = 38;
  const footLen = 11;

  const kneeLX = Math.sin(angles.leftLegUpper) * legLenUpper;
  const kneeLY = hipY + Math.cos(angles.leftLegUpper) * legLenUpper;
  const footLX = kneeLX + Math.sin(angles.leftLegUpper + angles.leftLegLower) * legLenLower;
  const footLY = kneeLY + Math.cos(angles.leftLegUpper + angles.leftLegLower) * legLenLower;
  const ankleAngleL =
    angles.leftLegUpper + angles.leftLegLower + 1.35 + (angles.leftAnkleFlex || 0);
  const toeLX = footLX + Math.sin(ankleAngleL) * footLen;
  const toeLY = footLY + Math.cos(ankleAngleL) * footLen;

  ctx.beginPath();
  ctx.moveTo(0, hipY);
  ctx.lineTo(kneeLX, kneeLY);
  ctx.lineTo(footLX, footLY);
  ctx.lineTo(toeLX, toeLY);
  ctx.stroke();

  const kneeRX = Math.sin(angles.rightLegUpper) * legLenUpper;
  const kneeRY = hipY + Math.cos(angles.rightLegUpper) * legLenUpper;
  const footRX = kneeRX + Math.sin(angles.rightLegUpper + angles.rightLegLower) * legLenLower;
  const footRY = kneeRY + Math.cos(angles.rightLegUpper + angles.rightLegLower) * legLenLower;
  const ankleAngleR =
    angles.rightLegUpper + angles.rightLegLower + 1.35 + (angles.rightAnkleFlex || 0);
  const toeRX = footRX + Math.sin(ankleAngleR) * footLen;
  const toeRY = footRY + Math.cos(ankleAngleR) * footLen;

  ctx.beginPath();
  ctx.moveTo(0, hipY);
  ctx.lineTo(kneeRX, kneeRY);
  ctx.lineTo(footRX, footRY);
  ctx.lineTo(toeRX, toeRY);
  ctx.stroke();

  // Flexible Curved Torso Spine
  ctx.beginPath();
  ctx.moveTo(0, hipY);
  ctx.quadraticCurveTo(midSpineX, midSpineY, neckX, neckY);
  ctx.stroke();

  // Articulated 3-segment Arms (Upper Arm -> Forearm -> Loose Wrist/Hand)
  const shoulderX = neckX;
  const shoulderY = neckY + 9;
  const armLenUpper = 32;
  const armLenLower = 28;
  const handLen = 9;

  const elbowLX = shoulderX + Math.sin(angles.leftArmUpper) * armLenUpper;
  const elbowLY = shoulderY + Math.cos(angles.leftArmUpper) * armLenUpper;
  const wristLX = elbowLX + Math.sin(angles.leftArmUpper + angles.leftArmLower) * armLenLower;
  const wristLY = elbowLY + Math.cos(angles.leftArmUpper + angles.leftArmLower) * armLenLower;
  const wristAngleL =
    angles.leftArmUpper + angles.leftArmLower + (angles.leftWristFlex || 0);
  const handLX = wristLX + Math.sin(wristAngleL) * handLen;
  const handLY = wristLY + Math.cos(wristAngleL) * handLen;

  ctx.beginPath();
  ctx.moveTo(shoulderX, shoulderY);
  ctx.lineTo(elbowLX, elbowLY);
  ctx.lineTo(wristLX, wristLY);
  ctx.lineTo(handLX, handLY);
  ctx.stroke();

  const elbowRX = shoulderX + Math.sin(angles.rightArmUpper) * armLenUpper;
  const elbowRY = shoulderY + Math.cos(angles.rightArmUpper) * armLenUpper;
  const wristRX = elbowRX + Math.sin(angles.rightArmUpper + angles.rightArmLower) * armLenLower;
  const wristRY = elbowRY + Math.cos(angles.rightArmUpper + angles.rightArmLower) * armLenLower;
  const wristAngleR =
    angles.rightArmUpper + angles.rightArmLower + (angles.rightWristFlex || 0);
  const handRX = wristRX + Math.sin(wristAngleR) * handLen;
  const handRY = wristRY + Math.cos(wristAngleR) * handLen;

  ctx.beginPath();
  ctx.moveTo(shoulderX, shoulderY);
  ctx.lineTo(elbowRX, elbowRY);
  ctx.lineTo(wristRX, wristRY);
  ctx.lineTo(handRX, handRY);
  ctx.stroke();

  // Props
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
  }

  // Head with independent headTilt & headBob
  const headRadius = 18;
  const headCenterX =
    neckX + Math.sin(angles.bodyLean + (angles.headTilt || 0)) * 16;
  const headCenterY = neckY - headRadius + angles.headBob;

  // Dynamic Flowing Scarf / Action Ribbon trailing behind neck/head (gives loose secondary physics!)
  const phaseSec = elapsedSec !== undefined ? elapsedSec : progress * 5;
  const windDrag = Math.min(28, Math.max(-28, -velocityX * 65));
  const wave1 = Math.sin(phaseSec * 9.5) * 9;
  const wave2 = Math.cos(phaseSec * 12.2) * 13;

  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 3.5;
  ctx.globalAlpha = 0.78;
  ctx.beginPath();
  ctx.moveTo(neckX - 4, neckY + 3);
  ctx.quadraticCurveTo(
    neckX - 20 + windDrag * 0.5,
    neckY + 5 + wave1,
    neckX - 38 + windDrag,
    neckY + 9 + wave2
  );
  ctx.stroke();
  ctx.restore();

  ctx.beginPath();
  ctx.arc(headCenterX, headCenterY, headRadius, 0, Math.PI * 2);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  ctx.stroke();

  // Face
  drawFace(ctx, headCenterX, headCenterY, char.expression, isSpeaking, progress);

  ctx.restore();
}

function drawFace(
  ctx: CanvasRenderingContext2D,
  headX: number,
  headY: number,
  expression: SceneCharacter['expression'],
  isSpeaking: boolean,
  progress: number
) {
  ctx.save();
  ctx.fillStyle = '#0F172A';
  ctx.strokeStyle = '#0F172A';
  ctx.lineWidth = 2.5;

  const eyeOffsetX = 5;
  const eyeY = headY - 2;

  switch (expression) {
    case 'shocked': {
      ctx.beginPath();
      ctx.arc(headX + eyeOffsetX - 4, eyeY, 3.5, 0, Math.PI * 2);
      ctx.arc(headX + eyeOffsetX + 5, eyeY, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(headX + eyeOffsetX, headY + 8, 5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#38BDF8';
      ctx.font = '14px sans-serif';
      ctx.fillText('💦', headX + 16, headY - 10);
      break;
    }

    case 'angry': {
      ctx.beginPath();
      ctx.moveTo(headX + eyeOffsetX - 8, eyeY - 5);
      ctx.lineTo(headX + eyeOffsetX - 1, eyeY - 2);
      ctx.moveTo(headX + eyeOffsetX + 8, eyeY - 5);
      ctx.lineTo(headX + eyeOffsetX + 1, eyeY - 2);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(headX + eyeOffsetX - 4, eyeY + 1, 2, 0, Math.PI * 2);
      ctx.arc(headX + eyeOffsetX + 4, eyeY + 1, 2, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(headX + eyeOffsetX - 6, headY + 7);
      ctx.lineTo(headX + eyeOffsetX + 6, headY + 7);
      ctx.stroke();
      break;
    }

    case 'smile':
    case 'confident': {
      ctx.beginPath();
      ctx.arc(headX + eyeOffsetX - 3, eyeY, 2, 0, Math.PI * 2);
      ctx.arc(headX + eyeOffsetX + 5, eyeY, 2, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.arc(headX + eyeOffsetX + 1, headY + 5, 6, 0.1 * Math.PI, 0.9 * Math.PI);
      ctx.stroke();
      break;
    }

    case 'laughing': {
      ctx.beginPath();
      ctx.arc(headX + eyeOffsetX - 3, eyeY, 3, Math.PI, 0);
      ctx.arc(headX + eyeOffsetX + 5, eyeY, 3, Math.PI, 0);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(headX + eyeOffsetX + 1, headY + 6, 6, 0, Math.PI);
      ctx.fill();
      break;
    }

    case 'talking':
    default: {
      const isBlinking = Math.sin(progress * 25) > 0.95;
      if (!isBlinking) {
        ctx.beginPath();
        ctx.arc(headX + eyeOffsetX - 3, eyeY, 2.2, 0, Math.PI * 2);
        ctx.arc(headX + eyeOffsetX + 5, eyeY, 2.2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.moveTo(headX + eyeOffsetX - 6, eyeY);
        ctx.lineTo(headX + eyeOffsetX - 1, eyeY);
        ctx.moveTo(headX + eyeOffsetX + 3, eyeY);
        ctx.lineTo(headX + eyeOffsetX + 8, eyeY);
        ctx.stroke();
      }

      if (isSpeaking) {
        const mouthOpen = Math.abs(Math.sin(progress * 24)) * 5 + 1;
        ctx.beginPath();
        ctx.ellipse(headX + eyeOffsetX + 1, headY + 7, 4, mouthOpen, 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.moveTo(headX + eyeOffsetX - 3, headY + 7);
        ctx.lineTo(headX + eyeOffsetX + 5, headY + 7);
        ctx.stroke();
      }
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

