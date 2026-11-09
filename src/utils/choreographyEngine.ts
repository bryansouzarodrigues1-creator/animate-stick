import {
  StickmanScene,
  ChoreographyBeat,
  StickmanAction,
  StickmanExpression,
  DynamicManeuver,
  SceneCharacter,
  CameraEffect,
  FloatingVfxIcon,
} from '../types/stickman';

export interface ActiveBeatFrameState {
  beatIndex: number;
  totalBeats: number;
  beat: ChoreographyBeat;
  beatProgress: number; // [0..1] within this specific beat
  transitionBlend: number; // [0..1] blend factor from previous beat action at beat start
  elapsedInSceneSec: number;
  char1XNorm: number; // interpolated [0.12 .. 0.88]
  char2XNorm: number; // interpolated [0.12 .. 0.88]
  velocityX: number; // horizontal velocity for ribbon/body inertia
  jumpOffsetY: number; // px (negative is up)
  char2JumpOffsetY: number;
  flipChar1: boolean;
  flipChar2: boolean;
  effectiveAction1: StickmanAction;
  prevAction1: StickmanAction;
  effectiveAction2: StickmanAction;
  effectiveExpression1: StickmanExpression;
  effectiveProp1: SceneCharacter['prop'];
  maneuver: DynamicManeuver;
  effectiveCamera: CameraEffect;
  effectiveIcon: FloatingVfxIcon;
}

interface ChoreographyVariation {
  act: StickmanAction;
  exp: StickmanExpression;
  man: DynamicManeuver;
  tx: number;
  c2x?: number;
  jmp: number;
  prp?: SceneCharacter['prop'];
  lbl: string;
  cam: CameraEffect;
  ico: FloatingVfxIcon;
}

/**
 * Rich non-repeating pools of physical actions so consecutive beats NEVER repeat
 * the same posture, maneuver, or spatial trajectory.
 */
const VEHICLE_VARIATIONS: ChoreographyVariation[] = [
  {
    act: 'drive_car',
    exp: 'confident',
    man: 'car_accelerate_surge',
    tx: 0.54,
    c2x: 0.18,
    jmp: -8,
    prp: 'steering_wheel',
    lbl: '🏎️ Arrancada Biturbo & Chassi Empinando',
    cam: 'zoom_in',
    ico: 'fire',
  },
  {
    act: 'car_drift',
    exp: 'determined',
    man: 'car_handbrake_drift',
    tx: 0.42,
    c2x: 0.22,
    jmp: 0,
    prp: 'steering_wheel',
    lbl: '💨 Puxada de Freio de Mão & Drift 40°',
    cam: 'shake',
    ico: 'fire',
  },
  {
    act: 'car_chase',
    exp: 'intense',
    man: 'car_lane_swerve',
    tx: 0.68,
    c2x: 0.30,
    jmp: -12,
    prp: 'steering_wheel',
    lbl: '🛣️ Contra-Esterço & Costurando Faixas',
    cam: 'pan_right',
    ico: 'lightning',
  },
  {
    act: 'car_chase',
    exp: 'angry',
    man: 'police_ram_sparks',
    tx: 0.58,
    c2x: 0.38,
    jmp: -6,
    prp: 'steering_wheel',
    lbl: '🚨 Impacto Lateral & Faíscas no Asfalto',
    cam: 'shake',
    ico: 'exclamation',
  },
  {
    act: 'drive_car',
    exp: 'laughing',
    man: 'nitro_boost',
    tx: 0.76,
    c2x: 0.20,
    jmp: -16,
    prp: 'steering_wheel',
    lbl: '🔥 Disparo de Nitro Duplo & Salto de Pista',
    cam: 'pulse',
    ico: 'fire',
  },
  {
    act: 'car_drift',
    exp: 'confident',
    man: 'drift_right',
    tx: 0.48,
    c2x: 0.26,
    jmp: 0,
    prp: 'steering_wheel',
    lbl: '🌀 Tangência de Curva & Pneu Cantando',
    cam: 'zoom_in',
    ico: 'target',
  },
  {
    act: 'car_chase',
    exp: 'shocked',
    man: 'helicopter_searchlight',
    tx: 0.64,
    c2x: 0.34,
    jmp: -10,
    prp: 'steering_wheel',
    lbl: '🚁 Fuga sob Holofote Aéreo em Alta Rotação',
    cam: 'pan_right',
    ico: 'skull',
  },
];

