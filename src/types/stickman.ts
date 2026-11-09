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

export interface ChoreographyBeat {
  id: string;
  startTime: number; // in seconds within the scene (e.g., 0, 1.2, 2.5...)
  endTime: number;   // in seconds within the scene
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
