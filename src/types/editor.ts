export type TrackType = 'video' | 'audio' | 'text' | 'overlay';

export type ClipType = 'video' | 'audio' | 'image' | 'text' | 'sticker';

export type AspectRatio = '16:9' | '9:16' | '1:1' | '4:5';

export type FilterPreset = 'none' | 'teal-orange' | 'vintage' | 'noir' | 'cyberpunk' | 'warm-sunset' | 'crisp-clean';

export type TransitionType = 'none' | 'dissolve' | 'fade-black' | 'slide-left' | 'wipe' | 'zoom';

export interface ClipTransform {
  x: number; // offset in px or %
  y: number;
  scale: number;
  rotation: number;
  opacity: number;
}

export interface ClipFilters {
  brightness: number; // 0-200, default 100
  contrast: number;   // 0-200, default 100
  saturation: number; // 0-200, default 100
  sepia: number;      // 0-100, default 0
  grayscale: number;  // 0-100, default 0
  blur: number;       // 0-20, default 0
  hueRotate: number;  // 0-360, default 0
  vignette: number;   // 0-1, default 0
  preset: FilterPreset;
}

export interface TextProperties {
  text: string;
  fontFamily: string;
  fontSize: number;
  color: string;
  backgroundColor: string;
  align: 'left' | 'center' | 'right';
  animation: 'none' | 'fade' | 'typewriter' | 'zoom' | 'slide-up';
  bold: boolean;
  shadow: boolean;
}

export interface ClipTransition {
  type: TransitionType;
  duration: number; // in seconds
}

export interface Clip {
  id: string;
  trackId: string;
  name: string;
  type: ClipType;
  startTime: number;     // position on timeline in seconds
  duration: number;      // active duration on timeline
  trimStart: number;     // offset into source in seconds
  trimEnd: number;       // offset from source end or max limit
  sourceDuration: number;
  sourceUrl: string;     // URL or data URL or generator key
  thumbnailUrl?: string;
  speed: number;
  volume: number;        // 0 to 2
  fadeIn: number;
  fadeOut: number;
  transform: ClipTransform;
  filters: ClipFilters;
  textProps?: TextProperties;
  transition?: ClipTransition;
  color?: string;        // timeline block color tag
}

export interface Track {
  id: string;
  type: TrackType;
  name: string;
  muted: boolean;
  hidden: boolean;
  locked: boolean;
  order: number;
}

export interface ProjectState {
  id: string;
  title: string;
  aspectRatio: AspectRatio;
  fps: number;
  duration: number; // in seconds
  tracks: Track[];
  clips: Clip[];
}

export type ActiveTool = 'select' | 'razor' | 'trim';

export interface MediaAsset {
  id: string;
  name: string;
  type: ClipType;
  sourceUrl: string;
  duration: number;
  thumbnailUrl?: string;
  category: string;
}