const COMBAT_VARIATIONS: ChoreographyVariation[] = [
  {
    act: 'running',
    exp: 'determined',
    man: 'sprint_across',
    tx: 0.43,
    c2x: 0.57,
    jmp: 0,
    lbl: '🏃 Investida Explosiva & Passo Rasante',
    cam: 'zoom_in',
    ico: 'lightning',
  },
  {
    act: 'fight_kungfu',
    exp: 'angry',
    man: 'combat_combo_rush',
    tx: 0.48,
    c2x: 0.52,
    jmp: -48,
    lbl: '🥋 Combo Aéreo Giratório & Chute Duplo',
    cam: 'shake',
    ico: 'fire',
  },
  {
    act: 'sword_duel',
    exp: 'intense',
    man: 'parry',
    tx: 0.36,
    c2x: 0.64,
    jmp: -18,
    prp: 'sword',
    lbl: '⚔️ Defesa de Katana com Faíscas & Recuo',
    cam: 'pulse',
    ico: 'exclamation',
  },
  {
    act: 'fight_kungfu',
    exp: 'confident',
    man: 'slide_kick',
    tx: 0.56,
    c2x: 0.72,
    jmp: -10,
    lbl: '💨 Rasteira Deslizante & Contra-Ataque',
    cam: 'pan_right',
    ico: 'target',
  },
  {
    act: 'hero_landing',
    exp: 'angry',
    man: 'jump_shock',
    tx: 0.50,
    c2x: 0.76,
    jmp: -72,
    lbl: '💥 Salto Sísmico & Aterrissagem de Impacto',
    cam: 'shake',
    ico: 'fire',
  },
  {
    act: 'sword_duel',
    exp: 'determined',
    man: 'spin_360',
    tx: 0.45,
    c2x: 0.58,
    jmp: -55,
    prp: 'sword',
    lbl: '🌪️ Giro 360° Cortante no Ar',
    cam: 'zoom_in',
    ico: 'lightning',
  },
];

const EXPRESSIVE_STORY_VARIATIONS: ChoreographyVariation[] = [
  {
    act: 'walk_city',
    exp: 'talking',
    man: 'enter_left',
    tx: 0.36,
    jmp: 0,
    lbl: '🚶 Caminhada Controlada & Gesto Natural',
    cam: 'none',
    ico: 'none',
  },
  {
    act: 'talk_explaining',
    exp: 'confident',
    man: 'hologram_present',
    tx: 0.46,
    jmp: 0,
    lbl: '🗣️ Explicando Cenário & Apontando Objetivos',
    cam: 'zoom_in',
    ico: 'lightbulb',
  },
  {
    act: 'thinking',
    exp: 'confident',
    man: 'pace_back_forth',
    tx: 0.38,
    jmp: 0,
    prp: 'book',
    lbl: '🤔 Análise Estratégica & Passo Calmo',
    cam: 'pan_right',
    ico: 'question',
  },
  {
    act: 'command_crowd',
    exp: 'determined',
    man: 'hologram_present',
    tx: 0.52,
    jmp: 0,
    lbl: '📢 Coordenando Pessoas & Física do Ambiente',
    cam: 'pulse',
    ico: 'target',
  },
  {
    act: 'scavenge_supplies',
    exp: 'intense',
    man: 'pace_back_forth',
    tx: 0.60,
    jmp: -8,
    lbl: '🎒 Explorando Terreno & Coletando Recursos',
    cam: 'pan_right',
    ico: 'exclamation',
  },
  {
    act: 'presentation_stage',
    exp: 'smile',
    man: 'hologram_present',
    tx: 0.56,
    jmp: -10,
    lbl: '🎤 Apresentando Simulação & Dados Reais',
    cam: 'zoom_in',
    ico: 'chart_up',
  },
  {
    act: 'zombie_survive_barricade',
    exp: 'determined',
    man: 'dodge_slide',
    tx: 0.42,
    jmp: -12,
    prp: 'shield',
    lbl: '🛡️ Reforçando Barricada & Contendo Ameaça',
    cam: 'shake',
    ico: 'skull',
  },
  {
    act: 'trillion_buy_everything',
    exp: 'laughing',
    man: 'backflip_celebrate',
    tx: 0.50,
    jmp: -22,
    prp: 'money',
    lbl: '💎 Comprando Mega Ativos em Tempo Real',
    cam: 'zoom_in',
    ico: 'money_bag',
  },
  {
    act: 'coffee_sip',
    exp: 'smile',
    man: 'pace_back_forth',
    tx: 0.38,
    jmp: 0,
    prp: 'coffee',
    lbl: '☕ Pausa Controlada Observando o Cenário',
    cam: 'none',
    ico: 'coffee',
  },
  {
    act: 'work_computer',
    exp: 'confident',
    man: 'hologram_present',
    tx: 0.48,
    jmp: 0,
    prp: 'laptop',
    lbl: '💻 Calculando Impacto & Física no Terminal',
    cam: 'zoom_in',
    ico: 'target',
  },
];

