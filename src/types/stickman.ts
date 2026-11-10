export type StickmanAction =
  | 'drive_car'
  | 'car_chase'
  | 'car_drift'
  | 'car_police'
  | 'motorcycle'
  | 'walk_city'
  | 'presentation_stage'
  | 'hero_rooftop'
  | 'talk_explaining'
  | 'fight_kungfu'
  | 'sword_duel'
  | 'gun_aim'
  | 'work_computer'
  | 'money_celebrate'
  | 'panic_freakout'
  | 'thinking'
  | 'walking'
  | 'running'
  | 'hero_landing'
  | 'dramatic_fall'
  | 'reading_book'
  | 'coffee_sip'
  | 'zombie_survive_barricade'
  | 'trillion_buy_everything'
  | 'scavenge_supplies'
  | 'command_crowd';

export type StickmanExpression =
  | 'talking'
  | 'smile'
  | 'angry'
  | 'shocked'
  | 'confident'
  | 'sad'
  | 'laughing'
  | 'intense'
  | 'determined';

export type EnvironmentTheme =
  | 'zombie_apocalypse'
  | 'trillionaire_sandbox'
  | 'bunker_survival'
  | 'global_simulation'
  | 'highway_sunset'
  | 'city_downtown'
  | 'police_chase_night'
  | 'bank_heist'
  | 'luxury_penthouse'
  | 'cyber_highway'
  | 'space_station'
  | 'traffic_jam'
  | 'secret_lab'
  | 'interrogation_room'
  | 'finance_trading'
  | 'japanese_dojo'
  | 'hacker_den'
  | 'street_night'
  | 'spotlight_dark'
  | 'money_vault'
  | 'sketch_grid';

export type CameraEffect = 'none' | 'zoom_in' | 'shake' | 'pan_right' | 'pulse';

export type SoundEffectType =
  | 'none'
  | 'car_engine'
  | 'car_screech'
  | 'police_siren'
  | 'nitro_boost'
  | 'punch'
  | 'sword_clash'
  | 'gun_shot'
  | 'whoosh'
  | 'cash_register'
  | 'typing'
  | 'dramatic_boom'
  | 'ding_idea';

export type VisualFilter =
  | 'none'
  | 'cinemascope'
  | 'vignette'
  | 'film_grain'
  | 'crt_cyber'
  | 'money_rain'
  | 'fire_sparks';

export type FloatingVfxIcon =
  | 'none'
  | 'exclamation'
  | 'question'
  | 'lightbulb'
  | 'money_bag'
  | 'fire'
  | 'skull'
  | 'chart_up'
  | 'chart_down'
  | 'target'
  | 'lightning'
  | 'coffee'
  | 'heart';

export type DynamicManeuver =
  | 'none'
  | 'enter_left'
  | 'exit_right'
  | 'pace_back_forth'
  | 'sprint_across'
  | 'jump_shock'
  | 'backflip_celebrate'
  | 'combat_combo_rush'
  | 'dodge_slide'
  | 'hologram_present'
  | 'car_accelerate_surge'
  | 'car_lane_swerve'
  | 'car_overtake_traffic'
  | 'police_ram_sparks'
  | 'car_handbrake_drift'
  | 'helicopter_searchlight'
  | 'drift_left'
  | 'drift_right'
  | 'nitro_boost'
  | 'swerve_dodge'
  | 'backflip'
  | 'slide_kick'
  | 'parry'
  | 'stumble'
  | 'spin_360';

export interface SceneCharacter {
  name: string;
  color: string;
  action: StickmanAction;
  expression: StickmanExpression;
  prop?:
    | 'none'
    | 'sword'
    | 'laptop'
    | 'money'
    | 'coffee'
    | 'phone'
    | 'shield'
    | 'steering_wheel'
    | 'sunglasses'
    | 'briefcase'
    | 'book';
  position: 'left' | 'center' | 'right';
  scale?: number;
}

export type DramaticIntent =
  | 'introduce_conflict'
  | 'escalate_tension'
  | 'revelation'
  | 'climax_confrontation'
  | 'tactical_planning'
  | 'escape_pursuit'
  | 'triumph_celebration'
  | 'despair_setback'
  | 'world_building'
  | 'resolution';

export type EmotionalArcState =
  | 'calm'
  | 'curious'
  | 'tense'
  | 'urgent'
  | 'furious'
  | 'shocked'
  | 'triumphant'
  | 'desperate'
  | 'determined'
  | 'reflective';

export type NarrativeBeatPhase =
  | 'opening_anticipation'
  | 'development_action'
  | 'climax_reaction'
  | 'settle_recovery';

export interface CinematicEnvironmentPlan {
  theme: EnvironmentTheme;
  timeOfDay: 'dawn' | 'day' | 'sunset' | 'night' | 'underground' | 'atemporal';
  weatherOrAtmosphere:
    | 'clear'
    | 'rain'
    | 'fog'
    | 'smoke_ash'
    | 'neon_haze'
    | 'spotlight'
    | 'toxic_mist';
  lightingMood:
    | 'warm_golden'
    | 'cold_noir'
    | 'high_contrast'
    | 'emergency_strobe'
    | 'bioluminescent'
    | 'neutral';
  continuityFromPrevScene:
    | 'same_location'
    | 'continuous_motion'
    | 'time_cut'
    | 'new_location';
  scenicObjects: string[];
  rendererSupport: {
    themeSupported: boolean;
    atmosphereMetadataOnly: boolean;
    lightingMetadataOnly: boolean;
    objectsMetadataOnly: boolean;
  };
}

