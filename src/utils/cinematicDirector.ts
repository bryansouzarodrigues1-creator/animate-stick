import {
  StickmanScene,
  StickmanAction,
  StickmanExpression,
  EnvironmentTheme,
  CameraEffect,
  SoundEffectType,
  VisualFilter,
  FloatingVfxIcon,
  DynamicManeuver,
  SceneCharacter,
  DramaticIntent,
  EmotionalArcState,
  NarrativeBeatPhase,
  CinematicScenePlan,
  CinematicBeatPlan,
  CinematicEnvironmentPlan,
  CinematicCameraPlan,
  CinematicCharacterRef,
  ChoreographyBeat,
} from '../types/stickman';
import { calculateElevenLabsTiming } from './stickmanMath';

export const VALID_ACTIONS: readonly StickmanAction[] = [
  'drive_car',
  'car_chase',
  'car_drift',
  'car_police',
  'motorcycle',
  'walk_city',
  'presentation_stage',
  'hero_rooftop',
  'talk_explaining',
  'fight_kungfu',
  'sword_duel',
  'gun_aim',
  'work_computer',
  'money_celebrate',
  'panic_freakout',
  'thinking',
  'walking',
  'running',
  'hero_landing',
  'dramatic_fall',
  'reading_book',
  'coffee_sip',
  'zombie_survive_barricade',
  'trillion_buy_everything',
  'scavenge_supplies',
  'command_crowd',
];

export const VALID_EXPRESSIONS: readonly StickmanExpression[] = [
  'talking',
  'smile',
  'angry',
  'shocked',
  'confident',
  'sad',
  'laughing',
  'intense',
  'determined',
];

export const VALID_ENVIRONMENTS: readonly EnvironmentTheme[] = [
  'zombie_apocalypse',
  'trillionaire_sandbox',
  'bunker_survival',
  'global_simulation',
  'highway_sunset',
  'city_downtown',
  'police_chase_night',
  'bank_heist',
  'luxury_penthouse',
  'cyber_highway',
  'space_station',
  'traffic_jam',
  'secret_lab',
  'interrogation_room',
  'finance_trading',
  'japanese_dojo',
  'hacker_den',
  'street_night',
  'spotlight_dark',
  'money_vault',
  'sketch_grid',
];

export const VALID_CAMERAS: readonly CameraEffect[] = [
  'none',
  'zoom_in',
  'shake',
  'pan_right',
  'pulse',
];

export const VALID_SFX: readonly SoundEffectType[] = [
  'none',
  'car_engine',
  'car_screech',
  'police_siren',
  'nitro_boost',
  'punch',
  'sword_clash',
  'gun_shot',
  'whoosh',
  'cash_register',
  'typing',
  'dramatic_boom',
  'ding_idea',
];

export const VALID_FILTERS: readonly VisualFilter[] = [
  'none',
  'cinemascope',
  'vignette',
  'film_grain',
  'crt_cyber',
  'money_rain',
  'fire_sparks',
];

export const VALID_ICONS: readonly FloatingVfxIcon[] = [
  'none',
  'exclamation',
  'question',
  'lightbulb',
  'money_bag',
  'fire',
  'skull',
  'chart_up',
  'chart_down',
  'target',
  'lightning',
  'coffee',
  'heart',
];

export const VALID_MANEUVERS: readonly DynamicManeuver[] = [
  'none',
  'enter_left',
  'exit_right',
  'pace_back_forth',
  'sprint_across',
  'jump_shock',
  'backflip_celebrate',
  'combat_combo_rush',
  'dodge_slide',
  'hologram_present',
  'car_accelerate_surge',
  'car_lane_swerve',
  'car_overtake_traffic',
  'police_ram_sparks',
  'car_handbrake_drift',
  'helicopter_searchlight',
  'drift_left',
  'drift_right',
  'nitro_boost',
  'swerve_dodge',
  'backflip',
  'slide_kick',
  'parry',
  'stumble',
  'spin_360',
];

export const VALID_PROPS: readonly NonNullable<SceneCharacter['prop']>[] = [
  'none',
  'sword',
  'laptop',
  'money',
  'coffee',
  'phone',
  'shield',
  'steering_wheel',
  'sunglasses',
  'briefcase',
  'book',
];

export const VALID_DRAMATIC_INTENTS: readonly DramaticIntent[] = [
  'introduce_conflict',
  'escalate_tension',
  'revelation',
  'climax_confrontation',
  'tactical_planning',
  'escape_pursuit',
  'triumph_celebration',
  'despair_setback',
  'world_building',
  'resolution',
];

export const VALID_EMOTIONAL_STATES: readonly EmotionalArcState[] = [
  'calm',
  'curious',
  'tense',
  'urgent',
  'furious',
  'shocked',
  'triumphant',
  'desperate',
  'determined',
  'reflective',
];

/**
 * Computes a deterministic 32-bit unsigned integer seed from a string and optional numeric salt.
 * Never uses Math.random() or Date.now() so identical inputs always yield the exact same seed.
 */
export function computeDeterministicSeed(input: string, salt = 0): number {
  let hash = (2166136261 ^ (salt >>> 0)) >>> 0;
  const text = String(input || 'stickstory_default');
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return (hash >>> 0) || 1;
}

/**
 * Pure Mulberry32 PRNG returning a deterministic float in [0, 1) for a given seed and step index.
 */