const SURVIVAL_VARIATIONS: ChoreographyVariation[] = [
  {
    act: 'zombie_survive_barricade',
    exp: 'determined',
    man: 'parry',
    tx: 0.38,
    c2x: 0.68,
    jmp: 0,
    prp: 'shield',
    lbl: '🧟 Reforçando Barricada Contra a Horda',
    cam: 'shake',
    ico: 'skull',
  },
  {
    act: 'scavenge_supplies',
    exp: 'intense',
    man: 'pace_back_forth',
    tx: 0.28,
    c2x: 0.74,
    jmp: -6,
    prp: 'briefcase',
    lbl: '🎒 Resgatando Caixa de Suprimentos & Água',
    cam: 'pan_right',
    ico: 'target',
  },
  {
    act: 'command_crowd',
    exp: 'angry',
    man: 'hologram_present',
    tx: 0.44,
    c2x: 0.64,
    jmp: 0,
    lbl: '📢 Guiando Sobreviventes Para o Bunker',
    cam: 'zoom_in',
    ico: 'exclamation',
  },
  {
    act: 'gun_aim',
    exp: 'intense',
    man: 'dodge_slide',
    tx: 0.34,
    c2x: 0.60,
    jmp: -10,
    lbl: '🎯 Contenção de Perímetro & Recuo Tático',
    cam: 'pulse',
    ico: 'fire',
  },
  {
    act: 'thinking',
    exp: 'shocked',
    man: 'enter_left',
    tx: 0.48,
    c2x: 0.72,
    jmp: 0,
    prp: 'phone',
    lbl: '📡 Monitorando Radar de Infecção & Aéreo',
    cam: 'none',
    ico: 'lightbulb',
  },
];

const TRILLIONAIRE_VARIATIONS: ChoreographyVariation[] = [
  {
    act: 'trillion_buy_everything',
    exp: 'confident',
    man: 'hologram_present',
    tx: 0.44,
    jmp: 0,
    prp: 'money',
    lbl: '💎 Comprando Frota de Jatos & Superiites (-R$ 385k/s)',
    cam: 'zoom_in',
    ico: 'money_bag',
  },
  {
    act: 'command_crowd',
    exp: 'smile',
    man: 'pace_back_forth',
    tx: 0.56,
    jmp: 0,
    prp: 'briefcase',
    lbl: '🏗️ Contratando Equipes & Erguendo Arranha-Céus',
    cam: 'pan_right',
    ico: 'chart_up',
  },
  {
    act: 'presentation_stage',
    exp: 'laughing',
    man: 'enter_left',
    tx: 0.38,
    jmp: -12,
    prp: 'phone',
    lbl: '🏝️ Adquirindo Ilhas Privadas & Foguetes Espaciais',
    cam: 'pulse',
    ico: 'fire',
  },
  {
    act: 'money_celebrate',
    exp: 'confident',
    man: 'backflip_celebrate',
    tx: 0.50,
    jmp: -20,
    prp: 'money',
    lbl: '💰 Chuva de Ouro & Entregas de Helicóptero',
    cam: 'zoom_in',
    ico: 'money_bag',
  },
  {
    act: 'thinking',
    exp: 'shocked',
    man: 'hologram_present',
    tx: 0.42,
    jmp: 0,
    prp: 'laptop',
    lbl: '⏱️ Relógio de 30 Dias Correndo: Gastando Milhões!',
    cam: 'none',
    ico: 'lightning',
  },
];

/**
 * Breaks a scene into controlled, non-repeating choreography beats.
 * Guarantees that every single beat in a scene has a distinct action, distinct maneuver,
 * and smooth spatial movement without frantic jitter.
 */