export interface CinematicCameraPlan {
  framing: 'wide_establishing' | 'medium_action' | 'close_dramatic' | 'tracking_shot';
  cameraEffect: CameraEffect;
  intensity: number; // [0..1]
  focusTarget: 'character1' | 'character2' | 'both' | 'environment';
  rendererSupport: {
    cameraEffectSupported: boolean;
    framingSimulatedViaZoom: boolean;
  };
}

export interface CinematicCharacterRef {
  characterId: string;
  name: string;
  role: 'protagonist' | 'antagonist' | 'ally' | 'crowd_leader';
  color: string;
  scale: number;
  defaultProp?: SceneCharacter['prop'];
  entryNormalizedX: number; // [0.15 .. 0.85]
  exitNormalizedX: number;  // [0.15 .. 0.85]
  facingDirection: 'left' | 'right';
  emotionalState: EmotionalArcState;
}

export interface CinematicBeatPlan {
  beatId: string;
  relStart: number; // [0..1] relative start within scene
  relEnd: number;   // [0..1] relative end within scene
  narrativePhase: NarrativeBeatPhase;
  dramaticIntent: string;
  spokenSegment: string;
  action: StickmanAction;
  secondaryAction?: StickmanAction;
  expression: StickmanExpression;
  maneuver: DynamicManeuver;
  prop?: SceneCharacter['prop'];
  cameraEffect?: CameraEffect;
  floatingIcon?: FloatingVfxIcon;
  intensity: number;    // [0.15 .. 1.0]
  anticipation: number; // [0.0 .. 1.0]
  reaction: number;     // [0.0 .. 1.0]
  settle: number;       // [0.0 .. 1.0]
  weightShift: number;  // [-1.0 .. 1.0]
  fromX: number;        // [0.15 .. 0.85]
  toX: number;          // [0.15 .. 0.85]
  char2FromX?: number;
  char2ToX?: number;
  jumpArc: number;      // px (negative = jump up)
  finalPoseHold?: boolean;
  contactConstraints?: ('ground_feet' | 'vehicle_seat' | 'prop_hand' | 'barricade_brace')[];
  seed: number;
}

export interface CinematicScenePlan {
  planVersion: '1.0';
  sceneSeed: number;
  dramaticIntent: DramaticIntent;
  emotionalState: EmotionalArcState;
  narrativeSummary: string;
  environmentPlan: CinematicEnvironmentPlan;
  cameraPlan: CinematicCameraPlan;
  characters: CinematicCharacterRef[];
  objectRefs: string[];
  beats: CinematicBeatPlan[];
  transitionToNext: 'cut' | 'match_action' | 'pan_continuous' | 'fade_dramatic';
  limitations: string[];
}

export interface ChoreographyBeat {
  id: string;
  startTime: number; // in seconds within the scene (e.g., 0, 1.2, 2.5...)
  endTime: number;   // in seconds within the scene
  relStart?: number; // [0..1] relative start time
  relEnd?: number;   // [0..1] relative end time
  narrativePhase?: NarrativeBeatPhase;
  dramaticIntent?: string;
  label: string;     // human-readable description of what happens in this second
  spokenText?: string;
  action: StickmanAction;
  prevAction?: StickmanAction;
  char2Action?: StickmanAction;
  expression: StickmanExpression;
  prop?: SceneCharacter['prop'];
  fromX: number;     // normalized screen X [0.15 .. 0.85]
  toX: number;       // normalized screen X [0.15 .. 0.85]
  char2FromX?: number;
  char2ToX?: number;
  jumpArc?: number;  // vertical jump height in px during this beat
  maneuver: DynamicManeuver;
  cameraEffect?: CameraEffect;
  floatingIcon?: FloatingVfxIcon;
  intensity?: number;    // [0.15 .. 1.0]
  anticipation?: number; // [0.0 .. 1.0]
  reaction?: number;     // [0.0 .. 1.0]
  settle?: number;       // [0.0 .. 1.0]
  weightShift?: number;  // [-1.0 .. 1.0]
  seed?: number;
  timeRange?: string; // formatted e.g. "0.0s - 1.5s"
  words?: string;     // spoken snippet
}

export interface StickmanScene {
  id: string;
  title: string;
  chapter?: string; // Optional chapter/act (e.g. "Ato 1: O Início")
  duration: number; // in seconds
  narration: string; // the spoken line
  character1: SceneCharacter;
  character2?: SceneCharacter; // optional secondary character or opponent
  environment: EnvironmentTheme;
  cameraEffect: CameraEffect;
  soundEffect: SoundEffectType;
  visualFilter?: VisualFilter;
  floatingIcon?: FloatingVfxIcon;
  choreography?: ChoreographyBeat[]; // Second-by-second distinct actions & movements
  scenePlan?: CinematicScenePlan; // AI Director semantic & temporal plan
  seed?: number; // Deterministic variation seed
  customAudioUrl?: string; // from uploaded ElevenLabs mp3
  customAudioFileName?: string;
  customAudioDuration?: number;
  highlightWords?: string[]; // words to highlight in subtitles
}

export type ElevenLabsPacingPreset =
  | 'eleven_natural_155'
  | 'eleven_dynamic_175'
  | 'eleven_dramatic_135'
  | 'custom';

export interface StickmanProject {
  id: string;
  title: string;
  description: string;
  aspectRatio: '16:9' | '9:16';
  author: string;
  voiceGender: 'male' | 'female';
  voiceSpeed: number;
  wordsPerMinute?: number; // Default 155 WPM (calibrated for ElevenLabs PT-BR)
  elevenLabsPreset?: ElevenLabsPacingPreset;
  audioLatencyOffsetMs?: number;
  savedAt?: string;
  scenes: StickmanScene[];
}

export interface SavedProjectSnapshot {
  id: string;
  title: string;
  savedAt: string;
  sceneCount: number;
  totalDuration: number;
  project: StickmanProject;
}