export function seededUnitFloat(seed: number, step = 0): number {
  let t = ((seed >>> 0) + Math.imul(step + 1, 0x6d2b79f5)) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export interface InferredSceneContext {
  dramaticIntent: DramaticIntent;
  emotionalState: EmotionalArcState;
  action: StickmanAction;
  secondaryAction?: StickmanAction;
  expression: StickmanExpression;
  environment: EnvironmentTheme;
  timeOfDay: CinematicEnvironmentPlan['timeOfDay'];
  weatherOrAtmosphere: CinematicEnvironmentPlan['weatherOrAtmosphere'];
  lightingMood: CinematicEnvironmentPlan['lightingMood'];
  cameraEffect: CameraEffect;
  framing: CinematicCameraPlan['framing'];
  soundEffect: SoundEffectType;
  visualFilter: VisualFilter;
  floatingIcon: FloatingVfxIcon;
  prop: NonNullable<SceneCharacter['prop']>;
  objectRefs: string[];
  requiresOpponent: boolean;
  opponentName?: string;
  opponentColor?: string;
  baseIntensity: number;
  baseAnticipation: number;
  baseReaction: number;
  baseSettle: number;
}

function isOneOf<T extends string>(val: unknown, list: readonly T[]): val is T {
  return typeof val === 'string' && (list as readonly string[]).includes(val);
}

function clamp(val: number, min: number, max: number): number {
  if (Number.isNaN(val)) return min;
  return Math.max(min, Math.min(max, val));
}

/**
 * Analyzes scene narration and title semantically to infer dramatic intent, emotion,
 * environment, action, props, and kinematic parameters WITHOUT relying on scene index (`idx`).
 */
export function inferContextFromText(
  narration: string,
  title = '',
  customSeed?: number
): InferredSceneContext {
  const combined = `${title} ${narration}`.toLowerCase();
  const seed = customSeed ?? computeDeterministicSeed(combined);

  // 1. Detect thematic domain from text content (never by scene index)
  const isZombieSurvival =
    /zumbi|apocalipse|infect|horda|barricada|sobreviv|vírus|abrigo|bunker/.test(combined);
  const isVehiclePursuit =
    /carro|motor|velocidade|estrada|rodovia|drift|pneu|curva|fuga|persegui|viatura|sirene|asfalto|piloto|corrida|esportivo|moto/.test(
      combined
    );
  const isCombatDuel =
    /luta|combate|golpe|espada|katana|duelo|guerreiro|dojo|soco|chute|voadora|batalha|ataque|defesa|inimigo|rival/.test(
      combined
    );
  const isWealthHeist =
    /trilh|bilh|milh|dinheiro|ouro| fortuna|comprar|gastar|banco|cofre|assalto|riqueza|iate|ilha|jato|invest|lucro|mercado|ações/.test(
      combined
    );
  const isTechHacker =
    /código|hacker|computador|servidor|sistema|ia|inteligência|terminal|algoritmo|dados|laboratório|cientista|rede/.test(
      combined
    );
  const isPanicCrisis =
    /pânico|desespero|medo|explos|caos|perigo|erro|queda|caiu|socorro|alarme|colapso|urgente/.test(
      combined
    );
  const isCrowdCommand =
    /multidão|pessoas|cidade|equipe|líder|comandar|coordenar|mundo|global|população|exército|todos/.test(
      combined
    );
  const isReflectiveStudy =
    /pensar|pensou|plano|estratégia|livro|estudar|ler|café|silêncio|ideia|segredo|mistério|descobr/.test(
      combined
    );

  // 2. Detect emotional tone & dramatic markers
  const hasExclamation = /!/.test(narration);
  const hasQuestion = /\?/.test(narration);
  const seedVar = (seededUnitFloat(seed, 1) - 0.5) * 0.14;

  if (isZombieSurvival) {
    const isBunker = /bunker|subterrâneo|radar|abrigo/.test(combined);
    const isScavenge = /suprimento|buscar|coletar|água|comida|explorar|caixa/.test(combined);
    return {
      dramaticIntent: isScavenge ? 'tactical_planning' : 'escalate_tension',
      emotionalState: isScavenge ? 'urgent' : 'determined',
      action: isScavenge ? 'scavenge_supplies' : 'zombie_survive_barricade',
      secondaryAction: 'walking',
      expression: isScavenge ? 'intense' : 'determined',
      environment: isBunker ? 'bunker_survival' : 'zombie_apocalypse',
      timeOfDay: isBunker ? 'underground' : 'night',
      weatherOrAtmosphere: isBunker ? 'clear' : 'toxic_mist',
      lightingMood: isBunker ? 'bioluminescent' : 'high_contrast',
      cameraEffect: isScavenge ? 'pan_right' : 'shake',
      framing: isScavenge ? 'tracking_shot' : 'medium_action',
      soundEffect: 'dramatic_boom',
      visualFilter: 'vignette',
      floatingIcon: 'skull',
      prop: isScavenge ? 'briefcase' : 'shield',
      objectRefs: ['barricada', 'caixa_suprimentos', 'helicoptero_resgate'],
      requiresOpponent: true,
      opponentName: 'Infectado',
      opponentColor: '#4ADE80',
      baseIntensity: clamp(0.76 + seedVar, 0.25, 0.95),
      baseAnticipation: clamp(0.55 + seedVar, 0.2, 0.9),
      baseReaction: clamp(0.68 + seedVar, 0.2, 0.95),
      baseSettle: 0.45,
    };
  }

  if (isVehiclePursuit) {
    const isDrift = /drift|curva|freio|derrap|pneu/.test(combined);
    const isPolice = /polícia|viatura|sirene|persegui|fuga/.test(combined);
    const isMoto = /moto|duas rodas/.test(combined);
    return {
      dramaticIntent: isPolice ? 'escape_pursuit' : 'escalate_tension',
      emotionalState: isPolice ? 'urgent' : 'determined',
      action: isMoto
        ? 'motorcycle'
        : isDrift
        ? 'car_drift'
        : isPolice
        ? 'car_chase'
        : 'drive_car',
      secondaryAction: isPolice ? 'car_chase' : undefined,
      expression: isPolice ? 'intense' : 'confident',
      environment: isPolice
        ? 'police_chase_night'
        : /cyber|futur|neon/.test(combined)
        ? 'cyber_highway'
        : 'highway_sunset',
      timeOfDay: isPolice ? 'night' : 'sunset',
      weatherOrAtmosphere: isDrift ? 'smoke_ash' : 'clear',
      lightingMood: isPolice ? 'emergency_strobe' : 'warm_golden',
      cameraEffect: isDrift || isPolice ? 'shake' : 'pan_right',
      framing: 'tracking_shot',
      soundEffect: isDrift ? 'car_screech' : isPolice ? 'police_siren' : 'car_engine',
      visualFilter: 'cinemascope',
      floatingIcon: 'fire',
      prop: 'steering_wheel',
      objectRefs: isPolice ? ['esportivo', 'viatura_policial', 'asfalto'] : ['esportivo', 'rodovia'],
      requiresOpponent: isPolice,
      opponentName: 'Viatura',
      opponentColor: '#DC2626',
      baseIntensity: clamp(0.84 + seedVar, 0.4, 1.0),
      baseAnticipation: clamp(0.48 + seedVar, 0.2, 0.85),
      baseReaction: clamp(0.72 + seedVar, 0.3, 0.95),
      baseSettle: 0.35,
    };
  }

  if (isCombatDuel) {
    const isSword = /espada|katana|lâmina|duelo|corte/.test(combined);
    const isLanding = /salt|aterriss|topo|voo/.test(combined);
    return {
      dramaticIntent: 'climax_confrontation',
      emotionalState: 'furious',
      action: isSword ? 'sword_duel' : isLanding ? 'hero_landing' : 'fight_kungfu',
      secondaryAction: isSword ? 'sword_duel' : 'fight_kungfu',
      expression: 'angry',
      environment: /rua|noite|beco|cidade/.test(combined) ? 'street_night' : 'japanese_dojo',
      timeOfDay: 'night',
      weatherOrAtmosphere: 'fog',
      lightingMood: 'high_contrast',
      cameraEffect: 'shake',
      framing: 'medium_action',
      soundEffect: isSword ? 'sword_clash' : 'punch',
      visualFilter: 'cinemascope',
      floatingIcon: 'lightning',
      prop: isSword ? 'sword' : 'none',
      objectRefs: isSword ? ['katana', 'tatame_dojo'] : ['tatame_dojo'],
      requiresOpponent: true,
      opponentName: 'Rival',
      opponentColor: '#DC2626',
      baseIntensity: clamp(0.88 + seedVar, 0.45, 1.0),
      baseAnticipation: clamp(0.66 + seedVar, 0.3, 0.95),
      baseReaction: clamp(0.82 + seedVar, 0.4, 1.0),
      baseSettle: 0.38,
    };
  }

  if (isWealthHeist) {
    const isHeist = /banco|cofre|assalto|laser|roubo/.test(combined);
    const isTrillion = /trilh|bilh|ilha|iate|jato|gastar/.test(combined);
    const isTrading = /mercado|ações|gráfico|bolsa|trading|invest/.test(combined);
    return {
      dramaticIntent: isHeist ? 'escalate_tension' : 'triumph_celebration',
      emotionalState: isHeist ? 'tense' : 'triumphant',
      action: isTrillion
        ? 'trillion_buy_everything'
        : isHeist
        ? 'gun_aim'
        : 'money_celebrate',
      expression: isHeist ? 'intense' : 'confident',
      environment: isHeist
        ? 'bank_heist'
        : isTrading
        ? 'finance_trading'
        : isTrillion
        ? 'trillionaire_sandbox'
        : 'money_vault',
      timeOfDay: isHeist ? 'night' : 'day',
      weatherOrAtmosphere: 'clear',
      lightingMood: isHeist ? 'cold_noir' : 'warm_golden',
      cameraEffect: 'zoom_in',
      framing: isTrillion ? 'wide_establishing' : 'medium_action',
      soundEffect: isHeist ? 'dramatic_boom' : 'cash_register',
      visualFilter: isTrillion ? 'money_rain' : 'cinemascope',
      floatingIcon: isTrading ? 'chart_up' : 'money_bag',
      prop: 'money',
      objectRefs: isHeist ? ['porta_cofre', 'lasers'] : ['maleta_dinheiro', 'ativos_luxo'],
      requiresOpponent: false,
      baseIntensity: clamp(0.72 + seedVar, 0.3, 0.95),
      baseAnticipation: clamp(0.45 + seedVar, 0.2, 0.8),
      baseReaction: clamp(0.62 + seedVar, 0.25, 0.9),
      baseSettle: 0.5,
    };
  }

  if (isTechHacker) {
    const isLab = /laboratório|cientista|experimento|fórmula/.test(combined);
    return {
      dramaticIntent: hasQuestion ? 'revelation' : 'tactical_planning',
      emotionalState: hasExclamation ? 'urgent' : 'curious',
      action: 'work_computer',
      expression: hasExclamation ? 'shocked' : 'confident',
      environment: isLab ? 'secret_lab' : 'hacker_den',
      timeOfDay: 'night',
      weatherOrAtmosphere: 'neon_haze',
      lightingMood: 'bioluminescent',
      cameraEffect: 'zoom_in',
      framing: 'close_dramatic',
      soundEffect: 'typing',
      visualFilter: 'crt_cyber',
      floatingIcon: 'lightbulb',
      prop: 'laptop',
      objectRefs: ['terminal_codigo', 'mesa_servidores'],
      requiresOpponent: false,
      baseIntensity: clamp(0.54 + seedVar, 0.25, 0.85),
      baseAnticipation: clamp(0.38 + seedVar, 0.15, 0.75),
      baseReaction: clamp(0.48 + seedVar, 0.2, 0.8),
      baseSettle: 0.62,
    };
  }

  if (isPanicCrisis) {
    const isFall = /queda|caiu|nocaute|desabou|chão/.test(combined);
    return {
      dramaticIntent: 'despair_setback',
      emotionalState: 'desperate',
      action: isFall ? 'dramatic_fall' : 'panic_freakout',
      expression: 'shocked',
      environment: 'street_night',
      timeOfDay: 'night',
      weatherOrAtmosphere: 'rain',
      lightingMood: 'high_contrast',
      cameraEffect: 'shake',
      framing: 'close_dramatic',
      soundEffect: 'dramatic_boom',
      visualFilter: 'vignette',
      floatingIcon: 'exclamation',
      prop: 'none',
      objectRefs: ['poste_luz', 'asfalto_noturno'],
      requiresOpponent: false,
      baseIntensity: clamp(0.86 + seedVar, 0.45, 1.0),
      baseAnticipation: clamp(0.62 + seedVar, 0.3, 0.9),
      baseReaction: clamp(0.84 + seedVar, 0.4, 1.0),
      baseSettle: 0.3,
    };
  }

  if (isCrowdCommand) {
    const isStage = /palco|apresenta|discurso|plateia/.test(combined);
    return {
      dramaticIntent: 'world_building',
      emotionalState: 'determined',
      action: isStage ? 'presentation_stage' : 'command_crowd',
      expression: 'confident',
      environment: isStage ? 'spotlight_dark' : 'city_downtown',
      timeOfDay: 'night',
      weatherOrAtmosphere: isStage ? 'spotlight' : 'clear',
      lightingMood: 'high_contrast',
      cameraEffect: 'pan_right',
      framing: 'wide_establishing',
      soundEffect: 'whoosh',
      visualFilter: 'cinemascope',
      floatingIcon: 'target',
      prop: 'none',
      objectRefs: ['arranha_ceus', 'multidao'],
      requiresOpponent: false,
      baseIntensity: clamp(0.68 + seedVar, 0.3, 0.9),
      baseAnticipation: clamp(0.46 + seedVar, 0.2, 0.8),
      baseReaction: clamp(0.55 + seedVar, 0.2, 0.85),
      baseSettle: 0.55,
    };
  }

  if (isReflectiveStudy) {
    const isCoffee = /café|xícara|manhã|pausa/.test(combined);
    const isBook = /livro|ler|leitura|página|manual/.test(combined);
    return {
      dramaticIntent: 'tactical_planning',
      emotionalState: 'reflective',
      action: isCoffee ? 'coffee_sip' : isBook ? 'reading_book' : 'thinking',
      expression: hasQuestion ? 'talking' : 'confident',
      environment: 'luxury_penthouse',
      timeOfDay: 'night',
      weatherOrAtmosphere: 'clear',
      lightingMood: 'cold_noir',
      cameraEffect: 'zoom_in',
      framing: 'close_dramatic',
      soundEffect: 'ding_idea',
      visualFilter: 'vignette',
      floatingIcon: hasQuestion ? 'question' : 'lightbulb',
      prop: isCoffee ? 'coffee' : isBook ? 'book' : 'none',
      objectRefs: ['janela_panoramica', isCoffee ? 'xicara_cafe' : 'livro'],
      requiresOpponent: false,
      baseIntensity: clamp(0.42 + seedVar, 0.2, 0.72),
      baseAnticipation: clamp(0.32 + seedVar, 0.15, 0.65),
      baseReaction: clamp(0.38 + seedVar, 0.15, 0.7),
      baseSettle: 0.72,
    };
  }

  // Default contextual narrative explanation / city walk (varied by seed, never by hardcoded idx === 1)
  const useWalk = seededUnitFloat(seed, 2) > 0.45;
  return {
    dramaticIntent: hasExclamation ? 'revelation' : 'introduce_conflict',
    emotionalState: hasExclamation ? 'urgent' : 'curious',
    action: useWalk ? 'walk_city' : 'talk_explaining',
    expression: hasExclamation ? 'determined' : 'talking',
    environment: useWalk ? 'city_downtown' : 'spotlight_dark',
    timeOfDay: 'night',
    weatherOrAtmosphere: 'clear',
    lightingMood: 'neutral',
    cameraEffect: hasExclamation ? 'pulse' : 'zoom_in',
    framing: 'medium_action',
    soundEffect: 'whoosh',
    visualFilter: 'cinemascope',
    floatingIcon: hasQuestion ? 'question' : 'none',
    prop: useWalk ? 'briefcase' : 'none',
    objectRefs: ['cenario_principal'],
    requiresOpponent: false,
    baseIntensity: clamp(0.58 + seedVar, 0.25, 0.88),
    baseAnticipation: clamp(0.42 + seedVar, 0.2, 0.75),
    baseReaction: clamp(0.5 + seedVar, 0.2, 0.8),
    baseSettle: 0.58,
  };
}

/**
 * Selects complementary contextual actions across narrative phases (opening -> development -> climax -> settle)
 * so beats evolve naturally within a scene without repeating the exact same posture/maneuver.
 */
function pickContextualBeatProgression(
  primaryAction: StickmanAction,
  phase: NarrativeBeatPhase,
  beatIdx: number,
  seed: number,
  snippetLower: string
): { action: StickmanAction; maneuver: DynamicManeuver; expression: StickmanExpression; jumpArc: number } {
  const r = seededUnitFloat(seed, beatIdx * 7 + 3);

  // Check if the spoken snippet itself triggers a specific micro-action
  if (/drift|curva|freio/.test(snippetLower)) {
    return { action: 'car_drift', maneuver: 'car_handbrake_drift', expression: 'determined', jumpArc: 0 };
  }
  if (/nitro|aceler|fogo/.test(snippetLower) && /drive_car|car_chase|car_drift/.test(primaryAction)) {
    return { action: 'drive_car', maneuver: 'nitro_boost', expression: 'laughing', jumpArc: -10 };
  }
  if (/espada|katana|corte|lâmina/.test(snippetLower)) {
    return { action: 'sword_duel', maneuver: beatIdx % 2 === 0 ? 'parry' : 'spin_360', expression: 'intense', jumpArc: -16 };
  }
  if (/salt|pulo|voo|aterriss/.test(snippetLower)) {
    return { action: 'hero_landing', maneuver: 'jump_shock', expression: 'determined', jumpArc: -32 };
  }
  if (/pânico|medo|choque|perigo/.test(snippetLower)) {
    return { action: 'panic_freakout', maneuver: 'jump_shock', expression: 'shocked', jumpArc: -12 };
  }
  if (/pens|analis|plano|ideia/.test(snippetLower) && primaryAction !== 'car_chase') {
    return { action: 'thinking', maneuver: 'pace_back_forth', expression: 'confident', jumpArc: 0 };
  }

  // Vehicle progression
  if (
    primaryAction === 'drive_car' ||
    primaryAction === 'car_chase' ||
    primaryAction === 'car_drift' ||
    primaryAction === 'car_police' ||
    primaryAction === 'motorcycle'
  ) {
    const vehiclePhases: Record<
      NarrativeBeatPhase,
      { action: StickmanAction; maneuver: DynamicManeuver; expression: StickmanExpression; jumpArc: number }
    > = {
      opening_anticipation: {
        action: primaryAction === 'motorcycle' ? 'motorcycle' : 'drive_car',
        maneuver: 'car_accelerate_surge',
        expression: 'confident',
        jumpArc: -4,
      },
      development_action: {
        action: primaryAction === 'motorcycle' ? 'motorcycle' : 'car_chase',
        maneuver: r > 0.5 ? 'car_lane_swerve' : 'swerve_dodge',
        expression: 'intense',
        jumpArc: -6,
      },
      climax_reaction: {
        action: primaryAction === 'motorcycle' ? 'motorcycle' : 'car_drift',
        maneuver: r > 0.5 ? 'car_handbrake_drift' : 'nitro_boost',
        expression: 'determined',
        jumpArc: -8,
      },
      settle_recovery: {
        action: primaryAction,
        maneuver: 'drift_right',
        expression: 'confident',
        jumpArc: 0,
      },
    };
    return vehiclePhases[phase];
  }

  // Combat / Duel progression
  if (primaryAction === 'fight_kungfu' || primaryAction === 'sword_duel' || primaryAction === 'hero_landing') {
    const combatPhases: Record<
      NarrativeBeatPhase,
      { action: StickmanAction; maneuver: DynamicManeuver; expression: StickmanExpression; jumpArc: number }
    > = {
      opening_anticipation: {
        action: 'running',
        maneuver: 'sprint_across',
        expression: 'determined',
        jumpArc: 0,
      },
      development_action: {
        action: primaryAction === 'sword_duel' ? 'sword_duel' : 'fight_kungfu',
        maneuver: primaryAction === 'sword_duel' ? 'parry' : 'slide_kick',
        expression: 'intense',
        jumpArc: -14,
      },
      climax_reaction: {
        action: primaryAction,
        maneuver: primaryAction === 'sword_duel' ? 'spin_360' : 'combat_combo_rush',
        expression: 'angry',
        jumpArc: -28,
      },
      settle_recovery: {
        action: 'hero_landing',
        maneuver: 'dodge_slide',
        expression: 'confident',
        jumpArc: -10,
      },
    };
    return combatPhases[phase];
  }

  // Survival progression
  if (primaryAction === 'zombie_survive_barricade' || primaryAction === 'scavenge_supplies') {
    const survivalPhases: Record<
      NarrativeBeatPhase,
      { action: StickmanAction; maneuver: DynamicManeuver; expression: StickmanExpression; jumpArc: number }
    > = {
      opening_anticipation: {
        action: 'thinking',
        maneuver: 'enter_left',
        expression: 'intense',
        jumpArc: 0,
      },
      development_action: {
        action: 'scavenge_supplies',
        maneuver: 'pace_back_forth',
        expression: 'determined',
        jumpArc: -4,
      },
      climax_reaction: {
        action: 'zombie_survive_barricade',
        maneuver: 'parry',
        expression: 'angry',
        jumpArc: -8,
      },
      settle_recovery: {
        action: 'command_crowd',
        maneuver: 'hologram_present',
        expression: 'confident',
        jumpArc: 0,
      },
    };
    return survivalPhases[phase];
  }

  // Wealth / Trillionaire progression
  if (primaryAction === 'trillion_buy_everything' || primaryAction === 'money_celebrate') {
    const wealthPhases: Record<
      NarrativeBeatPhase,
      { action: StickmanAction; maneuver: DynamicManeuver; expression: StickmanExpression; jumpArc: number }
    > = {
      opening_anticipation: {
        action: 'thinking',
        maneuver: 'enter_left',
        expression: 'confident',
        jumpArc: 0,
      },
      development_action: {
        action: 'trillion_buy_everything',
        maneuver: 'hologram_present',
        expression: 'smile',
        jumpArc: 0,
      },
      climax_reaction: {
        action: 'money_celebrate',
        maneuver: 'backflip_celebrate',
        expression: 'laughing',
        jumpArc: -16,
      },
      settle_recovery: {
        action: 'command_crowd',
        maneuver: 'pace_back_forth',
        expression: 'confident',
        jumpArc: 0,
      },
    };
    return wealthPhases[phase];
  }

  // General expressive / dramatic progression
  const generalPool: {
    action: StickmanAction;
    maneuver: DynamicManeuver;
    expression: StickmanExpression;
    jumpArc: number;
  }[] = [
    { action: 'walk_city', maneuver: 'enter_left', expression: 'talking', jumpArc: 0 },
    { action: primaryAction, maneuver: 'hologram_present', expression: 'confident', jumpArc: 0 },
    { action: 'thinking', maneuver: 'pace_back_forth', expression: 'determined', jumpArc: 0 },
    { action: 'presentation_stage', maneuver: 'none', expression: 'smile', jumpArc: -4 },
    { action: 'command_crowd', maneuver: 'hologram_present', expression: 'intense', jumpArc: 0 },
    { action: 'talk_explaining', maneuver: 'pace_back_forth', expression: 'talking', jumpArc: 0 },
  ];

  const idxChoice = Math.floor(r * generalPool.length) % generalPool.length;
  return generalPool[(idxChoice + beatIdx) % generalPool.length];
}

/**
 * Generates a complete, deterministically seeded array of `CinematicBeatPlan` items
 * covering relative time [0..1] in strict order with anticipation, action, reaction, and settle phases.
 */
export function buildDirectedBeatPlans(options: {
  sceneId: string;
  narration: string;
  durationSec: number;
  sceneSeed: number;
  context: InferredSceneContext;
  entryX?: number;
  hasCharacter2?: boolean;
}): CinematicBeatPlan[] {
  const {
    sceneId,
    narration,
    durationSec,
    sceneSeed,
    context,
    entryX = 0.34,
    hasCharacter2 = context.requiresOpponent,
  } = options;

  const dur = Math.max(2, durationSec || 4.5);
  const cleanText = (narration || '').trim();
  const words = cleanText.length > 0 ? cleanText.split(/\s+/) : ['Cena', 'em', 'execução'];

  const targetBeatDur = dur <= 6.5 ? 1.45 : dur <= 15 ? 1.95 : 2.5;
  const numBeats = Math.max(3, Math.min(24, Math.round(dur / targetBeatDur)));
  const wordsPerBeat = Math.max(1, Math.ceil(words.length / numBeats));

  const chunks: string[] = [];
  for (let i = 0; i < words.length; i += wordsPerBeat) {
    chunks.push(words.slice(i, i + wordsPerBeat).join(' '));
  }
  while (chunks.length < 3) {
    chunks.push(chunks[chunks.length - 1] || '...');
  }

  const totalBeats = chunks.length;
  const beats: CinematicBeatPlan[] = [];

  let currX = clamp(entryX, 0.22, 0.74);
  let currChar2X = 0.68;
  let prevAction: StickmanAction | null = null;
  let prevManeuver: DynamicManeuver | null = null;

  for (let i = 0; i < totalBeats; i++) {
    const relStart = Math.round((i / totalBeats) * 1000) / 1000;
    const relEnd = i === totalBeats - 1 ? 1.0 : Math.round(((i + 1) / totalBeats) * 1000) / 1000;
    const beatSeed = computeDeterministicSeed(`${sceneId}_beat_${i}`, sceneSeed + i * 31);

    const narrativePhase: NarrativeBeatPhase =
      i === 0
        ? 'opening_anticipation'
        : i === totalBeats - 1
        ? 'settle_recovery'
        : i === Math.floor(totalBeats * 0.65)
        ? 'climax_reaction'
        : 'development_action';

    const snippet = chunks[i];
    let prog = pickContextualBeatProgression(
      context.action,
      narrativePhase,
      i,
      beatSeed,
      snippet.toLowerCase()
    );

    // Anti-repetition guard across consecutive beats
    if (prog.action === prevAction && prog.maneuver === prevManeuver) {
      prog = pickContextualBeatProgression(
        context.action,
        narrativePhase === 'development_action' ? 'climax_reaction' : 'development_action',
        i + 1,
        beatSeed + 17,
        ''
      );
      if (prog.action === prevAction) {
        prog = {
          ...prog,
          action: prog.action === 'talk_explaining' ? 'walk_city' : 'talk_explaining',
          maneuver: prog.maneuver === 'pace_back_forth' ? 'hologram_present' : 'pace_back_forth',
        };
      }
    }

    // Compute deterministic horizontal trajectory with bounded step (<= 0.14 screen width)
    const dirSign = seededUnitFloat(beatSeed, 1) > 0.45 ? 1 : -1;
    const stepMag = 0.06 + seededUnitFloat(beatSeed, 2) * 0.07; // [0.06 .. 0.13]
    let nextX = currX + dirSign * stepMag;
    if (nextX < 0.22 || nextX > 0.74) {
      nextX = currX - dirSign * stepMag;
    }
    nextX = Math.round(clamp(nextX, 0.22, 0.74) * 1000) / 1000;

    const nextChar2X = hasCharacter2
      ? Math.round(
          clamp(
            currChar2X + (currChar2X > 0.62 ? -0.06 : 0.06),
            0.52,
            0.78
          ) * 1000
        ) / 1000
      : undefined;

    // Phase-modulated kinematic parameters
    const phaseMultiplier =
      narrativePhase === 'climax_reaction'
        ? 1.15
        : narrativePhase === 'opening_anticipation'
        ? 0.9
        : narrativePhase === 'settle_recovery'
        ? 0.78
        : 1.0;

    const intensity =
      Math.round(clamp(context.baseIntensity * phaseMultiplier, 0.18, 1.0) * 100) / 100;
    const anticipation =
      Math.round(
        clamp(
          narrativePhase === 'opening_anticipation'
            ? context.baseAnticipation * 1.25
            : context.baseAnticipation,
          0.1,
          1.0
        ) * 100
      ) / 100;
    const reaction =
      Math.round(
        clamp(
          narrativePhase === 'climax_reaction'
            ? context.baseReaction * 1.25
            : context.baseReaction,
          0.1,
          1.0
        ) * 100
      ) / 100;
    const settle =
      Math.round(
        clamp(
          narrativePhase === 'settle_recovery' ? context.baseSettle * 1.3 : context.baseSettle,
          0.15,
          1.0
        ) * 100
      ) / 100;
    const weightShift =
      Math.round(((nextX - currX) * 4.5 + (seededUnitFloat(beatSeed, 5) - 0.5) * 0.2) * 100) /
      100;

    const contactConstraints: CinematicBeatPlan['contactConstraints'] = [
      /drive_car|car_chase|car_drift|car_police|motorcycle/.test(prog.action)
        ? 'vehicle_seat'
        : 'ground_feet',
    ];
    if (context.prop !== 'none') contactConstraints.push('prop_hand');
    if (prog.action === 'zombie_survive_barricade') contactConstraints.push('barricade_brace');

    beats.push({
      beatId: `${sceneId}_beat_${i}`,
      relStart,
      relEnd,
      narrativePhase,
      dramaticIntent: `${context.dramaticIntent}:${narrativePhase}`,
      spokenSegment: snippet,
      action: prog.action,
      secondaryAction: hasCharacter2 ? context.secondaryAction || 'fight_kungfu' : undefined,
      expression: prog.expression,
      maneuver: prog.maneuver,
      prop: context.prop,
      cameraEffect:
        narrativePhase === 'climax_reaction' ? context.cameraEffect : 'none',
      floatingIcon:
        narrativePhase === 'climax_reaction' ? context.floatingIcon : 'none',
      intensity,
      anticipation,
      reaction,
      settle,
      weightShift: clamp(weightShift, -1, 1),
      fromX: currX,
      toX: nextX,
      char2FromX: hasCharacter2 ? currChar2X : undefined,
      char2ToX: nextChar2X,
      jumpArc: prog.jumpArc,
      finalPoseHold: narrativePhase === 'settle_recovery',
      contactConstraints,
      seed: beatSeed,
    });

    currX = nextX;
    if (nextChar2X !== undefined) currChar2X = nextChar2X;
    prevAction = prog.action;
    prevManeuver = prog.maneuver;
  }

  return beats;
}

/**
 * Converts a `CinematicBeatPlan[]` + `duration` into runtime `ChoreographyBeat[]`
 * consumed by `choreographyEngine.ts` and `stickmanRenderer.ts`.
 */
export function convertBeatPlansToChoreography(
  sceneId: string,
  durationSec: number,
  beatPlans: CinematicBeatPlan[],
  baseAction: StickmanAction
): ChoreographyBeat[] {
  const dur = Math.max(1, durationSec || 4.5);
  return beatPlans.map((bp, idx) => {
    const startTime = Math.round(bp.relStart * dur * 100) / 100;
    const endTime = Math.round(bp.relEnd * dur * 100) / 100;
    const prevAction = idx === 0 ? baseAction : beatPlans[idx - 1].action;
    return {
      id: bp.beatId || `${sceneId}_beat_${idx}`,
      startTime,
      endTime,
      relStart: bp.relStart,
      relEnd: bp.relEnd,
      narrativePhase: bp.narrativePhase,
      dramaticIntent: bp.dramaticIntent,
      label: `[${bp.narrativePhase}] ${bp.action} (${bp.maneuver})`,
      spokenText: bp.spokenSegment,
      action: bp.action,
      prevAction,
      char2Action: bp.secondaryAction,
      expression: bp.expression,
      prop: bp.prop || 'none',
      fromX: bp.fromX,
      toX: bp.toX,
      char2FromX: bp.char2FromX,
      char2ToX: bp.char2ToX,
      jumpArc: bp.jumpArc,
      maneuver: bp.maneuver,
      cameraEffect: bp.cameraEffect,
      floatingIcon: bp.floatingIcon,
      intensity: bp.intensity,
      anticipation: bp.anticipation,
      reaction: bp.reaction,
      settle: bp.settle,
      weightShift: bp.weightShift,
      seed: bp.seed,
      timeRange: `${startTime.toFixed(1)}s - ${endTime.toFixed(1)}s`,
      words: bp.spokenSegment,
    };
  });
}

/**
 * Validates and normalizes a single scene (from AI response, user import, or fallback),
 * ensuring valid enums, contextual fallback (never index-based), beat ordering,
 * character continuity across scenes, and honest limitation reporting.
 */
export function validateAndNormalizeScenePlan(
  rawScene: any,
  index: number,
  prevScene?: StickmanScene,
  storySeed = 1001
): StickmanScene {
  const safeObj = rawScene && typeof rawScene === 'object' ? rawScene : {};
  const id =
    typeof safeObj.id === 'string' && safeObj.id.trim()
      ? safeObj.id.trim()
      : `scene_${index + 1}_${storySeed}`;
  const title =
    typeof safeObj.title === 'string' && safeObj.title.trim()
      ? safeObj.title.trim()
      : typeof safeObj.name === 'string' && safeObj.name.trim()
      ? safeObj.name.trim()
      : `Cena ${index + 1}`;
  const narration =
    typeof safeObj.narration === 'string' && safeObj.narration.trim()
      ? safeObj.narration.trim()
      : `${title}. A história avança com intensidade.`;

  const sceneSeed =
    typeof safeObj.seed === 'number' && Number.isFinite(safeObj.seed)
      ? Math.abs(Math.trunc(safeObj.seed)) || 1
      : typeof safeObj.scenePlan?.sceneSeed === 'number'
      ? Math.abs(Math.trunc(safeObj.scenePlan.sceneSeed)) || 1
      : computeDeterministicSeed(`${id}:${title}:${narration}`, storySeed + index * 97);

  // Infer contextual defaults from narration & title (never by index)
  const inferred = inferContextFromText(narration, title, sceneSeed);

  // Duration calibrated with ElevenLabs WPM if missing or out of bounds
  const timing = calculateElevenLabsTiming(narration, 155);
  const rawDuration = Number(safeObj.duration);
  const duration =
    Number.isFinite(rawDuration) && rawDuration >= 1.8 && rawDuration <= 120
      ? Math.round(rawDuration * 10) / 10
      : timing.totalDurationSec;

  // Validate top-level or nested character1/environment/camera fields
  const rawPlan = safeObj.scenePlan && typeof safeObj.scenePlan === 'object' ? safeObj.scenePlan : {};

  const dramaticIntent: DramaticIntent = isOneOf(
    rawPlan.dramaticIntent ?? safeObj.dramaticIntent,
    VALID_DRAMATIC_INTENTS
  )
    ? (rawPlan.dramaticIntent ?? safeObj.dramaticIntent)
    : inferred.dramaticIntent;

  const emotionalState: EmotionalArcState = isOneOf(
    rawPlan.emotionalState ?? safeObj.emotionalState,
    VALID_EMOTIONAL_STATES
  )
    ? (rawPlan.emotionalState ?? safeObj.emotionalState)
    : inferred.emotionalState;

  const rawAction =
    safeObj.character1?.action ?? safeObj.action ?? rawPlan.primaryAction;
  const action: StickmanAction = isOneOf(rawAction, VALID_ACTIONS)
    ? rawAction
    : inferred.action;

  const rawExpression =
    safeObj.character1?.expression ?? safeObj.expression ?? rawPlan.expression;
  const expression: StickmanExpression = isOneOf(rawExpression, VALID_EXPRESSIONS)
    ? rawExpression
    : inferred.expression;

  const rawProp = safeObj.character1?.prop ?? safeObj.prop ?? rawPlan.prop;
  const prop: NonNullable<SceneCharacter['prop']> = isOneOf(rawProp, VALID_PROPS)
    ? rawProp
    : inferred.prop;

  const rawEnv =
    safeObj.environment ?? rawPlan.environmentPlan?.theme ?? safeObj.environmentTheme;
  const environment: EnvironmentTheme = isOneOf(rawEnv, VALID_ENVIRONMENTS)
    ? rawEnv
    : inferred.environment;

  const rawCamera =
    safeObj.cameraEffect ?? rawPlan.cameraPlan?.cameraEffect ?? safeObj.camera;
  const cameraEffect: CameraEffect = isOneOf(rawCamera, VALID_CAMERAS)
    ? rawCamera
    : inferred.cameraEffect;

  const rawSfx = safeObj.soundEffect ?? safeObj.sfx;
  const soundEffect: SoundEffectType = isOneOf(rawSfx, VALID_SFX)
    ? rawSfx
    : inferred.soundEffect;

  const rawFilter = safeObj.visualFilter ?? safeObj.filter;
  const visualFilter: VisualFilter = isOneOf(rawFilter, VALID_FILTERS)
    ? rawFilter
    : inferred.visualFilter;

  const rawIcon = safeObj.floatingIcon ?? safeObj.icon;
  const floatingIcon: FloatingVfxIcon = isOneOf(rawIcon, VALID_ICONS)
    ? rawIcon
    : inferred.floatingIcon;

  // Continuity with previous scene
  const prevChar1Ref = prevScene?.scenePlan?.characters?.[0];
  const prevEnv = prevScene?.environment;
  const isSameLocation = prevEnv !== undefined && prevEnv === environment;

  const continuityFromPrevScene: CinematicEnvironmentPlan['continuityFromPrevScene'] =
    index === 0
      ? 'new_location'
      : isSameLocation
      ? 'same_location'
      : 'new_location';

  const entryX =
    isSameLocation && prevChar1Ref
      ? clamp(prevChar1Ref.exitNormalizedX, 0.22, 0.74)
      : 0.34;

  // Character 1 identity continuity across scenes
  const char1Name =
    typeof safeObj.character1?.name === 'string' && safeObj.character1.name.trim()
      ? safeObj.character1.name.trim()
      : prevScene?.character1?.name || 'Protagonista';
  const char1Color =
    typeof safeObj.character1?.color === 'string' && safeObj.character1.color.startsWith('#')
      ? safeObj.character1.color
      : prevScene?.character1?.color || '#38BDF8';
  const char1Scale =
    typeof safeObj.character1?.scale === 'number'
      ? clamp(safeObj.character1.scale, 0.6, 1.5)
      : prevScene?.character1?.scale || 1.0;

  // Character 2 (Opponent / Secondary Character)
  const hasExplicitChar2 = Boolean(safeObj.character2 && typeof safeObj.character2 === 'object');
  const shouldIncludeChar2 = hasExplicitChar2 || inferred.requiresOpponent;

  const character2: SceneCharacter | undefined = shouldIncludeChar2
    ? {
        name:
          typeof safeObj.character2?.name === 'string' && safeObj.character2.name.trim()
            ? safeObj.character2.name.trim()
            : inferred.opponentName || 'Rival',
        color:
          typeof safeObj.character2?.color === 'string' && safeObj.character2.color.startsWith('#')
            ? safeObj.character2.color
            : inferred.opponentColor || '#DC2626',
        action: isOneOf(safeObj.character2?.action, VALID_ACTIONS)
          ? safeObj.character2.action
          : inferred.secondaryAction || 'fight_kungfu',
        expression: isOneOf(safeObj.character2?.expression, VALID_EXPRESSIONS)
          ? safeObj.character2.expression
          : 'angry',
        prop: isOneOf(safeObj.character2?.prop, VALID_PROPS)
          ? safeObj.character2.prop
          : action === 'sword_duel'
          ? 'sword'
          : 'none',
        position: 'right',
      }
    : undefined;

  // Build or normalize beat plans
  const rawBeats: any[] = Array.isArray(rawPlan.beats)
    ? rawPlan.beats
    : Array.isArray(safeObj.beats)
    ? safeObj.beats
    : [];

  let beatPlans: CinematicBeatPlan[];

  if (rawBeats.length >= 2) {
    // Normalize & validate provided AI beats, enforcing monotonic [0..1] intervals and spatial continuity
    const count = rawBeats.length;
    let cursorX = entryX;
    let cursorC2X = 0.68;

    beatPlans = rawBeats.map((rb: any, bIdx: number) => {
      const relStart = Math.round((bIdx / count) * 1000) / 1000;
      const relEnd = bIdx === count - 1 ? 1.0 : Math.round(((bIdx + 1) / count) * 1000) / 1000;
      const bSeed =
        typeof rb?.seed === 'number'
          ? Math.abs(Math.trunc(rb.seed)) || 1
          : computeDeterministicSeed(`${id}_beat_${bIdx}`, sceneSeed + bIdx * 31);

      const narrativePhase: NarrativeBeatPhase =
        rb?.narrativePhase === 'opening_anticipation' ||
        rb?.narrativePhase === 'development_action' ||
        rb?.narrativePhase === 'climax_reaction' ||
        rb?.narrativePhase === 'settle_recovery'
          ? rb.narrativePhase
          : bIdx === 0
          ? 'opening_anticipation'
          : bIdx === count - 1
          ? 'settle_recovery'
          : 'development_action';

      const bAction: StickmanAction = isOneOf(rb?.action, VALID_ACTIONS)
        ? rb.action
        : bIdx === 0
        ? action
        : pickContextualBeatProgression(
            action,
            narrativePhase,
            bIdx,
            bSeed,
            String(rb?.spokenSegment || '').toLowerCase()
          ).action;

      const bManeuver: DynamicManeuver = isOneOf(rb?.maneuver, VALID_MANEUVERS)
        ? rb.maneuver
        : pickContextualBeatProgression(action, narrativePhase, bIdx, bSeed, '').maneuver;

      const bExpression: StickmanExpression = isOneOf(rb?.expression, VALID_EXPRESSIONS)
        ? rb.expression
        : expression;

      const rawToX = Number(rb?.toX);
      let toX = Number.isFinite(rawToX) ? clamp(rawToX, 0.22, 0.74) : cursorX + (bIdx % 2 === 0 ? 0.08 : -0.08);
      if (Math.abs(toX - cursorX) > 0.14) {
        toX = cursorX + Math.sign(toX - cursorX) * 0.14;
      }
      toX = Math.round(clamp(toX, 0.22, 0.74) * 1000) / 1000;

      const fromX = cursorX;
      cursorX = toX;

      const nextC2X = character2
        ? Math.round(clamp(cursorC2X + (bIdx % 2 === 0 ? -0.05 : 0.05), 0.52, 0.78) * 1000) / 1000
        : undefined;
      const c2From = character2 ? cursorC2X : undefined;
      if (nextC2X !== undefined) cursorC2X = nextC2X;

      return {
        beatId: `${id}_beat_${bIdx}`,
        relStart,
        relEnd,
        narrativePhase,
        dramaticIntent:
          typeof rb?.dramaticIntent === 'string' && rb.dramaticIntent.trim()
            ? rb.dramaticIntent.trim()
            : `${dramaticIntent}:${narrativePhase}`,
        spokenSegment:
          typeof rb?.spokenSegment === 'string' && rb.spokenSegment.trim()
            ? rb.spokenSegment.trim()
            : narration,
        action: bAction,
        secondaryAction: character2 ? character2.action : undefined,
        expression: bExpression,
        maneuver: bManeuver,
        prop,
        cameraEffect: isOneOf(rb?.cameraEffect, VALID_CAMERAS) ? rb.cameraEffect : cameraEffect,
        floatingIcon: isOneOf(rb?.floatingIcon, VALID_ICONS) ? rb.floatingIcon : floatingIcon,
        intensity: clamp(Number(rb?.intensity ?? inferred.baseIntensity), 0.15, 1.0),
        anticipation: clamp(Number(rb?.anticipation ?? inferred.baseAnticipation), 0.0, 1.0),
        reaction: clamp(Number(rb?.reaction ?? inferred.baseReaction), 0.0, 1.0),
        settle: clamp(Number(rb?.settle ?? inferred.baseSettle), 0.0, 1.0),
        weightShift: clamp(Number(rb?.weightShift ?? (toX - fromX) * 4), -1.0, 1.0),
        fromX,
        toX,
        char2FromX: c2From,
        char2ToX: nextC2X,
        jumpArc: clamp(Number(rb?.jumpArc ?? 0), -45, 0),
        finalPoseHold: narrativePhase === 'settle_recovery',
        contactConstraints: ['ground_feet'],
        seed: bSeed,
      };
    });
  } else {
    beatPlans = buildDirectedBeatPlans({
      sceneId: id,
      narration,
      durationSec: duration,
      sceneSeed,
      context: {
        ...inferred,
        dramaticIntent,
        emotionalState,
        action,
        expression,
        environment,
        cameraEffect,
        soundEffect,
        visualFilter,
        floatingIcon,
        prop,
      },
      entryX,
      hasCharacter2: Boolean(character2),
    });
  }

  const exitX = beatPlans.length > 0 ? beatPlans[beatPlans.length - 1].toX : entryX;

  const framing: CinematicCameraPlan['framing'] =
    rawPlan.cameraPlan?.framing === 'wide_establishing' ||
    rawPlan.cameraPlan?.framing === 'medium_action' ||
    rawPlan.cameraPlan?.framing === 'close_dramatic' ||
    rawPlan.cameraPlan?.framing === 'tracking_shot'
      ? rawPlan.cameraPlan.framing
      : inferred.framing;

  const characters: CinematicCharacterRef[] = [
    {
      characterId: 'protagonist',
      name: char1Name,
      role: 'protagonist',
      color: char1Color,
      scale: char1Scale,
      defaultProp: prop,
      entryNormalizedX: entryX,
      exitNormalizedX: exitX,
      facingDirection: exitX >= entryX ? 'right' : 'left',
      emotionalState,
    },
  ];

  if (character2) {
    characters.push({
      characterId: 'secondary_actor',
      name: character2.name,
      role: 'antagonist',
      color: character2.color,
      scale: 1.0,
      defaultProp: character2.prop,
      entryNormalizedX: beatPlans[0]?.char2FromX ?? 0.68,
      exitNormalizedX: beatPlans[beatPlans.length - 1]?.char2ToX ?? 0.64,
      facingDirection: 'left',
      emotionalState: 'furious',
    });
  }

  const limitations: string[] = [
    'biomechanical2BoneIKActive: O solver analítico de 2 ossos (solveTwoBoneIK) realiza foot-planting no plano do solo e alcance de âncoras de cenário (SceneAnchors), mas não executa malha de colisão física rígida arbitrária.',
    'proceduralEnvironmentCatalog: O renderer 2D executa todos os 21 temas procedurais, partículas climáticas (rain, fog, toxic_mist, smoke_ash) e iluminação volumétrica (lightingMood), mas não sintetiza geometria 3D fora do catálogo.',
  ];

  const scenePlan: CinematicScenePlan = {
    planVersion: '1.0',
    sceneSeed,
    dramaticIntent,
    emotionalState,
    narrativeSummary:
      typeof rawPlan.narrativeSummary === 'string' && rawPlan.narrativeSummary.trim()
        ? rawPlan.narrativeSummary.trim()
        : `${title} — ${dramaticIntent} (${emotionalState})`,
    environmentPlan: {
      theme: environment,
      timeOfDay: inferred.timeOfDay,
      weatherOrAtmosphere: inferred.weatherOrAtmosphere,
      lightingMood: inferred.lightingMood,
      continuityFromPrevScene,
      scenicObjects: Array.isArray(rawPlan.environmentPlan?.scenicObjects)
        ? rawPlan.environmentPlan.scenicObjects.map(String)
        : inferred.objectRefs,
      rendererSupport: {
        themeSupported: true,
        atmosphereMetadataOnly: false,
        lightingMetadataOnly: false,
        objectsMetadataOnly: false,
      },
    },
    cameraPlan: {
      framing,
      cameraEffect,
      intensity: clamp(Number(rawPlan.cameraPlan?.intensity ?? inferred.baseIntensity), 0.1, 1.0),
      focusTarget: character2 ? 'both' : 'character1',
      rendererSupport: {
        cameraEffectSupported: true,
        framingSimulatedViaZoom: true,
      },
    },
    characters,
    objectRefs: Array.isArray(rawPlan.objectRefs)
      ? rawPlan.objectRefs.map(String)
      : inferred.objectRefs,
    beats: beatPlans,
    transitionToNext:
      rawPlan.transitionToNext === 'match_action' ||
      rawPlan.transitionToNext === 'pan_continuous' ||
      rawPlan.transitionToNext === 'fade_dramatic'
        ? rawPlan.transitionToNext
        : isSameLocation
        ? 'match_action'
        : 'cut',
    limitations,
  };

  const choreography = convertBeatPlansToChoreography(id, duration, beatPlans, action);

  return {
    id,
    title,
    chapter: typeof safeObj.chapter === 'string' ? safeObj.chapter : `Ato ${index + 1}`,
    duration,
    narration,
    character1: {
      name: char1Name,
      color: char1Color,
      action,
      expression,
      prop,
      position: 'center',
      scale: char1Scale,
    },
    character2,
    environment,
    cameraEffect,
    soundEffect,
    visualFilter,
    floatingIcon,
    choreography,
    scenePlan,
    seed: sceneSeed,
    highlightWords: Array.isArray(safeObj.highlightWords)
      ? safeObj.highlightWords.map(String)
      : undefined,
  };
}

/**
 * Splits a raw story/script into logical narrative segments and generates a context-directed
 * multi-scene plan when AI is offline or returns malformed JSON.
 */
export function buildContextualDirectorFallback(
  script: string,
  aspectRatio: '16:9' | '9:16' = '16:9'
): {
  title: string;
  aspectRatio: '16:9' | '9:16';
  scenes: StickmanScene[];
  fallbackUsed: boolean;
  limitations: string[];
} {
  const cleanScript = (script || '').trim();
  const storySeed = computeDeterministicSeed(cleanScript || 'default_story_seed');

  // Split by paragraphs or sentences into 3..6 coherent narrative beats
  const rawSentences = cleanScript
    ? cleanScript
        .split(/(?<=[.!?])\s+|\n+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 3)
    : [];

  let segments: string[];
  if (rawSentences.length >= 3) {
    segments = rawSentences.slice(0, 8);
  } else if (rawSentences.length === 2) {
    segments = [
      rawSentences[0],
      rawSentences[1],
      `${rawSentences[1]} O desfecho exige ação imediata.`,
    ];
  } else if (rawSentences.length === 1) {
    const words = rawSentences[0].split(/\s+/);
    if (words.length >= 12) {
      const third = Math.ceil(words.length / 3);
      segments = [
        words.slice(0, third).join(' '),
        words.slice(third, third * 2).join(' '),
        words.slice(third * 2).join(' '),
      ];
    } else {
      segments = [
        rawSentences[0],
        `O cenário muda rapidamente diante de: ${rawSentences[0]}`,
        `A conclusão define o destino após: ${rawSentences[0]}`,
      ];
    }
  } else {
    segments = [
      'O protagonista analisa o cenário estrategicamente antes de agir.',
      'A tensão aumenta rapidamente e exige movimento preciso no terreno.',
      'Com determinação total, ele supera o obstáculo e conclui a missão.',
    ];
  }

  const scenes: StickmanScene[] = [];
  for (let i = 0; i < segments.length; i++) {
    const prev = i > 0 ? scenes[i - 1] : undefined;
    const scene = validateAndNormalizeScenePlan(
      {
        id: `ctx_scene_${i + 1}_${storySeed}`,
        title: `Cena ${i + 1}`,
        narration: segments[i],
      },
      i,
      prev,
      storySeed
    );
    scenes.push(scene);
  }

  const firstWords = cleanScript
    ? cleanScript.split(/\s+/).slice(0, 5).join(' ')
    : 'Direção Cinematográfica StickStory';

  return {
    title: firstWords.length > 4 ? `História: ${firstWords}` : 'Direção Cinematográfica StickStory',
    aspectRatio,
    scenes,
    fallbackUsed: true,
    limitations: [
      'Plano gerado pelo motor semântico determinístico local (fallback seguro).',
      ...(scenes[0]?.scenePlan?.limitations || []),
    ],
  };
}

/**
 * Validates raw JSON or object returned by the AI Director endpoint (or user JSON import).
 * Guarantees a valid `StickmanScene[]` array with full `CinematicScenePlan` contracts,
 * falling back safely to `buildContextualDirectorFallback` if the payload is malformed.
 */
export function validateAndNormalizeDirectorResponse(
  rawPayload: unknown,
  originalScript: string,
  aspectRatio: '16:9' | '9:16' = '16:9'
): {
  title: string;
  aspectRatio: '16:9' | '9:16';
  scenes: StickmanScene[];
  fallbackUsed: boolean;
  limitations: string[];
} {
  try {
    let parsed: any = rawPayload;
    if (typeof rawPayload === 'string') {
      let clean = rawPayload.trim();
      if (clean.startsWith('```json')) {
        clean = clean.replace(/^```json/, '').replace(/```$/, '').trim();
      } else if (clean.startsWith('```')) {
        clean = clean.replace(/^```/, '').replace(/```$/, '').trim();
      }
      parsed = JSON.parse(clean);
    }

    if (!parsed || typeof parsed !== 'object') {
      return buildContextualDirectorFallback(originalScript, aspectRatio);
    }

    const rawScenes = Array.isArray(parsed.scenes)
      ? parsed.scenes
      : Array.isArray(parsed)
      ? parsed
      : null;

    if (!rawScenes || rawScenes.length === 0) {
      return buildContextualDirectorFallback(originalScript, aspectRatio);
    }

    const storySeed = computeDeterministicSeed(
      `${parsed.title || ''}:${originalScript || ''}`
    );

    const normalizedScenes: StickmanScene[] = [];
    for (let i = 0; i < rawScenes.length; i++) {
      const prev = i > 0 ? normalizedScenes[i - 1] : undefined;
      const normalized = validateAndNormalizeScenePlan(rawScenes[i], i, prev, storySeed);
      normalizedScenes.push(normalized);
    }

    return {
      title:
        typeof parsed.title === 'string' && parsed.title.trim()
          ? parsed.title.trim()
          : 'Produção Dirigida por IA',
      aspectRatio,
      scenes: normalizedScenes,
      fallbackUsed: Boolean(parsed.fallbackUsed),
      limitations: normalizedScenes[0]?.scenePlan?.limitations || [],
    };
  } catch {
    return buildContextualDirectorFallback(originalScript, aspectRatio);
  }
}