export function generateChoreographyForScene(scene: StickmanScene): ChoreographyBeat[] {
  const dur = Math.max(2, scene.duration || 4.5);
  const rawText = (scene.narration || '').trim();
  const words = rawText.length > 0 ? rawText.split(/\s+/) : ['Ação', 'em', 'movimento'];

  // Controlled pacing (~1.5s to 2.2s per beat) while keeping at least 4 distinct beats on 5.5s+ scenes
  const targetBeatDur = dur <= 6.5 ? 1.45 : dur <= 15 ? 1.95 : 2.5;
  const numBeats = Math.max(3, Math.min(28, Math.round(dur / targetBeatDur)));
  const wordsPerBeat = Math.max(1, Math.ceil(words.length / numBeats));

  const chunks: string[] = [];
  for (let i = 0; i < words.length; i += wordsPerBeat) {
    chunks.push(words.slice(i, i + wordsPerBeat).join(' '));
  }
  while (chunks.length < 3) {
    chunks.push(chunks[chunks.length - 1] || '...');
  }

  const totalChunks = chunks.length;
  const beatDur = dur / totalChunks;

  const baseAction = scene.character1.action;
  const isVehicle =
    baseAction === 'drive_car' ||
    baseAction === 'car_chase' ||
    baseAction === 'car_drift' ||
    baseAction === 'car_police' ||
    baseAction === 'motorcycle' ||
    scene.environment === 'highway_sunset' ||
    scene.environment === 'police_chase_night' ||
    scene.environment === 'cyber_highway';

  const isSurvival =
    baseAction === 'zombie_survive_barricade' ||
    baseAction === 'scavenge_supplies' ||
    scene.environment === 'zombie_apocalypse' ||
    scene.environment === 'bunker_survival';

  const isTrillionaire =
    baseAction === 'trillion_buy_everything' ||
    scene.environment === 'trillionaire_sandbox' ||
    scene.environment === 'money_vault';

  const isCombat =
    baseAction === 'fight_kungfu' ||
    baseAction === 'sword_duel' ||
    scene.environment === 'japanese_dojo';

  const beats: ChoreographyBeat[] = [];
  let prevX = scene.character2 ? 0.36 : 0.34;
  let prevChar2X = 0.68;
  let prevAction: StickmanAction = baseAction;
  let prevManeuver: DynamicManeuver = 'none';
  let prevLabel = '';

  const sceneHash = scene.id
    .split('')
    .reduce((acc, ch) => acc + ch.charCodeAt(0), 0);

  for (let idx = 0; idx < totalChunks; idx++) {
    const startTime = Math.round(idx * beatDur * 100) / 100;
    const endTime = Math.round((idx + 1) * beatDur * 100) / 100;
    const snippet = chunks[idx];
    const lower = snippet.toLowerCase();

    let candidate: ChoreographyVariation;

    if (isVehicle) {
      let poolIdx = (idx + sceneHash) % VEHICLE_VARIATIONS.length;
      if (lower.includes('drift') || lower.includes('curva') || lower.includes('freio')) {
        poolIdx = 1;
      } else if (lower.includes('sirene') || lower.includes('polícia') || lower.includes('viatura')) {
        poolIdx = 3;
      } else if (lower.includes('nitro') || lower.includes('fogo') || lower.includes('aceler')) {
        poolIdx = 4;
      }

      candidate = { ...VEHICLE_VARIATIONS[poolIdx] };
      let guard = 0;
      while (
        (candidate.man === prevManeuver || candidate.lbl === prevLabel) &&
        guard < VEHICLE_VARIATIONS.length
      ) {
        poolIdx = (poolIdx + 1) % VEHICLE_VARIATIONS.length;
        candidate = { ...VEHICLE_VARIATIONS[poolIdx] };
        guard++;
      }
    } else if (isSurvival) {
      let poolIdx = (idx + sceneHash) % SURVIVAL_VARIATIONS.length;
      candidate = { ...SURVIVAL_VARIATIONS[poolIdx] };
      let guard = 0;
      while (
        (candidate.man === prevManeuver || candidate.act === prevAction || candidate.lbl === prevLabel) &&
        guard < SURVIVAL_VARIATIONS.length
      ) {
        poolIdx = (poolIdx + 1) % SURVIVAL_VARIATIONS.length;
        candidate = { ...SURVIVAL_VARIATIONS[poolIdx] };
        guard++;
      }
    } else if (isTrillionaire) {
      let poolIdx = (idx + sceneHash) % TRILLIONAIRE_VARIATIONS.length;
      candidate = { ...TRILLIONAIRE_VARIATIONS[poolIdx] };
      let guard = 0;
      while (
        (candidate.man === prevManeuver || candidate.act === prevAction || candidate.lbl === prevLabel) &&
        guard < TRILLIONAIRE_VARIATIONS.length
      ) {
        poolIdx = (poolIdx + 1) % TRILLIONAIRE_VARIATIONS.length;
        candidate = { ...TRILLIONAIRE_VARIATIONS[poolIdx] };
        guard++;
      }
    } else if (isCombat) {
      let poolIdx = (idx + sceneHash) % COMBAT_VARIATIONS.length;
      candidate = { ...COMBAT_VARIATIONS[poolIdx] };
      let guard = 0;
      while (
        (candidate.man === prevManeuver || candidate.act === prevAction) &&
        guard < COMBAT_VARIATIONS.length
      ) {
        poolIdx = (poolIdx + 1) % COMBAT_VARIATIONS.length;
        candidate = { ...COMBAT_VARIATIONS[poolIdx] };
        guard++;
      }
    } else {
      let matched: ChoreographyVariation | null = null;

      if (
        lower.includes('zumbi') ||
        lower.includes('barricada') ||
        lower.includes('apocalipse') ||
        lower.includes('horda')
      ) {
        matched = EXPRESSIVE_STORY_VARIATIONS[6]; // zombie_survive_barricade
      } else if (
        lower.includes('trilhão') ||
        lower.includes('bilhões') ||
        lower.includes('comprar') ||
        lower.includes('gastar')
      ) {
        matched = EXPRESSIVE_STORY_VARIATIONS[7]; // trillion_buy_everything
      } else if (
        lower.includes('suprimento') ||
        lower.includes('explorar') ||
        lower.includes('bunker')
      ) {
        matched = EXPRESSIVE_STORY_VARIATIONS[4]; // scavenge_supplies
      } else if (
        lower.includes('pessoas') ||
        lower.includes('multidão') ||
        lower.includes('equipe') ||
        lower.includes('cidade')
      ) {
        matched = EXPRESSIVE_STORY_VARIATIONS[3]; // command_crowd
      } else if (
        lower.includes('código') ||
        lower.includes('sistema') ||
        lower.includes('servidor') ||
        lower.includes('computador')
      ) {
        matched = EXPRESSIVE_STORY_VARIATIONS[9]; // work_computer
      } else if (lower.includes('café') || lower.includes('madrugada')) {
        matched = EXPRESSIVE_STORY_VARIATIONS[8]; // coffee_sip
      }

      let poolIdx = (idx * 2 + sceneHash) % EXPRESSIVE_STORY_VARIATIONS.length;
      candidate = matched ? { ...matched } : { ...EXPRESSIVE_STORY_VARIATIONS[poolIdx] };

      let guard = 0;
      while (
        (candidate.act === prevAction ||
          candidate.man === prevManeuver ||
          candidate.lbl === prevLabel) &&
        guard < EXPRESSIVE_STORY_VARIATIONS.length
      ) {
        poolIdx = (poolIdx + 1) % EXPRESSIVE_STORY_VARIATIONS.length;
        candidate = { ...EXPRESSIVE_STORY_VARIATIONS[poolIdx] };
        guard++;
      }
    }

    // Controlled horizontal travel: clamp step distance to max 0.14 screen width per beat so movement is smooth and grounded
    let targetX = candidate.tx;
    const rawDelta = targetX - prevX;
    if (Math.abs(rawDelta) < 0.05) {
      targetX = prevX < 0.5 ? prevX + 0.09 : prevX - 0.09;
    } else if (Math.abs(rawDelta) > 0.14) {
      targetX = prevX + Math.sign(rawDelta) * 0.14;
    }
    targetX = Math.max(0.22, Math.min(0.76, targetX));

    const targetChar2X =
      candidate.c2x ??
      (prevChar2X > 0.62 ? Math.max(0.52, prevChar2X - 0.08) : Math.min(0.76, prevChar2X + 0.08));

    const char2Action: StickmanAction = isVehicle
      ? 'car_chase'
      : isSurvival
      ? 'walking'
      : candidate.act === 'fight_kungfu'
      ? 'sword_duel'
      : 'fight_kungfu';

    beats.push({
      id: `${scene.id}_beat_${idx}`,
      startTime,
      endTime,
      label: candidate.lbl,
      spokenText: snippet,
      action: candidate.act,
      prevAction: idx === 0 ? baseAction : prevAction,
      char2Action,
      expression: candidate.exp,
      prop: candidate.prp || scene.character1.prop || 'none',
      fromX: prevX,
      toX: targetX,
      char2FromX: prevChar2X,
      char2ToX: targetChar2X,
      jumpArc: candidate.jmp * 0.55, // damped vertical jump arc for realistic gravity
      maneuver: candidate.man,
      cameraEffect: candidate.cam,
      floatingIcon: candidate.ico !== 'none' ? candidate.ico : scene.floatingIcon || 'none',
      timeRange: `${startTime.toFixed(1)}s - ${endTime.toFixed(1)}s`,
      words: snippet,
    });

    prevX = targetX;
    prevChar2X = targetChar2X;
    prevAction = candidate.act;
    prevManeuver = candidate.man;
    prevLabel = candidate.lbl;
  }

  return beats;
}

/**
 * Given a scene and the current sceneProgress [0..1], resolves the active ChoreographyBeat
 * and interpolates smooth spatial positions, velocity, jump arcs, and pose transition blending.
 */
export function resolveActiveBeatState(
  scene: StickmanScene,
  sceneProgress: number
): ActiveBeatFrameState {
  const dur = Math.max(1, scene.duration || 4.5);
  const elapsedInSceneSec = Math.max(0, Math.min(dur, sceneProgress * dur));

  const beats =
    scene.choreography && scene.choreography.length > 0
      ? scene.choreography
      : generateChoreographyForScene(scene);

  let activeIndex = 0;
  for (let i = 0; i < beats.length; i++) {
    if (elapsedInSceneSec <= beats[i].endTime || i === beats.length - 1) {
      activeIndex = i;
      break;
    }
  }

  const beat = beats[activeIndex];
  const prevBeat = activeIndex > 0 ? beats[activeIndex - 1] : beat;
  const beatLen = Math.max(0.1, beat.endTime - beat.startTime);
  const beatProgress = Math.max(0, Math.min(1, (elapsedInSceneSec - beat.startTime) / beatLen));

  // Smooth pose transition blend over the first 45% of each beat so poses flow calmly
  const transitionBlend = Math.min(1, beatProgress / 0.45);

  // Smooth cosine ease
  const ease = 0.5 - 0.5 * Math.cos(beatProgress * Math.PI);

  const char1XNorm = beat.fromX + (beat.toX - beat.fromX) * ease;
  const c2From = beat.char2FromX ?? 0.72;
  const c2To = beat.char2ToX ?? 0.68;
  const char2XNorm = c2From + (c2To - c2From) * ease;

  const dx = beat.toX - beat.fromX;
  const velocityX = (dx * Math.sin(beatProgress * Math.PI)) / Math.max(0.6, beatLen);

  // Parabolic jump arc: peaks at center of beat
  const parabola = 4 * beatProgress * (1 - beatProgress);
  const jumpOffsetY = (beat.jumpArc || 0) * parabola;
  const char2JumpOffsetY = beat.maneuver === 'combat_combo_rush' ? -22 * parabola : 0;

  const isVehicle =
    beat.action === 'drive_car' ||
    beat.action === 'car_chase' ||
    beat.action === 'car_drift' ||
    beat.action === 'car_police' ||
    beat.action === 'motorcycle';

  const flipChar1 = isVehicle ? false : dx < -0.05;
  const flipChar2 = isVehicle ? false : true;

  return {
    beatIndex: activeIndex,
    totalBeats: beats.length,
    beat,
    beatProgress,
    transitionBlend,
    elapsedInSceneSec,
    char1XNorm,
    char2XNorm,
    velocityX,
    jumpOffsetY,
    char2JumpOffsetY,
    flipChar1,
    flipChar2,
    effectiveAction1: beat.action,
    prevAction1: beat.prevAction || prevBeat.action,
    effectiveAction2: beat.char2Action || scene.character2?.action || 'fight_kungfu',
    effectiveExpression1: beat.expression,
    effectiveProp1: beat.prop || scene.character1.prop || 'none',
    maneuver: beat.maneuver,
    effectiveCamera: beat.cameraEffect || scene.cameraEffect,
    effectiveIcon: beat.floatingIcon || scene.floatingIcon || 'none',
  };
}
