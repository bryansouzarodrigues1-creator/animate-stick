import { StickmanAction, CameraEffect, StickmanScene, DynamicManeuver } from '../types/stickman';

export interface LimbAngles {
  leftArmUpper: number;
  leftArmLower: number;
  rightArmUpper: number;
  rightArmLower: number;
  leftLegUpper: number;
  leftLegLower: number;
  rightLegUpper: number;
  rightLegLower: number;
  bodyLean: number;
  headBob: number;
  verticalOffset: number;
  // Loose organic secondary joints
  spineCurve?: number;
  leftWristFlex?: number;
  rightWristFlex?: number;
  leftAnkleFlex?: number;
  rightAnkleFlex?: number;
  shoulderShrug?: number;
  headTilt?: number;
}

export interface WordTimingEntry {
  word: string;
  index: number;
  startSec: number;
  endSec: number;
   pauseAfterSec: number;
  startProgress: number;
  endProgress: number;
}

export interface ElevenLabsTimingResult {
  wordCount: number;
  charCount: number;
  syllableCount: number;
  wpm: number;
  spokenDurationSec: number;
  punctuationPauseSec: number;
  totalDurationSec: number;
  effectiveWpm: number;
  elevenLabsBreakScript: string;
  wordTimings: WordTimingEntry[];
}

/**
 * Estimates syllable count for a Portuguese word.
 */
function countPortugueseSyllables(word: string): number {
  const clean = word
    .toLowerCase()
    .replace(/[^a-záàâãéêíóôõúüç]/g, '');
  if (clean.length <= 2) return 1;
  const vowelGroups = clean.match(/[aáàâãeéêiíoóôõuúü]+/g);
  return Math.max(1, vowelGroups ? vowelGroups.length : Math.ceil(clean.length / 2.6));
}

/**
 * Exact Words-Per-Minute (PPM / WPM) & Pause Timer calibrated for ElevenLabs voices
 * (eleven_multilingual_v2 / eleven_turbo_v2_5 in Brazilian Portuguese).
 * Default WPM = 155 words/minute (ElevenLabs natural narration cadence).
 */
export function calculateElevenLabsTiming(
  narration: string,
  wpm: number = 155
): ElevenLabsTimingResult {
  const safeWpm = Math.max(80, Math.min(260, wpm || 155));
  const raw = (narration || '').trim();
  if (!raw) {
    return {
      wordCount: 0,
      charCount: 0,
      syllableCount: 0,
      wpm: safeWpm,
      spokenDurationSec: 2.0,
      punctuationPauseSec: 0,
      totalDurationSec: 2.5,
      effectiveWpm: safeWpm,
      elevenLabsBreakScript: '',
      wordTimings: [],
    };
  }

  const rawWords = raw.split(/\s+/).filter(Boolean);
  const wordCount = rawWords.length;
  const charCount = raw.length;

  // Base seconds per average word (2.3 syllables in PT-BR) at chosen WPM
  const baseSecPerWord = 60 / safeWpm;

  let totalSyllables = 0;
  let totalSpokenSec = 0;
  let totalPauseSec = 0;

  const rawEntries: {
    word: string;
    spokenSec: number;
    pauseSec: number;
  }[] = [];

  const breakScriptParts: string[] = [];

  for (let i = 0; i < rawWords.length; i++) {
    const token = rawWords[i];
    const syllables = countPortugueseSyllables(token);
    totalSyllables += syllables;

    // Weight word duration by syllable density relative to 2.2 avg syllables/word
    const syllableFactor = 0.55 + 0.45 * (syllables / 2.2);
    const wordSpokenSec = baseSecPerWord * syllableFactor;

    // Detect trailing punctuation for ElevenLabs breath/intonation pauses
    let pauseAfter = 0;
    if (/[.!?]+$/.test(token)) {
      pauseAfter = i < rawWords.length - 1 ? 0.44 : 0.25; // sentence boundary breath
    } else if (/[:;—–]+$/.test(token)) {
      pauseAfter = 0.32;
    } else if (/[,]+$/.test(token)) {
      pauseAfter = 0.22; // comma micro-pause
    }

    //Scale pauses slightly when WPM is faster/slower
    const pauseScale = 155 / safeWpm;
    pauseAfter = Math.round(pauseAfter * pauseScale * 100) / 100;

    totalSpokenSec += wordSpokenSec;
    totalPauseSec += pauseAfter;

    rawEntries.push({
      word: token,
      spokenSec: wordSpokenSec,
      pauseSec: pauseAfter,
    });

    if (pauseAfter >= 0.18 && i < rawWords.length - 1) {
      breakScriptParts.push(`${token} <break time="${pauseAfter.toFixed(1)}s" />`);
    } else {
      breakScriptParts.push(token);
    }
  }

  // Add subtle ElevenLabs lead-in / trail-out buffer (0.25s)
  const rawTotal = totalSpokenSec + totalPauseSec + 0.25;
  const totalDurationSec = Math.max(1.8, Math.round(rawTotal * 10) / 10);

  // Build normalized wordTimings
  const scaleFactor = totalDurationSec / Math.max(0.1, totalSpokenSec + totalPauseSec);
  let cursorSec = 0;
  const wordTimings: WordTimingEntry[] = rawEntries.map((entry, index) => {
    const dur = (entry.spokenSec + entry.pauseSec) * scaleFactor;
    const startSec = Math.round(cursorSec * 100) / 100;
    const endSec = Math.round((cursorSec + dur) * 100) / 100;
    const startProgress = Math.max(0, Math.min(1, cursorSec / totalDurationSec));
    cursorSec += dur;
    const endProgress = Math.max(0, Math.min(1, cursorSec / totalDurationSec));

    return {
      word: entry.word,
      index,
      startSec,
      endSec,
      pauseAfterSec: entry.pauseSec,
      startProgress,
      endProgress,
    };
  });

  const effectiveWpm = Math.round((wordCount / totalDurationSec) * 60);

  return {
    wordCount,
    charCount,
    syllableCount: totalSyllables,
    wpm: safeWpm,
    spokenDurationSec: Math.round(totalSpokenSec * 10) / 10,
    punctuationPauseSec: Math.round(totalPauseSec * 10) / 10,
    totalDurationSec,
    effectiveWpm,
    elevenLabsBreakScript: breakScriptParts.join(' '),
    wordTimings,
  };
}

/**
 * Estimates natural speech duration in seconds for Brazilian Portuguese text,
 * calibrated for ElevenLabs WPM (default 155 WPM).
 */
export function estimateSpeechDuration(
  narration: string,
  speedMultiplier = 1.0,
  wpm = 155
): number {
  if (!narration || narration.trim() === '') return 3.0;
  const targetWpm = Math.round(wpm * speedMultiplier);
  const timing = calculateElevenLabsTiming(narration, targetWpm);
  return timing.totalDurationSec;
}

/**
 * Finds the exact word index being spoken at `progress` [0..1]
 * taking into account syllable lengths and punctuation pauses.
 */
export function getActiveWordIndexAtProgress(
  narration: string,
  progress: number,
  wpm = 155
): number {
  const timing = calculateElevenLabsTiming(narration, wpm);
  if (timing.wordTimings.length === 0) return 0;
  const clamped = Math.max(0, Math.min(1, progress));
  for (let i = 0; i < timing.wordTimings.length; i++) {
    if (clamped <= timing.wordTimings[i].endProgress) {
      return i;
    }
  }
  return timing.wordTimings.length - 1;
}

/**
 * Smoothly interpolates between two LimbAngles states for fluid beat-to-beat transitions.
 */
export function blendLimbAngles(a: LimbAngles, b: LimbAngles, t: number): LimbAngles {
  const clamped = Math.max(0, Math.min(1, t));
  // Smoothstep interpolation
  const s = clamped * clamped * (3 - 2 * clamped);
  const lerp = (v1 = 0, v2 = 0) => v1 + (v2 - v1) * s;

  return {
    leftArmUpper: lerp(a.leftArmUpper, b.leftArmUpper),
    leftArmLower: lerp(a.leftArmLower, b.leftArmLower),
    rightArmUpper: lerp(a.rightArmUpper, b.rightArmUpper),
    rightArmLower: lerp(a.rightArmLower, b.rightArmLower),
    leftLegUpper: lerp(a.leftLegUpper, b.leftLegUpper),
    leftLegLower: lerp(a.leftLegLower, b.leftLegLower),
    rightLegUpper: lerp(a.rightLegUpper, b.rightLegUpper),
    rightLegLower: lerp(a.rightLegLower, b.rightLegLower),
    bodyLean: lerp(a.bodyLean, b.bodyLean),
    headBob: lerp(a.headBob, b.headBob),
    verticalOffset: lerp(a.verticalOffset, b.verticalOffset),
    spineCurve: lerp(a.spineCurve, b.spineCurve),
    leftWristFlex: lerp(a.leftWristFlex, b.leftWristFlex),
    rightWristFlex: lerp(a.rightWristFlex, b.rightWristFlex),
    leftAnkleFlex: lerp(a.leftAnkleFlex, b.leftAnkleFlex),
    rightAnkleFlex: lerp(a.rightAnkleFlex, b.rightAnkleFlex),
    shoulderShrug: lerp(a.shoulderShrug, b.shoulderShrug),
    headTilt: lerp(a.headTilt, b.headTilt),
  };
}

export interface ProsodicSpeechEnvelope {
  syllablePulse: number;    // [0 .. 1] rhythmic pulse of the current word's syllables
  emphasisBoost: number;    // [0 .. 1] boost on exclamations, questions, or long words
  isBreathPause: boolean;   // true during comma/period breath pauses
  wordProgress: number;     // [0 .. 1] progress within the active word
  activeWord: string;
}

/**
 * Extracts a real-time prosodic speech envelope from the narration text and progress [0..1]
 * so head nods, brow lifts, jaw opening, and hand beat-gestures synchronize with actual syllables
 * and pause during punctuation breaths instead of oscillating like a mechanical sine wave.
 */
export function getProsodicSpeechEnvelope(
  narration: string,
  progress: number,
  wpm: number = 155
): ProsodicSpeechEnvelope {
  const timing = calculateElevenLabsTiming(narration, wpm);
  if (timing.wordTimings.length === 0) {
    return {
      syllablePulse: 0,
      emphasisBoost: 0,
      isBreathPause: true,
      wordProgress: 0,
      activeWord: '',
    };
  }

  const clamped = Math.max(0, Math.min(1, progress));
  const idx = getActiveWordIndexAtProgress(narration, clamped, wpm);
  const entry = timing.wordTimings[idx] || timing.wordTimings[0];
  const span = Math.max(0.001, entry.endProgress - entry.startProgress);
  const localProg = Math.max(0, Math.min(1, (clamped - entry.startProgress) / span));

  const totalDur = Math.max(0.05, entry.endSec - entry.startSec);
  const spokenRatio = Math.max(0.25, (totalDur - entry.pauseAfterSec) / totalDur);
  const isBreathPause = localProg > spokenRatio;

  const syllables = countPortugueseSyllables(entry.word);
  const spokenProg = isBreathPause ? 1 : localProg / spokenRatio;
  const syllablePulse = isBreathPause
    ? 0
    : Math.pow(Math.abs(Math.sin(spokenProg * Math.PI * syllables)), 0.85);

  const hasStrongPunct = /[!?]/.test(entry.word);
  const emphasisBoost = Math.min(
    1,
    (hasStrongPunct ? 0.55 : 0) + (syllables >= 3 ? 0.3 : 0.1)
  );

  return {
    syllablePulse,
    emphasisBoost,
    isBreathPause,
    wordProgress: localProg,
    activeWord: entry.word,
  };
}

/**
 * Flash & Hogan (1985) Minimum-Jerk human motor trajectory: 10t^3 - 15t^4 + 6t^5.
 * Guarantees C2 continuity (zero velocity and zero acceleration jerk at movement boundaries).
 */
export function minimumJerkEase(t: number): number {
  const u = Math.max(0, Math.min(1, t));
  return u * u * u * (u * (u * 6 - 15) + 10);
}

/**
 * Deterministic 1D band-limited Perlin gradient noise in [-1, 1] with quintic C2 fade.
 * Eliminates robotic periodicity by introducing smooth, non-repeating human postural micro-sway.
 */
export function organicPerlin1D(x: number, seed: number = 1): number {
  const xi = Math.floor(x);
  const xf = x - xi;
  const u = minimumJerkEase(xf);

  const grad = (n: number): number => {
    let h = ((n * 374761393) ^ ((seed || 1) * 668265263)) >>> 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
    return (((h ^ (h >>> 16)) >>> 0) / 2147483648) - 1;
  };

  const g0 = grad(xi) * xf;
  const g1 = grad(xi + 1) * (xf - 1);
  return Math.max(-1, Math.min(1, (g0 + u * (g1 - g0)) * 1.85));
}

export interface MotionVariationContext {
  seed?: number;
  intensity?: number;     // [0.15 .. 1.0], default 0.7
  anticipation?: number;  // [0.0 .. 1.0], default 0.4
  reaction?: number;      // [0.0 .. 1.0], default 0.5
  settle?: number;        // [0.0 .. 1.0], default 0.5
  weightShift?: number;   // [-1.0 .. 1.0], default 0
}

/**
 * Calculates loose, organic, multi-harmonic limb angles and independent joint physics
 * for procedural stickman animation.
 * Uses proximal-to-distal kinematic wave propagation (pelvis -> spine -> shoulder -> elbow -> wrist),
 * band-limited 1D Perlin noise (`organicPerlin1D`), and optional deterministic `motionContext`
 * so two scenes with the same action but different seeds/contexts produce distinct human-like modulation
 * while remaining 100% deterministic for any (timestamp, seed) pair.
 */
export function calculateLimbAngles(
  action: StickmanAction,
  progress: number,
  isSpeaking: boolean = false,
  elapsedSec?: number,
  beatProgress: number = 0.5,
  maneuver: DynamicManeuver = 'none',
  beatIndex: number = 0,
  motionContext?: MotionVariationContext
): LimbAngles {
  const ctxIntensity =
    motionContext?.intensity !== undefined
      ? Math.max(0.15, Math.min(1.0, motionContext.intensity))
      : 0.7;
  const ctxAnticipation =
    motionContext?.anticipation !== undefined
      ? Math.max(0.0, Math.min(1.0, motionContext.anticipation))
      : 0.4;
  const ctxReaction =
    motionContext?.reaction !== undefined
      ? Math.max(0.0, Math.min(1.0, motionContext.reaction))
      : 0.5;
  const ctxSettle =
    motionContext?.settle !== undefined
      ? Math.max(0.0, Math.min(1.0, motionContext.settle))
      : 0.5;
  const ctxWeightShift =
    motionContext?.weightShift !== undefined
      ? Math.max(-1.0, Math.min(1.0, motionContext.weightShift))
      : 0;

  // Deterministic phase & tempo offset from seed (0 when no seed provided for backward compatibility)
  const rawSeed = motionContext?.seed ? Math.abs(Math.trunc(motionContext.seed)) : 0;
  const seedPhaseOffset = rawSeed > 0 ? ((rawSeed % 997) / 997) * Math.PI * 2 : 0;
  const seedAsymmetry = rawSeed > 0 ? (((rawSeed % 389) / 389) - 0.5) * 0.28 : 0;
  const tempoScale =
    motionContext !== undefined
      ? 0.78 + ctxIntensity * 0.28 + (rawSeed > 0 ? (((rawSeed % 251) / 251) - 0.5) * 0.08 : 0)
      : 0.88;

  // Controlled, weighted real-time phase (~2.7 rad/sec) modulated by contextual tempoScale
  const sec = elapsedSec !== undefined ? elapsedSec : progress * 4.8;
  const t = sec * Math.PI * tempoScale;

  // Proximal-to-Distal Kinematic Wave Propagation lags (Successive Breaking of Joints)
  const tSpine = (sec - 0.065) * Math.PI * tempoScale;
  const tShoulder = (sec - 0.11) * Math.PI * tempoScale;
  const tElbow = (sec - 0.175) * Math.PI * tempoScale;
  const tWrist = (sec - 0.235) * Math.PI * tempoScale;

  // Non-repeating irrational harmonics + 1D Perlin organic micro-sway
  const PHI = 1.6180339;
  const SQRT2 = 1.4142135;
  const SQRT3 = 1.7320508;

  // Gentle phase offset per beat + deterministic seedPhaseOffset
  const beatSeed = beatIndex * 1.15 + seedPhaseOffset;
  const ampScale = motionContext !== undefined ? 0.68 + ctxIntensity * 0.48 : 1.0;

  // Non-periodic Perlin postural drift so the character never freezes or repeats like a robot
  const perlinSway = organicPerlin1D(sec * 0.85 + beatIndex * 0.37, rawSeed || 101) * 0.12 * ampScale;
  const perlinArmL = organicPerlin1D(sec * 1.15 + 3.1, (rawSeed || 101) + 17) * 0.18 * ampScale;
  const perlinArmR = organicPerlin1D(sec * 1.12 + 7.4, (rawSeed || 101) + 43) * 0.18 * ampScale;

  const oscL =
    (Math.sin(tShoulder + beatSeed) * 0.38 +
      Math.sin(tShoulder * PHI * 0.65 + 1.1 + seedAsymmetry) * 0.2 +
      perlinArmL) *
    ampScale;
  const oscR =
    (Math.sin(tShoulder * SQRT2 * 0.65 + 2.3 + beatSeed) * 0.38 +
      Math.cos(tShoulder * 0.55 - seedAsymmetry) * 0.2 +
      perlinArmR) *
    ampScale;
  const wristWhipL =
    (Math.sin(tWrist * SQRT3 * 0.6 - 0.6 + seedPhaseOffset * 0.5) * 0.2 +
      Math.sin(tElbow - tWrist) * 0.08) *
    ampScale;
  const wristWhipR =
    (Math.cos(tWrist * PHI * 0.6 - 0.8 - seedPhaseOffset * 0.5) * 0.2 +
      Math.cos(tElbow - tWrist) * 0.08) *
    ampScale;
  const breathe = Math.sin(tSpine * 0.45 + seedPhaseOffset * 0.25) * 0.035 + perlinSway * 0.25;

  // Controlled beat impulse curve with minimum-jerk anticipation -> action/reaction -> settle envelope
  const clampedBeatProg = Math.max(0, Math.min(1, beatProgress));
  const settleEnvelope =
    clampedBeatProg > 0.72
      ? 1 - minimumJerkEase((clampedBeatProg - 0.72) / 0.28) * (0.38 * ctxSettle)
      : 1.0;
  const impulse =
    Math.sin(clampedBeatProg * Math.PI) * (0.45 + 0.35 * ctxReaction) * settleEnvelope;
  const anticipation =
    clampedBeatProg < 0.24
      ? -Math.sin((clampedBeatProg / 0.24) * Math.PI) * (0.1 + 0.18 * ctxAnticipation)
      : 0;

  const speechBob = isSpeaking
    ? Math.sin(t * 1.8) * 0.065 + Math.cos(t * 2.7) * 0.035 + perlinSway * 0.22
    : Math.sin(t * 0.5) * 0.02 + perlinSway * 0.15;

  let base: LimbAngles;

  switch (action) {
    case 'zombie_survive_barricade': {
      // Tactical survivor bracing barricade, hammering boards, and scanning horizon
      const braceCycle = Math.sin(t * 1.15 + beatSeed);
      const hammerSwing = braceCycle > 0.2 ? braceCycle * 0.65 : -0.25;
      base = {
        leftArmUpper: -0.75 + braceCycle * 0.25, // holding plank / shield forward
        leftArmLower: 0.55 - braceCycle * 0.15,
        rightArmUpper: -0.95 + hammerSwing, // controlled tool/weapon swing
        rightArmLower: -0.65 + Math.cos(t * 1.15) * 0.35,
        leftLegUpper: 0.38,
        leftLegLower: 0.18,
        rightLegUpper: -0.42,
        rightLegLower: 0.28,
        bodyLean: 0.18 + braceCycle * 0.08,
        headBob: speechBob + Math.abs(braceCycle) * 0.05,
        verticalOffset: Math.abs(braceCycle) * 4,
        spineCurve: 0.12 + braceCycle * 0.06,
        leftWristFlex: 0.15,
        rightWristFlex: hammerSwing * 0.4,
        headTilt: Math.sin(t * 0.6) * 0.1,
      };
      break;
    }

    case 'trillion_buy_everything': {
      // Confident billionaire/trillionaire pointing at incoming assets, signing contracts, tossing cash calmly
      const pointSweep = Math.sin(t * 0.85 + beatSeed);
      const checkWatchOrPhone = beatIndex % 2 === 1;
      base = {
        leftArmUpper: checkWatchOrPhone ? -0.55 : -0.85 + oscL * 0.35,
        leftArmLower: checkWatchOrPhone ? 1.15 : -0.45 + wristWhipL,
        rightArmUpper: -1.15 + pointSweep * 0.45, // pointing at mega-purchases
        rightArmLower: -0.35 + Math.cos(t * 0.85) * 0.25,
        leftLegUpper: 0.18 + Math.sin(t * 0.55) * 0.1,
        leftLegLower: 0.05,
        rightLegUpper: -0.18 - Math.sin(t * 0.55) * 0.1,
        rightLegLower: 0.08,
        bodyLean: -0.06 + pointSweep * 0.06,
        headBob: speechBob,
        verticalOffset: Math.abs(Math.sin(t * 0.55)) * 3,
        spineCurve: -0.05 + breathe,
        leftWristFlex: wristWhipL,
        rightWristFlex: pointSweep * 0.3,
        headTilt: pointSweep * 0.12,
      };
      break;
    }

    case 'scavenge_supplies': {
      // Controlled crouched exploration, picking up supply crates and inspecting terrain
      const crouchWave = 0.5 + 0.5 * Math.sin(t * 0.9 + beatSeed);
      const stepSlow = Math.cos(t * 0.9);
      base = {
        leftArmUpper: 0.35 + crouchWave * 0.35,
        leftArmLower: 0.55 - crouchWave * 0.2,
        rightArmUpper: 0.45 + crouchWave * 0.45, // reaching down to supply crate
        rightArmLower: 0.4 + crouchWave * 0.25,
        leftLegUpper: 0.55 + crouchWave * 0.35 + stepSlow * 0.2,
        leftLegLower: -0.5 - crouchWave * 0.35,
        rightLegUpper: -0.25 + crouchWave * 0.25 - stepSlow * 0.2,
        rightLegLower: 0.45 + crouchWave * 0.25,
        bodyLean: 0.28 + crouchWave * 0.18,
        headBob: speechBob + crouchWave * 0.1,
        verticalOffset: 8 + crouchWave * 10,
        spineCurve: 0.18 + crouchWave * 0.1,
        leftWristFlex: 0.2,
        rightWristFlex: -0.25,
      };
      break;
    }

    case 'command_crowd': {
      // Deliberate tactical commander directing people and objectives across the scenario
      const directSweep = Math.sin(t * 0.75 + beatSeed);
      base = {
        leftArmUpper: -0.35 + oscL * 0.25,
        leftArmLower: 0.85,
        rightArmUpper: -1.35 + directSweep * 0.35, // raised arm signaling objective direction
        rightArmLower: -0.25 + directSweep * 0.2,
        leftLegUpper: 0.22,
        leftLegLower: 0.05,
        rightLegUpper: -0.26,
        rightLegLower: 0.1,
        bodyLean: 0.08 + directSweep * 0.06,
        headBob: speechBob,
        verticalOffset: Math.sin(t * 0.75) * 2,
        spineCurve: 0.06 + breathe,
        rightWristFlex: directSweep * 0.25,
        headTilt: directSweep * 0.1,
      };
      break;
    }

    case 'drive_car':
    case 'car_police': {
      const engineVibe = Math.sin(t * 5) * 1.1 + Math.cos(t * 8) * 0.4;
      const steerWave = Math.sin(t * 0.9 + beatSeed) * 0.18 + Math.sin(t * 0.4 * PHI) * 0.08;
      const shiftingGear =
        maneuver === 'car_accelerate_surge' && beatProgress > 0.25 && beatProgress < 0.65;
      base = {
        leftArmUpper: 0.72 + steerWave,
        leftArmLower: 0.48 - steerWave * 0.5,
        rightArmUpper: shiftingGear ? 0.25 : 0.62 - steerWave,
        rightArmLower: shiftingGear ? 0.95 : 0.42 + steerWave * 0.4,
        leftLegUpper: 1.3,
        leftLegLower: -1.15,
        rightLegUpper: 1.22 + Math.sin(t * 1.4) * 0.06,
        rightLegLower: -1.08,
        bodyLean: 0.16 + steerWave * 0.3 + (shiftingGear ? 0.1 : 0),
        headBob: speechBob + Math.sin(t * 2.2) * 0.04,
        verticalOffset: 20 + engineVibe,
        spineCurve: 0.08 + steerWave * 0.12,
        leftWristFlex: steerWave * 0.4,
        rightWristFlex: shiftingGear ? -0.35 : -steerWave * 0.4,
        headTilt: steerWave * 0.2,
      };
      break;
    }

    case 'motorcycle': {
      const engineVibe = Math.sin(t * 7) * 1.4;
      const lean = Math.sin(t * 1.1) * 0.14;
      base = {
        leftArmUpper: 1.08 + lean * 0.35,
        leftArmLower: 0.32,
        rightArmUpper: 1.02 - lean * 0.25,
        rightArmLower: 0.35,
        leftLegUpper: 1.42,
        leftLegLower: -1.32,
        rightLegUpper: 1.38,
        rightLegLower: -1.28,
        bodyLean: 0.52 + lean,
        headBob: speechBob + 0.08,
        verticalOffset: 22 + engineVibe,
        spineCurve: 0.22,
        leftWristFlex: 0.18,
        rightWristFlex: 0.2,
      };
      break;
    }

    case 'gun_aim': {
      const recoil = Math.sin(t * 2.2) > 0.78 ? 0.26 : 0;
      const aimSweep = Math.sin(t * 0.6 + beatSeed) * 0.14;
      base = {
        leftArmUpper: -1.15 - recoil + aimSweep,
        leftArmLower: 0.75 + recoil * 0.3,
        rightArmUpper: -1.38 - recoil + aimSweep,
        rightArmLower: 0.42 + recoil * 0.25,
        leftLegUpper: 0.32 + anticipation * 0.2,
        leftLegLower: 0.15,
        rightLegUpper: -0.42,
        rightLegLower: 0.25,
        bodyLean: -0.12 - recoil * 0.35,
        headBob: speechBob,
        verticalOffset: recoil * 3,
        spineCurve: -0.06 - recoil * 0.15,
        leftWristFlex: -recoil * 0.4,
        rightWristFlex: -recoil * 0.45,
      };
      break;
    }

    case 'running': {
      // Controlled, athletic run stride (not frantic flailing)
      const strideFreq = t * 1.35;
      const legL = Math.sin(strideFreq);
      const legR = Math.sin(strideFreq + Math.PI + Math.sin(t * 0.5) * 0.1);
      const armL = -legL * 0.85 + Math.cos(strideFreq * 2) * 0.1;
      const armR = -legR * 0.85 - Math.sin(strideFreq * 2) * 0.1;
      base = {
        leftArmUpper: armL,
        leftArmLower: 0.75 + Math.max(0, armL * 0.3),
        rightArmUpper: armR,
        rightArmLower: 0.75 + Math.max(0, armR * 0.3),
        leftLegUpper: legL * 0.92,
        leftLegLower: Math.max(0.08, -legL * 0.85 + 0.28),
        rightLegUpper: legR * 0.92,
        rightLegLower: Math.max(0.08, -legR * 0.85 + 0.28),
        bodyLean: 0.26 + Math.sin(strideFreq * 2) * 0.05 + impulse * 0.05,
        headBob: speechBob + Math.sin(strideFreq * 2) * 0.07,
        verticalOffset: Math.abs(Math.sin(strideFreq)) * 7 - 2,
        spineCurve: 0.12 + Math.sin(strideFreq * 2) * 0.04,
        leftWristFlex: wristWhipL,
        rightWristFlex: wristWhipR,
        leftAnkleFlex: legL * 0.3,
        rightAnkleFlex: legR * 0.3,
      };
      break;
    }

    case 'reading_book': {
      const pageTurn = Math.sin(t * 0.8 + beatSeed) > 0.78 ? -0.35 : 0;
      base = {
        leftArmUpper: 0.42 + oscL * 0.06,
        leftArmLower: 1.18,
        rightArmUpper: 0.36 + pageTurn * 0.4,
        rightArmLower: 1.22 + pageTurn,
        leftLegUpper: 0.12 + Math.sin(t * 0.45) * 0.06,
        leftLegLower: Math.max(0, Math.sin(t * 0.45) * 0.08),
        rightLegUpper: -0.12 - Math.sin(t * 0.45) * 0.06,
        rightLegLower: 0.05,
        bodyLean: 0.1 + breathe,
        headBob: speechBob + 0.15 + Math.sin(t * 0.9) * 0.04,
        verticalOffset: Math.abs(Math.sin(t * 0.45)) * 1.5,
        spineCurve: 0.12,
        leftWristFlex: 0.15,
        rightWristFlex: 0.15 + pageTurn * 0.4,
      };
      break;
    }

    case 'coffee_sip': {
      const sip = Math.pow(Math.max(0, Math.sin(t * 0.65 + beatSeed)), 1.5);
      base = {
        leftArmUpper: 0.22 + oscL * 0.28,
        leftArmLower: 0.42 + Math.cos(t * PHI * 0.6) * 0.3,
        rightArmUpper: -0.45 - sip * 0.68,
        rightArmLower: 1.15 + sip * 0.75,
        leftLegUpper: 0.14,
        leftLegLower: 0.04,
        rightLegUpper: -0.16,
        rightLegLower: 0.1,
        bodyLean: 0.04 - sip * 0.06,
        headBob: speechBob - sip * 0.12,
        verticalOffset: Math.sin(t * 0.8) * 1.2,
        spineCurve: -sip * 0.06 + breathe,
        leftWristFlex: wristWhipL,
        rightWristFlex: sip * 0.28,
      };
      break;
    }

    case 'car_chase': {
      const engineVibe = Math.sin(t * 8) * 1.6;
      const hardSteer = Math.sin(t * 1.4 + beatSeed) * 0.26 + Math.cos(t * PHI) * 0.1;
      const lookBack = beatIndex % 3 === 1 && beatProgress > 0.3 && beatProgress < 0.75;
      base = {
        leftArmUpper: 0.82 + hardSteer,
        leftArmLower: 0.42 - hardSteer * 0.25,
        rightArmUpper: lookBack ? -0.35 : 0.72 - hardSteer,
        rightArmLower: lookBack ? 0.55 : 0.4 + hardSteer * 0.25,
        leftLegUpper: 1.35,
        leftLegLower: -1.2,
        rightLegUpper: 1.25,
        rightLegLower: -1.1,
        bodyLean: 0.24 + hardSteer * 0.35,
        headBob: speechBob + Math.sin(t * 3) * 0.06,
        verticalOffset: 20 + engineVibe,
        spineCurve: 0.12 + hardSteer * 0.15,
        headTilt: lookBack ? -0.28 : hardSteer * 0.2,
      };
      break;
    }

    case 'car_drift': {
      const driftAngle = Math.sin(t * 1.3 + beatSeed) * 0.35;
      const pullHandbrake = beatProgress < 0.45;
      base = {
        leftArmUpper: 0.52 - driftAngle,
        leftArmLower: 0.62 + driftAngle * 0.25,
        rightArmUpper: pullHandbrake ? -0.15 : 0.92 + driftAngle,
        rightArmLower: pullHandbrake ? 1.05 : 0.32,
        leftLegUpper: 1.3,
        leftLegLower: -1.2,
        rightLegUpper: 1.2,
        rightLegLower: -1.1,
        bodyLean: -driftAngle * 0.45 + (pullHandbrake ? 0.14 : 0),
        headBob: speechBob + 0.08,
        verticalOffset: 19 + Math.sin(t * 6) * 1.2,
        spineCurve: -driftAngle * 0.2,
        rightWristFlex: pullHandbrake ? -0.4 : 0.15,
      };
      break;
    }

    case 'walk_city':
    case 'walking': {
      // Controlled, natural walking cadence
      const walkFreq = action === 'walk_city' ? t * 0.92 : t * 1.02;
      const stepL = Math.sin(walkFreq);
      const stepR = -stepL;
      const gesturingWhileWalking = isSpeaking || beatIndex % 2 === 1;
      const rightArmGesture = gesturingWhileWalking
        ? -0.45 + Math.sin(t * PHI * 0.65) * 0.38 + impulse * 0.2
        : stepR * 0.52;
      const rightForearmGesture = gesturingWhileWalking
        ? -0.52 + Math.cos(t * SQRT2 * 0.65) * 0.35
        : 0.24 + Math.max(0, stepR * 0.25);

      base = {
        leftArmUpper: stepL * 0.52 + oscL * 0.08,
        leftArmLower: 0.24 + Math.max(0, stepL * 0.28) + wristWhipL * 0.2,
        rightArmUpper: rightArmGesture,
        rightArmLower: rightForearmGesture,
        leftLegUpper: stepL * 0.56,
        leftLegLower: Math.max(0.04, -stepL * 0.52 + 0.15),
        rightLegUpper: stepR * 0.56,
        rightLegLower: Math.max(0.04, -stepR * 0.52 + 0.15),
        bodyLean: 0.06 + Math.sin(walkFreq * 2) * 0.03,
        headBob: speechBob + Math.sin(walkFreq * 2) * 0.05,
        verticalOffset: Math.abs(Math.sin(walkFreq)) * 3.8,
        spineCurve: 0.05 + Math.sin(walkFreq) * 0.035,
        leftWristFlex: wristWhipL * 0.35,
        rightWristFlex: wristWhipR * 0.5,
        leftAnkleFlex: stepL * 0.22,
        rightAnkleFlex: stepR * 0.22,
      };
      break;
    }

    case 'hero_rooftop': {
      const windSway = Math.sin(t * 0.6) * 0.09 + Math.cos(t * 0.4 * PHI) * 0.06;
      const raiseFist = beatProgress > 0.35 && beatProgress < 0.85;
      base = {
        leftArmUpper: -0.26 + windSway,
        leftArmLower: 0.22 + Math.sin(t * 0.9) * 0.1,
        rightArmUpper: raiseFist ? -1.35 + oscR * 0.15 : -0.28 - windSway,
        rightArmLower: raiseFist ? -0.55 : 0.18,
        leftLegUpper: 0.22,
        leftLegLower: 0.05,
        rightLegUpper: -0.25,
        rightLegLower: 0.1,
        bodyLean: -0.05 + windSway * 0.4,
        headBob: speechBob + Math.sin(t * 0.45) * 0.04,
        verticalOffset: Math.sin(t * 0.65) * 1.5,
        spineCurve: windSway * 0.45,
        leftWristFlex: wristWhipL * 0.3,
        rightWristFlex: raiseFist ? 0.25 : wristWhipR * 0.3,
      };
      break;
    }

    case 'presentation_stage': {
      const poseVariant = beatIndex % 3;
      const leftUp =
        poseVariant === 0
          ? -1.1 + oscL * 0.32
          : poseVariant === 1
          ? -0.4 + oscL * 0.25
          : -1.35 - impulse * 0.22;
      const rightUp =
        poseVariant === 0
          ? 0.48 + oscR * 0.35
          : poseVariant === 1
          ? -1.2 + oscR * 0.32
          : 1.1 + impulse * 0.25;

      const weightShift = Math.sin(t * 0.55 + beatSeed) * 0.14;
      base = {
        leftArmUpper: leftUp,
        leftArmLower: -0.48 + Math.cos(t * PHI * 0.6) * 0.32,
        rightArmUpper: rightUp,
        rightArmLower: -0.4 + Math.sin(t * SQRT2 * 0.6) * 0.38,
        leftLegUpper: 0.12 + weightShift,
        leftLegLower: Math.max(0, -weightShift * 0.4),
        rightLegUpper: -0.12 + weightShift * 0.5,
        rightLegLower: Math.max(0, weightShift * 0.4),
        bodyLean: weightShift * 0.32 + impulse * 0.04,
        headBob: speechBob + Math.sin(t * 1.1) * 0.04,
        verticalOffset: Math.sin(t * 1.0) * 1.8,
        spineCurve: weightShift * 0.38 + breathe,
        leftWristFlex: wristWhipL * 0.6,
        rightWristFlex: wristWhipR * 0.6,
        headTilt: Math.sin(t * 0.65) * 0.1,
      };
      break;
    }

    case 'talk_explaining': {
      // Controlled, natural conversational gestures
      const mode = beatIndex % 4;
      const weightShift = Math.sin(t * 0.55 + beatSeed) * 0.15;
      const stepSubtle = Math.cos(t * 0.75 + beatSeed) * 0.12;

      let lUpper = -0.55 + oscL * 0.45;
      let lLower = -0.65 + Math.cos(t * PHI * 0.6) * 0.38;
      let rUpper = 0.48 + oscR * 0.48;
      let rLower = -0.52 + Math.sin(t * SQRT3 * 0.6) * 0.42;

      if (mode === 1) {
        lUpper = -0.98 - impulse * 0.25 + oscL * 0.22;
        lLower = -0.35 + wristWhipL;
        rUpper = 0.98 + impulse * 0.25 + oscR * 0.22;
        rLower = 0.35 + wristWhipR;
      } else if (mode === 2) {
        lUpper = -0.42;
        lLower = 1.05;
        rUpper = 0.82 + oscR * 0.42 + impulse * 0.22;
        rLower = -0.72 + Math.cos(t * 1.3) * 0.32;
      } else if (mode === 3) {
        lUpper = -0.82 + oscL * 0.35;
        lLower = -0.55 + wristWhipL;
        rUpper = 0.3 + oscR * 0.3;
        rLower = -0.82 + wristWhipR;
      }

      base = {
        leftArmUpper: lUpper,
        leftArmLower: lLower,
        rightArmUpper: rUpper,
        rightArmLower: rLower,
        leftLegUpper: 0.1 + weightShift + stepSubtle * 0.3,
        leftLegLower: Math.max(0, -stepSubtle * 0.25),
        rightLegUpper: -0.12 + weightShift * 0.4 - stepSubtle * 0.3,
        rightLegLower: Math.max(0, stepSubtle * 0.25),
        bodyLean: weightShift * 0.32 + Math.sin(t * 0.45) * 0.04,
        headBob: speechBob,
        verticalOffset: Math.abs(weightShift) * 5 + Math.sin(t * 1.1) * 1.5,
        spineCurve: weightShift * 0.38 + breathe,
        leftWristFlex: wristWhipL * 0.65,
        rightWristFlex: wristWhipR * 0.65,
        shoulderShrug: impulse * 2.5,
        headTilt: Math.sin(t * 0.55 + beatSeed) * 0.11,
      };
      break;
    }

    case 'fight_kungfu': {
      const comboStep = Math.floor((beatProgress * 2.5 + beatIndex) % 4);
      const fastPhase = Math.sin(t * 1.65);
      const kickWave = Math.cos(t * 1.35 + beatSeed);

      if (comboStep === 0) {
        base = {
          leftArmUpper: fastPhase > 0 ? 1.25 : 0.35,
          leftArmLower: fastPhase > 0 ? -0.15 : -1.15,
          rightArmUpper: fastPhase <= 0 ? 1.32 : 0.25,
          rightArmLower: fastPhase <= 0 ? -0.1 : -1.2,
          leftLegUpper: 0.42,
          leftLegLower: 0.32,
          rightLegUpper: -0.48,
          rightLegLower: 0.4,
          bodyLean: 0.22 + fastPhase * 0.1,
          headBob: Math.abs(fastPhase) * 0.08,
          verticalOffset: Math.abs(fastPhase) * 4.5,
          spineCurve: 0.14,
          leftWristFlex: fastPhase * 0.3,
          rightWristFlex: -fastPhase * 0.3,
        };
      } else if (comboStep === 1) {
        const kickExtend = Math.max(0, kickWave);
        base = {
          leftArmUpper: -0.78,
          leftArmLower: -0.68,
          rightArmUpper: 0.68,
          rightArmLower: -0.82,
          leftLegUpper: -0.32,
          leftLegLower: 0.22,
          rightLegUpper: 1.32 + kickExtend * 0.35,
          rightLegLower: -0.12 * (1 - kickExtend),
          bodyLean: -0.32 - kickExtend * 0.15,
          headBob: 0.08,
          verticalOffset: -14 - kickExtend * 10,
          spineCurve: -0.18,
          rightAnkleFlex: -0.35,
        };
      } else if (comboStep === 2) {
        base = {
          leftArmUpper: -0.58,
          leftArmLower: 0.78,
          rightArmUpper: 1.58 + impulse * 0.25,
          rightArmLower: -0.4,
          leftLegUpper: 0.58,
          leftLegLower: -0.48,
          rightLegUpper: -0.58,
          rightLegLower: 0.48,
          bodyLean: 0.12 - impulse * 0.18,
          headBob: -0.12,
          verticalOffset: -impulse * 16,
          spineCurve: -0.12,
          rightWristFlex: 0.4,
        };
      } else {
        base = {
          leftArmUpper: 0.58 + oscL * 0.22,
          leftArmLower: -1.0,
          rightArmUpper: 0.85 + oscR * 0.22,
          rightArmLower: -0.78,
          leftLegUpper: 0.78,
          leftLegLower: -0.85,
          rightLegUpper: 1.05,
          rightLegLower: -0.1,
          bodyLean: 0.28,
          headBob: 0.12,
          verticalOffset: 12,
          spineCurve: 0.16,
        };
      }
      break;
    }

    case 'sword_duel': {
      const slashCycle = Math.sin(t * 1.4 + beatSeed);
      const lunge = Math.cos(t * 0.95 * PHI);
      base = {
        leftArmUpper: 0.5 + slashCycle * 0.58,
        leftArmLower: -0.48 + lunge * 0.28,
        rightArmUpper: 0.68 + slashCycle * 0.88,
        rightArmLower: -0.32 + Math.cos(t * 1.4) * 0.42,
        leftLegUpper: 0.45 + lunge * 0.28,
        leftLegLower: Math.max(0.1, -lunge * 0.35),
        rightLegUpper: -0.5 - lunge * 0.2,
        rightLegLower: 0.3,
        bodyLean: 0.18 + slashCycle * 0.18,
        headBob: Math.abs(slashCycle) * 0.06,
        verticalOffset: Math.abs(lunge) * 6,
        spineCurve: slashCycle * 0.14,
        rightWristFlex: slashCycle * 0.48,
      };
      break;
    }

    case 'work_computer': {
      const keyTapL = Math.sin(t * 3.8) * 0.18 + Math.cos(t * 2.5) * 0.09;
      const keyTapR = Math.cos(t * 4.2 + 0.8) * 0.18 + Math.sin(t * 3.1) * 0.09;
      const eurekaMoment = beatProgress > 0.65 && beatIndex % 2 === 1;
      base = {
        leftArmUpper: eurekaMoment ? -1.2 : 0.76 + Math.sin(t * 0.8) * 0.06,
        leftArmLower: eurekaMoment ? -0.42 : 0.86 + keyTapL,
        rightArmUpper: 0.7 + Math.cos(t * 0.9) * 0.06,
        rightArmLower: 0.8 + keyTapR,
        leftLegUpper: 1.38,
        leftLegLower: -1.28,
        rightLegUpper: 1.32,
        rightLegLower: -1.22 + Math.sin(t * 1.8) * 0.07,
        bodyLean: eurekaMoment ? -0.04 : 0.22 + Math.sin(t * 0.6) * 0.04,
        headBob: speechBob + Math.sin(t * 1.4) * 0.06,
        verticalOffset: 18,
        spineCurve: eurekaMoment ? -0.05 : 0.15,
        leftWristFlex: keyTapL * 0.6,
        rightWristFlex: keyTapR * 0.6,
      };
      break;
    }

    case 'money_celebrate': {
      const jump = Math.abs(Math.sin(t * 1.3 + beatSeed));
      const waveL = Math.sin(t * 1.9) * 0.32;
      const waveR = Math.cos(t * 1.7 * PHI) * 0.32;
      base = {
        leftArmUpper: -1.95 + waveL,
        leftArmLower: -0.4 + wristWhipL,
        rightArmUpper: -1.85 + waveR,
        rightArmLower: -0.48 + wristWhipR,
        leftLegUpper: -0.28 * jump + Math.sin(t * 1.3) * 0.25,
        leftLegLower: 0.42 * jump,
        rightLegUpper: 0.28 * jump - Math.sin(t * 1.3) * 0.25,
        rightLegLower: 0.38 * jump,
        bodyLean: Math.sin(t * 0.95) * 0.12,
        headBob: -0.14 + speechBob,
        verticalOffset: -jump * 18,
        spineCurve: -0.1 * jump + Math.sin(t * 1.2) * 0.07,
        leftWristFlex: wristWhipL,
        rightWristFlex: wristWhipR,
      };
      break;
    }

    case 'panic_freakout': {
      const scramble = Math.sin(t * 2.4);
      const handsOnHead = beatProgress < 0.45;
      base = {
        leftArmUpper: handsOnHead ? -2.2 + scramble * 0.14 : -1.65 + oscL * 0.42,
        leftArmLower: handsOnHead ? 1.55 : -0.35 + scramble * 0.35,
        rightArmUpper: handsOnHead ? -2.1 - scramble * 0.14 : 1.55 + oscR * 0.42,
        rightArmLower: handsOnHead ? 1.45 : 0.35 - scramble * 0.35,
        leftLegUpper: scramble * 0.38,
        leftLegLower: Math.max(0.08, -scramble * 0.35),
        rightLegUpper: -scramble * 0.38,
        rightLegLower: Math.max(0.08, scramble * 0.35),
        bodyLean: Math.sin(t * 1.6) * 0.15,
        headBob: Math.abs(scramble) * 0.14 + speechBob,
        verticalOffset: -Math.abs(scramble) * 7,
        spineCurve: Math.sin(t * 2.0) * 0.12,
        leftWristFlex: scramble * 0.35,
        rightWristFlex: -scramble * 0.35,
        headTilt: Math.sin(t * 2.8) * 0.15,
      };
      break;
    }

    case 'dramatic_fall': {
      const fallEase = Math.min(1, beatProgress * 1.25);
      const flail = (1 - fallEase) * Math.sin(t * 2.6) * 0.28;
      base = {
        leftArmUpper: -1.15 * fallEase + flail,
        leftArmLower: 0.42,
        rightArmUpper: -0.9 * fallEase - flail,
        rightArmLower: 0.32,
        leftLegUpper: 0.32 * fallEase + flail * 0.4,
        leftLegLower: 0.22,
        rightLegUpper: 0.5 * fallEase,
        rightLegLower: 0.14,
        bodyLean: -1.3 * fallEase,
        headBob: -0.3 * fallEase,
        verticalOffset: fallEase * 32,
        spineCurve: -0.22 * fallEase,
      };
      break;
    }

    case 'thinking': {
      const paceWave = Math.sin(t * 0.65 + beatSeed);
      const eurekaSnap = beatProgress > 0.72;
      base = {
        leftArmUpper: eurekaSnap ? -1.3 : -0.25 + paceWave * 0.14,
        leftArmLower: eurekaSnap ? -0.4 : 0.8,
        rightArmUpper: -1.12 + Math.sin(t * 1.1) * 0.08,
        rightArmLower: 1.65 + Math.cos(t * 1.4) * 0.08,
        leftLegUpper: paceWave * 0.24,
        leftLegLower: Math.max(0, -paceWave * 0.2),
        rightLegUpper: -paceWave * 0.24,
        rightLegLower: Math.max(0, paceWave * 0.2),
        bodyLean: -0.04 + paceWave * 0.05,
        headBob: speechBob + Math.sin(t * 0.55) * 0.06,
        verticalOffset: Math.abs(paceWave) * 2.2,
        spineCurve: -0.05 + breathe,
        headTilt: eurekaSnap ? 0.14 : -0.12,
      };
      break;
    }

    case 'hero_landing': {
      const crouchFactor =
        beatProgress < 0.35
          ? beatProgress / 0.35
          : beatProgress > 0.75
          ? 1 - ((beatProgress - 0.75) / 0.25) * 0.5
          : 1;
      base = {
        leftArmUpper: 0.82 * crouchFactor - (1 - crouchFactor) * 1.25,
        leftArmLower: 0.3,
        rightArmUpper: -0.42 * crouchFactor - (1 - crouchFactor) * 1.1,
        rightArmLower: 0.82 * crouchFactor,
        leftLegUpper: 1.4 * crouchFactor,
        leftLegLower: -1.3 * crouchFactor,
        rightLegUpper: -0.72 * crouchFactor,
        rightLegLower: 1.1 * crouchFactor,
        bodyLean: 0.38 * crouchFactor,
        headBob: 0.24 * crouchFactor,
        verticalOffset: 22 * crouchFactor,
        spineCurve: 0.2 * crouchFactor,
      };
      break;
    }

    case 'truck_run_alongside': {
      // Tactical combat run alongside moving military truck holding M1 Garand at port-arms
      const stride = Math.sin(t * 1.45);
      const oppStride = -stride;
      const blastDuck = beatIndex === 2 ? Math.sin(beatProgress * Math.PI) * 0.16 : 0;
      base = {
        leftArmUpper: 0.72 + stride * 0.22 + oscL * 0.08,
        leftArmLower: -0.95 + Math.cos(t * 1.45 - 0.18) * 0.16,
        rightArmUpper: 0.42 + oppStride * 0.24 + oscR * 0.08,
        rightArmLower: -0.88 + Math.sin(t * 1.45 - 0.18) * 0.15,
        leftLegUpper: stride * 0.82,
        leftLegLower: Math.max(0.14, -stride * 0.72 + 0.35),
        rightLegUpper: oppStride * 0.82,
        rightLegLower: Math.max(0.14, -oppStride * 0.72 + 0.35),
        bodyLean: 0.24 + blastDuck + Math.sin(t * 2.9) * 0.04,
        headBob: Math.sin(t * 2.9) * 0.08 + speechBob,
        verticalOffset: Math.abs(stride) * -5.5 + blastDuck * 24,
        spineCurve: 0.14 + blastDuck * 0.3,
        leftWristFlex: wristWhipL * 0.25,
        rightWristFlex: wristWhipR * 0.25,
        leftAnkleFlex: stride * 0.32,
        rightAnkleFlex: oppStride * 0.32,
        shoulderShrug: blastDuck * 2.5,
        headTilt: 0.08,
      };
      break;
    }

    case 'trench_cover_fire': {
      // Tactical crouched stance beside truck wheel-arch / sandbag wall, aiming & firing rifle with recoil
      const recoilKick = Math.max(0, Math.sin(t * 5.2)) * 0.14;
      const crouchPulse = 0.28 + Math.sin(t * 0.85 + beatSeed) * 0.08;
      base = {
        leftArmUpper: 1.18 - recoilKick * 0.5,
        leftArmLower: -0.45 - recoilKick * 0.3,
        rightArmUpper: 0.86 - recoilKick * 0.6,
        rightArmLower: -0.78 + recoilKick * 0.4,
        leftLegUpper: 0.68 + crouchPulse,
        leftLegLower: -0.62 - crouchPulse * 0.8,
        rightLegUpper: -0.45,
        rightLegLower: 0.58,
        bodyLean: 0.28 - recoilKick * 0.35,
        headBob: 0.14 + recoilKick * 0.12 + speechBob,
        verticalOffset: 14 + crouchPulse * 12,
        spineCurve: 0.18,
        leftWristFlex: 0.12,
        rightWristFlex: -recoilKick * 0.4,
        shoulderShrug: 1.6,
        headTilt: 0.12 - recoilKick * 0.15,
      };
      break;
    }

    case 'truck_board_convoy': {
      // Sprinting and vaulting onto the rear tailgate of the moving military truck
      const vaultPhase = minimumJerkEase(Math.min(1, beatProgress * 1.3));
      const stride = Math.sin(t * 1.55);
      base = {
        leftArmUpper: -0.85 * vaultPhase + (1 - vaultPhase) * (stride * 0.65),
        leftArmLower: -0.55,
        rightArmUpper: 0.55 + Math.cos(t * 1.55) * 0.25,
        rightArmLower: -0.82,
        leftLegUpper: 0.88 * vaultPhase + (1 - vaultPhase) * stride * 0.75,
        leftLegLower: -0.75 * vaultPhase + 0.25,
        rightLegUpper: -0.35 * vaultPhase - (1 - vaultPhase) * stride * 0.75,
        rightLegLower: 0.45,
        bodyLean: 0.26 - vaultPhase * 0.12,
        headBob: speechBob - vaultPhase * 0.08,
        verticalOffset: -Math.sin(vaultPhase * Math.PI) * 14,
        spineCurve: 0.15,
        leftWristFlex: 0.2,
        rightWristFlex: 0.15,
      };
      break;
    }

    default:
      base = {
        leftArmUpper: 0.18 + oscL * 0.2,
        leftArmLower: 0.18 + wristWhipL * 0.25,
        rightArmUpper: -0.18 + oscR * 0.2,
        rightArmLower: -0.18 + wristWhipR * 0.25,
        leftLegUpper: 0.08,
        leftLegLower: 0,
        rightLegUpper: -0.08,
        rightLegLower: 0,
        bodyLean: breathe,
        headBob: speechBob,
        verticalOffset: 0,
        spineCurve: breathe,
      };
  }

  // Apply maneuver-specific physical overrides with controlled amplitude
  if (maneuver === 'jump_shock') {
    base.leftArmUpper -= impulse * 0.45;
    base.rightArmUpper += impulse * 0.45;
    base.leftLegUpper -= impulse * 0.25;
    base.rightLegUpper += impulse * 0.25;
  } else if (maneuver === 'hologram_present') {
    base.rightArmUpper = 0.75 + Math.sin(t * 1.2) * 0.32;
    base.rightArmLower = -0.65 + Math.cos(t * 1.2) * 0.25;
    base.rightWristFlex = Math.sin(t * 2.0) * 0.28;
  } else if (maneuver === 'dodge_slide' || maneuver === 'slide_kick') {
    base.bodyLean = -0.3;
    base.leftLegUpper = 1.05;
    base.leftLegLower = -0.15;
    base.rightLegUpper = -0.68;
    base.rightLegLower = 0.88;
    base.verticalOffset = 15;
  } else if (maneuver === 'parry') {
    base.rightArmUpper = 1.15;
    base.rightArmLower = -1.15;
    base.leftArmUpper = 0.65;
    base.leftArmLower = -0.95;
    base.bodyLean = -0.18;
  }

  // Apply contextual anticipation, reaction, weightShift, and settle modulation when motionContext is supplied
  if (motionContext !== undefined) {
    const leanMod = anticipation * 0.45 + ctxWeightShift * 0.08 + seedAsymmetry * 0.2;
    base.bodyLean = (base.bodyLean + leanMod) * settleEnvelope;
    base.spineCurve = ((base.spineCurve || 0) + leanMod * 0.65) * settleEnvelope;
    base.leftArmUpper += (anticipation * 0.28 + seedAsymmetry * 0.35) * settleEnvelope;
    base.rightArmUpper += (-anticipation * 0.28 - seedAsymmetry * 0.35) * settleEnvelope;
    base.headTilt = ((base.headTilt || 0) + seedAsymmetry * 0.25 + ctxWeightShift * 0.05) * settleEnvelope;

    // Ground plane guard: prevent non-vehicle / non-fall verticalOffset from pushing feet below groundY
    const isSeatedOrFall =
      action === 'drive_car' ||
      action === 'car_chase' ||
      action === 'car_drift' ||
      action === 'car_police' ||
      action === 'motorcycle' ||
      action === 'work_computer' ||
      action === 'dramatic_fall' ||
      action === 'hero_landing';
    if (!isSeatedOrFall) {
      base.verticalOffset = Math.max(-22, Math.min(12, base.verticalOffset));
    }
  }

  return base;
}

/**
 * Calculates camera transform adjustments (zoom, shake, pan) based on camera effect and time.
 */
export function calculateCameraTransform(
  effect: CameraEffect,
  progress: number
): { zoom: number; offsetX: number; offsetY: number } {
  switch (effect) {
    case 'zoom_in': {
      const zoom = 1 + progress * 0.25;
      return { zoom, offsetX: 0, offsetY: 0 };
    }

    case 'shake': {
      const decay = Math.max(0, 1 - progress * 2);
      const intensity = 12 * decay;
      const freq = progress * 60;
      const offsetX = Math.sin(freq) * intensity;
      const offsetY = Math.cos(freq * 1.3) * intensity;
      return { zoom: 1.04, offsetX, offsetY };
    }

    case 'pan_right': {
      const offsetX = -progress * 60;
      return { zoom: 1.08, offsetX, offsetY: 0 };
    }

    case 'pulse': {
      const pulse = Math.sin(progress * Math.PI * 4) * 0.06;
      return { zoom: 1 + Math.max(0, pulse), offsetX: 0, offsetY: 0 };
    }

    default:
      return { zoom: 1, offsetX: 0, offsetY: 0 };
  }
}

/**
 * Calculates total project duration by summing all scene durations.
 */
export function calculateTotalDuration(scenes: StickmanScene[]): number {
  if (!scenes || scenes.length === 0) return 0;
  return scenes.reduce((sum, s) => sum + Math.max(1, s.duration), 0);
}

/**
 * Given a global playhead timestamp (in seconds), finds the active scene,
 * scene index, and scene progress percentage [0..1].
 */
export function getSceneAtTimestamp(
  scenes: StickmanScene[],
  currentTime: number
): { scene: StickmanScene | null; index: number; sceneProgress: number } {
  if (!scenes || scenes.length === 0) {
    return { scene: null, index: -1, sceneProgress: 0 };
  }

  let accumulated = 0;
  for (let i = 0; i < scenes.length; i++) {
    const s = scenes[i];
    const dur = Math.max(1, s.duration);
    if (currentTime < accumulated + dur || i === scenes.length - 1) {
      const elapsedInScene = Math.max(0, Math.min(dur, currentTime - accumulated));
      return {
        scene: s,
        index: i,
        sceneProgress: elapsedInScene / dur,
      };
    }
    accumulated += dur;
  }

  return { scene: scenes[scenes.length - 1], index: scenes.length - 1, sceneProgress: 1 };
}

export interface TwoBoneIKSolution {
  midX: number;
  midY: number;
  endX: number;
  endY: number;
  upperAngle: number;
  lowerAngle: number;
  reachRatio: number;
}

/**
 * Exact 2-Bone Analytical Inverse Kinematics solver using the Law of Cosines.
 * Uses the stickman coordinate convention where angle 0 points straight down (+Y)
 * and positive angles rotate toward +X:
 *   mid = origin + (sin(upperAngle)*L1, cos(upperAngle)*L1)
 *   end = mid + (sin(upperAngle + lowerAngle)*L2, cos(upperAngle + lowerAngle)*L2)
 */
export function solveTwoBoneIK(
  originX: number,
  originY: number,
  targetX: number,
  targetY: number,
  lenUpper: number,
  lenLower: number,
  bendSign: 1 | -1 = 1
): TwoBoneIKSolution {
  const L1 = Math.max(1, lenUpper);
  const L2 = Math.max(1, lenLower);
  const dx = targetX - originX;
  const dy = targetY - originY;
  const rawDist = Math.hypot(dx, dy);
  const maxReach = (L1 + L2) * 0.992;
  const minReach = Math.max(1, Math.abs(L1 - L2) + 0.5);
  const d = Math.max(minReach, Math.min(maxReach, rawDist));

  // Base direction angle in our convention (sin(a) = dx/d, cos(a) = dy/d)
  const baseAngle = Math.atan2(dx, dy);

  const cosAlpha = Math.max(
    -1,
    Math.min(1, (L1 * L1 + d * d - L2 * L2) / (2 * L1 * d))
  );
  const alpha = Math.acos(cosAlpha);

  const cosBeta = Math.max(
    -1,
    Math.min(1, (L1 * L1 + L2 * L2 - d * d) / (2 * L1 * L2))
  );
  const beta = Math.acos(cosBeta);

  const upperAngle = baseAngle + bendSign * alpha;
  const lowerAngle = -bendSign * (Math.PI - beta);

  const midX = originX + Math.sin(upperAngle) * L1;
  const midY = originY + Math.cos(upperAngle) * L1;
  const totalLower = upperAngle + lowerAngle;
  const endX = midX + Math.sin(totalLower) * L2;
  const endY = midY + Math.cos(totalLower) * L2;

  return {
    midX,
    midY,
    endX,
    endY,
    upperAngle,
    lowerAngle,
    reachRatio: Math.min(1, rawDist / (L1 + L2)),
  };
}

export interface SceneAnchorMap {
  groundY: number;
  horizonY: number;
  interactionAnchor?: {
    x: number;
    y: number;
    type: 'barricade' | 'workstation' | 'radar' | 'vault' | 'podium' | 'crate';
    label: string;
  };
  lightSource: {
    x: number;
    y: number;
    color: string;
    ambientTint: string;
    intensity: number;
  };
}

/**
 * Returns deterministic spatial anchors and lighting coordinates for each environment theme
 * so characters and lighting shaders interact physically with the scene geometry.
 */
export function getSceneAnchors(
  environment: StickmanScene['environment'],
  width: number,
  height: number
): SceneAnchorMap {
  const groundY = height * 0.72;
  const horizonY = height * 0.48;

  switch (environment) {
    case 'zombie_apocalypse':
      return {
        groundY,
        horizonY,
        interactionAnchor: {
          x: width * 0.57,
          y: groundY - 46,
          type: 'barricade',
          label: 'Barricada de Contenção',
        },
        lightSource: {
          x: width * 0.78,
          y: height * 0.22,
          color: '#FB923C',
          ambientTint: 'rgba(234, 88, 12, 0.14)',
          intensity: 0.85,
        },
      };

    case 'bunker_survival':
      return {
        groundY,
        horizonY,
        interactionAnchor: {
          x: width * 0.5,
          y: groundY - 52,
          type: 'radar',
          label: 'Console de Radar',
        },
        lightSource: {
          x: width * 0.5,
          y: groundY - 195,
          color: '#10B981',
          ambientTint: 'rgba(16, 185, 129, 0.14)',
          intensity: 0.82,
        },
      };

    case 'hacker_den':
    case 'secret_lab':
      return {
        groundY,
        horizonY,
        interactionAnchor: {
          x: width * 0.5,
          y: groundY - 38,
          type: 'workstation',
          label: 'Terminal Central',
        },
        lightSource: {
          x: width * 0.5,
          y: height * 0.18,
          color: '#10B981',
          ambientTint: 'rgba(16, 185, 129, 0.12)',
          intensity: 0.78,
        },
      };

    case 'bank_heist':
      return {
        groundY,
        horizonY,
        interactionAnchor: {
          x: width * 0.5,
          y: groundY - 62,
          type: 'vault',
          label: 'Porta do Cofre',
        },
        lightSource: {
          x: width * 0.5,
          y: height * 0.15,
          color: '#EF4444',
          ambientTint: 'rgba(239, 68, 68, 0.12)',
          intensity: 0.8,
        },
      };

    case 'highway_sunset':
      return {
        groundY,
        horizonY,
        lightSource: {
          x: width * 0.7,
          y: groundY - 40,
          color: '#FDE047',
          ambientTint: 'rgba(251, 146, 60, 0.18)',
          intensity: 0.92,
        },
      };

    case 'police_chase_night':
      return {
        groundY,
        horizonY,
        lightSource: {
          x: width * 0.82,
          y: height * 0.18,
          color: '#3B82F6',
          ambientTint: 'rgba(59, 130, 246, 0.16)',
          intensity: 0.9,
        },
      };

    case 'trillionaire_sandbox':
    case 'money_vault':
    case 'luxury_penthouse':
      return {
        groundY,
        horizonY,
        interactionAnchor: {
          x: width * 0.5,
          y: groundY - 48,
          type: 'podium',
          label: 'Mesa Executiva',
        },
        lightSource: {
          x: width * 0.65,
          y: height * 0.16,
          color: '#FBBF24',
          ambientTint: 'rgba(245, 158, 11, 0.14)',
          intensity: 0.86,
        },
      };

    case 'ww2_battlefield':
      return {
        groundY: height * 0.74,
        horizonY: height * 0.54,
        interactionAnchor: {
          x: width * 0.48,
          y: height * 0.74 - 42,
          type: 'barricade',
          label: 'Caminhão Militar 6x6 FEB & Trincheira',
        },
        lightSource: {
          x: width * 0.68,
          y: height * 0.24,
          color: '#FB923C',
          ambientTint: 'rgba(249, 115, 22, 0.16)',
          intensity: 0.92,
        },
      };

    default:
      return {
        groundY,
        horizonY,
        lightSource: {
          x: width * 0.5,
          y: height * 0.12,
          color: '#38BDF8',
          ambientTint: 'rgba(56, 189, 248, 0.1)',
          intensity: 0.75,
        },
      };
  }
}

export interface BiomechanicalHumanPose {
  pelvisX: number;
  pelvisY: number;
  pelvisTilt: number;
  leftHipX: number;
  leftHipY: number;
  rightHipX: number;
  rightHipY: number;
  lumbarX: number;
  lumbarY: number;
  thoraxX: number;
  thoraxY: number;
  neckX: number;
  neckY: number;
  leftShoulderX: number;
  leftShoulderY: number;
  rightShoulderX: number;
  rightShoulderY: number;
  headCenterX: number;
  headCenterY: number;
  headTilt: number;
  chestBreath: number;
  leftLeg: {
    kneeX: number;
    kneeY: number;
    ankleX: number;
    ankleY: number;
    toeX: number;
    toeY: number;
    planted: boolean;
  };
  rightLeg: {
    kneeX: number;
    kneeY: number;
    ankleX: number;
    ankleY: number;
    toeX: number;
    toeY: number;
    planted: boolean;
  };
  leftArm: {
    elbowX: number;
    elbowY: number;
    wristX: number;
    wristY: number;
    handX: number;
    handY: number;
    thumbX: number;
    thumbY: number;
    fingerX: number;
    fingerY: number;
    wristAngle: number;
  };
  rightArm: {
    elbowX: number;
    elbowY: number;
    wristX: number;
    wristY: number;
    handX: number;
    handY: number;
    thumbX: number;
    thumbY: number;
    fingerX: number;
    fingerY: number;
    wristAngle: number;
  };
}

/**
 * Resolves a full human-proportioned biomechanical pose from `LimbAngles`,
 * applying 2-bone Analytical IK for foot-planting on the ground plane (`y = 0`),
 * Inman's 6-determinant human gait cycle with heel-strike knee absorption,
 * Center-of-Mass (COM) inertial lean, 2.5D yaw foreshortening (`facingCos`),
 * prosodic syllable-driven speech gestures, and articulated hand/thumb geometry.
 */
export function resolveBiomechanicalHumanPose(
  angles: LimbAngles,
  action: StickmanAction,
  progress: number,
  elapsedSec?: number,
  beatProgress: number = 0.5,
  velocityX: number = 0,
  motionContext?: MotionVariationContext,
  handTargetLocal?: { x: number; y: number; blend: number; hand?: 'left' | 'right' },
  prosodicEnvelope?: ProsodicSpeechEnvelope,
  facingCos: number = 1
): BiomechanicalHumanPose {
  const sec = elapsedSec !== undefined ? elapsedSec : progress * 4.8;
  const rawSeed = motionContext?.seed ? Math.abs(Math.trunc(motionContext.seed)) : 0;
  const seedPhase = rawSeed > 0 ? ((rawSeed % 997) / 997) * Math.PI * 2 : 0;

  const isSeated =
    action === 'drive_car' ||
    action === 'car_chase' ||
    action === 'car_drift' ||
    action === 'car_police' ||
    action === 'motorcycle' ||
    action === 'work_computer';

  const isLocomotion =
    action === 'walk_city' ||
    action === 'walking' ||
    action === 'running' ||
    action === 'scavenge_supplies' ||
    action === 'truck_run_alongside' ||
    action === 'truck_board_convoy';

  const isAirborneOrFall =
    action === 'dramatic_fall' ||
    action === 'money_celebrate' ||
    (action === 'fight_kungfu' && angles.verticalOffset < -8);

  const legLenUpper = 38;
  const legLenLower = 38;
  const footLen = 12;
  const spineLength = 56;

  // Breathing ribcage expansion + band-limited Perlin micro-breath
  const chestBreath =
    Math.sin(sec * 2.1 + seedPhase * 0.3) * 1.3 +
    organicPerlin1D(sec * 0.9, rawSeed + 53) * 0.6;

  // 2.5D Yaw Foreshortening: narrows shoulder & hip width smoothly during 3/4 turns
  const absFacing = Math.max(0.32, Math.min(1, Math.abs(facingCos)));
  const foreshortenFactor = 0.45 + 0.55 * absFacing;

  // Center-of-Mass (COM) Inertial Balance & Inman Gait Pelvis Dynamics
  const weightShift = motionContext?.weightShift ?? 0;
  const inertialLean = Math.max(-0.18, Math.min(0.18, velocityX * 0.42));
  const effectiveBodyLean = angles.bodyLean + inertialLean * 0.55;

  const isRun =
    action === 'running' ||
    action === 'truck_run_alongside' ||
    action === 'truck_board_convoy';
  const gaitCycle = sec * Math.PI * (isRun ? 1.35 : 0.95) + seedPhase * 0.25;
  // Inman's vertical pelvis oscillation: peaks at mid-stance (2x gait frequency), cushions at heel strike
  const gaitPelvisBounce = isLocomotion
    ? -Math.abs(Math.cos(gaitCycle)) * (isRun ? 4.2 : 2.4) + (isRun ? 1.8 : 1.0)
    : 0;

  const pelvisX = Math.sin(effectiveBodyLean) * 4.5 + weightShift * 3.8;
  const pelvisY = -74 + angles.verticalOffset + gaitPelvisBounce;
  const pelvisTilt =
    (angles.leftLegUpper - angles.rightLegUpper) * 0.14 + weightShift * 0.08;

  const hipHalfWidth = 5.6 * foreshortenFactor;
  const leftHipX = pelvisX - Math.cos(pelvisTilt) * hipHalfWidth;
  const leftHipY = pelvisY - Math.sin(pelvisTilt) * hipHalfWidth;
  const rightHipX = pelvisX + Math.cos(pelvisTilt) * hipHalfWidth;
  const rightHipY = pelvisY + Math.sin(pelvisTilt) * hipHalfWidth;

  // Prosodic speech gesture modulation (natural syllable beats when speaking)
  const speechBeat =
    prosodicEnvelope && !prosodicEnvelope.isBreathPause
      ? prosodicEnvelope.syllablePulse * (0.65 + prosodicEnvelope.emphasisBoost * 0.55)
      : 0;

  // 3-Segment Anatomical S-Spine (Pelvis -> Lumbar -> Thorax -> Neck)
  const neckX =
    pelvisX +
    Math.sin(effectiveBodyLean) * spineLength +
    speechBeat * 1.4;
  const neckY =
    pelvisY -
    Math.cos(effectiveBodyLean) * spineLength -
    (angles.shoulderShrug || 0);

  const spineCurveOffset = (angles.spineCurve || 0) * 24;
  const lumbarX = pelvisX * 0.65 + neckX * 0.35 + spineCurveOffset * 0.55;
  const lumbarY = pelvisY * 0.65 + neckY * 0.35;
  const thoraxX = pelvisX * 0.28 + neckX * 0.72 + spineCurveOffset * 0.85;
  const thoraxY = pelvisY * 0.28 + neckY * 0.72;

  // Clavicle / Bi-deltoid Shoulder Girdle with natural counter-swing & 2.5D foreshortening
  const armCounterTwist = (angles.rightArmUpper - angles.leftArmUpper) * 0.14;
  const shoulderCenterY = neckY + 8.5;
  const shoulderSpan = (7.8 + chestBreath * 0.25) * foreshortenFactor;
  const leftShoulderX = neckX - Math.cos(armCounterTwist) * shoulderSpan;
  const leftShoulderY = shoulderCenterY - Math.sin(armCounterTwist) * 2.6;
  const rightShoulderX = neckX + Math.cos(armCounterTwist) * shoulderSpan;
  const rightShoulderY = shoulderCenterY + Math.sin(armCounterTwist) * 2.6;

  // Resolve Legs: FK baseline + Analytical 2-Bone IK Foot-Planting
  const fkKneeLX = leftHipX + Math.sin(angles.leftLegUpper) * legLenUpper;
  const fkKneeLY = leftHipY + Math.cos(angles.leftLegUpper) * legLenUpper;
  const fkAnkleLX =
    fkKneeLX + Math.sin(angles.leftLegUpper + angles.leftLegLower) * legLenLower;
  const fkAnkleLY =
    fkKneeLY + Math.cos(angles.leftLegUpper + angles.leftLegLower) * legLenLower;

  const fkKneeRX = rightHipX + Math.sin(angles.rightLegUpper) * legLenUpper;
  const fkKneeRY = rightHipY + Math.cos(angles.rightLegUpper) * legLenUpper;
  const fkAnkleRX =
    fkKneeRX + Math.sin(angles.rightLegUpper + angles.rightLegLower) * legLenLower;
  const fkAnkleRY =
    fkKneeRY + Math.cos(angles.rightLegUpper + angles.rightLegLower) * legLenLower;

  let kneeLX = fkKneeLX;
  let kneeLY = fkKneeLY;
  let ankleLX = fkAnkleLX;
  let ankleLY = fkAnkleLY;
  let plantedL = false;

  let kneeRX = fkKneeRX;
  let kneeRY = fkKneeRY;
  let ankleRX = fkAnkleRX;
  let ankleRY = fkAnkleRY;
  let plantedR = false;

  if (!isSeated && !isAirborneOrFall) {
    if (isLocomotion) {
      // Natural Human Gait Cycle via 2-Bone IK: Stance foot locks on ground (y = -2), Swing foot arcs with heel-to-toe clearance
      const strideSpan = isRun ? 28 : 20;
      const liftHeight = isRun ? 21 : 12.5;

      const phaseL = Math.sin(gaitCycle);
      const rawSwingL = Math.cos(gaitCycle);
      // Smooth asymmetric swing clearance curve (sharper toe-off lift, gentle heel descent)
      const liftL = rawSwingL > 0 ? Math.pow(rawSwingL, 1.25) : 0;
      const targetAnkleLX = leftHipX + phaseL * strideSpan;
      const targetAnkleLY = Math.min(-2, -2 - liftL * liftHeight);
      const ikL = solveTwoBoneIK(
        leftHipX,
        leftHipY,
        targetAnkleLX,
        targetAnkleLY,
        legLenUpper,
        legLenLower,
        1
      );
      kneeLX = ikL.midX;
      kneeLY = ikL.midY;
      ankleLX = ikL.endX;
      ankleLY = ikL.endY;
      plantedL = liftL < 0.16;

      const phaseR = Math.sin(gaitCycle + Math.PI);
      const rawSwingR = Math.cos(gaitCycle + Math.PI);
      const liftR = rawSwingR > 0 ? Math.pow(rawSwingR, 1.25) : 0;
      const targetAnkleRX = rightHipX + phaseR * strideSpan;
      const targetAnkleRY = Math.min(-2, -2 - liftR * liftHeight);
      const ikR = solveTwoBoneIK(
        rightHipX,
        rightHipY,
        targetAnkleRX,
        targetAnkleRY,
        legLenUpper,
        legLenLower,
        1
      );
      kneeRX = ikR.midX;
      kneeRY = ikR.midY;
      ankleRX = ikR.endX;
      ankleRY = ikR.endY;
      plantedR = liftR < 0.16;
    } else {
      // Grounded stance: plant feet firmly on the ground plane (y = -2) via 2-bone IK
      // so knees flex naturally when pelvis dips or shifts weight, and feet never penetrate ground!
      const targetLX = fkAnkleLX;
      const targetLY = Math.min(-2, fkAnkleLY);
      const ikL = solveTwoBoneIK(
        leftHipX,
        leftHipY,
        targetLX,
        targetLY,
        legLenUpper,
        legLenLower,
        1
      );
      kneeLX = ikL.midX;
      kneeLY = ikL.midY;
      ankleLX = ikL.endX;
      ankleLY = ikL.endY;
      plantedL = Math.abs(ankleLY + 2) < 3.5;

      const targetRX = fkAnkleRX;
      const targetRY = Math.min(-2, fkAnkleRY);
      const ikR = solveTwoBoneIK(
        rightHipX,
        rightHipY,
        targetRX,
        targetRY,
        legLenUpper,
        legLenLower,
        1
      );
      kneeRX = ikR.midX;
      kneeRY = ikR.midY;
      ankleRX = ikR.endX;
      ankleRY = ikR.endY;
      plantedR = Math.abs(ankleRY + 2) < 3.5;
    }
  }

  // Foot / Toe articulation (flat on ground when planted, natural dorsiflexion/plantarflexion in air)
  const ankleAngleL = plantedL
    ? Math.PI * 0.48
    : angles.leftLegUpper + angles.leftLegLower + 1.35 + (angles.leftAnkleFlex || 0);
  const toeLX = ankleLX + Math.sin(ankleAngleL) * footLen;
  const toeLY = plantedL ? Math.min(0, ankleLY + 2) : ankleLY + Math.cos(ankleAngleL) * footLen;

  const ankleAngleR = plantedR
    ? Math.PI * 0.48
    : angles.rightLegUpper + angles.rightLegLower + 1.35 + (angles.rightAnkleFlex || 0);
  const toeRX = ankleRX + Math.sin(ankleAngleR) * footLen;
  const toeRY = plantedR ? Math.min(0, ankleRY + 2) : ankleRY + Math.cos(ankleAngleR) * footLen;

  // Arms: Upper Arm -> Forearm -> Wrist/Hand with prosodic speech pulse & optional 2-bone IK target blend
  const armLenUpper = 32;
  const armLenLower = 28;
  const handLen = 9.5;

  const prosodicArmLiftL = speechBeat * 0.11;
  const prosodicArmLiftR = speechBeat * 0.16;
  const prosodicWristOpen = speechBeat * 0.18;

  const effLeftUpper = angles.leftArmUpper + prosodicArmLiftL;
  const effLeftLower = angles.leftArmLower - prosodicArmLiftL * 0.6;
  const effRightUpper = angles.rightArmUpper + prosodicArmLiftR;
  const effRightLower = angles.rightArmLower - prosodicArmLiftR * 0.7;

  let elbowLX = leftShoulderX + Math.sin(effLeftUpper) * armLenUpper;
  let elbowLY = leftShoulderY + Math.cos(effLeftUpper) * armLenUpper;
  let wristLX =
    elbowLX + Math.sin(effLeftUpper + effLeftLower) * armLenLower;
  let wristLY =
    elbowLY + Math.cos(effLeftUpper + effLeftLower) * armLenLower;
  let wristAngleL =
    effLeftUpper + effLeftLower + (angles.leftWristFlex || 0) - prosodicWristOpen * 0.5;

  let elbowRX = rightShoulderX + Math.sin(effRightUpper) * armLenUpper;
  let elbowRY = rightShoulderY + Math.cos(effRightUpper) * armLenUpper;
  let wristRX =
    elbowRX + Math.sin(effRightUpper + effRightLower) * armLenLower;
  let wristRY =
    elbowRY + Math.cos(effRightUpper + effRightLower) * armLenLower;
  let wristAngleR =
    effRightUpper + effRightLower + (angles.rightWristFlex || 0) + prosodicWristOpen;

  if (handTargetLocal && handTargetLocal.blend > 0.01) {
    const b = Math.max(0, Math.min(1, handTargetLocal.blend));
    if (handTargetLocal.hand === 'left') {
      const ikArmL = solveTwoBoneIK(
        leftShoulderX,
        leftShoulderY,
        handTargetLocal.x,
        handTargetLocal.y,
        armLenUpper,
        armLenLower,
        -1
      );
      elbowLX = elbowLX + (ikArmL.midX - elbowLX) * b;
      elbowLY = elbowLY + (ikArmL.midY - elbowLY) * b;
      wristLX = wristLX + (ikArmL.endX - wristLX) * b;
      wristLY = wristLY + (ikArmL.endY - wristLY) * b;
      wristAngleL = ikArmL.upperAngle + ikArmL.lowerAngle;
    } else {
      const ikArmR = solveTwoBoneIK(
        rightShoulderX,
        rightShoulderY,
        handTargetLocal.x,
        handTargetLocal.y,
        armLenUpper,
        armLenLower,
        -1
      );
      elbowRX = elbowRX + (ikArmR.midX - elbowRX) * b;
      elbowRY = elbowRY + (ikArmR.midY - elbowRY) * b;
      wristRX = wristRX + (ikArmR.endX - wristRX) * b;
      wristRY = wristRY + (ikArmR.endY - wristRY) * b;
      wristAngleR = ikArmR.upperAngle + ikArmR.lowerAngle;
    }
  }

  const handLX = wristLX + Math.sin(wristAngleL) * handLen;
  const handLY = wristLY + Math.cos(wristAngleL) * handLen;
  const handRX = wristRX + Math.sin(wristAngleR) * handLen;
  const handRY = wristRY + Math.cos(wristAngleR) * handLen;

  // Articulated thumb and index/finger silhouettes (open slightly during speech emphasis)
  const fingerSpread = 0.42 + speechBeat * 0.16;
  const thumbLX = wristLX + Math.sin(wristAngleL - fingerSpread) * (handLen * 0.68);
  const thumbLY = wristLY + Math.cos(wristAngleL - fingerSpread) * (handLen * 0.68);
  const fingerLX = handLX + Math.sin(wristAngleL + 0.12) * 3.8;
  const fingerLY = handLY + Math.cos(wristAngleL + 0.12) * 3.8;

  const thumbRX = wristRX + Math.sin(wristAngleR - fingerSpread) * (handLen * 0.68);
  const thumbRY = wristRY + Math.cos(wristAngleR - fingerSpread) * (handLen * 0.68);
  const fingerRX = handRX + Math.sin(wristAngleR + 0.12) * 3.8;
  const fingerRY = handRY + Math.cos(wristAngleR + 0.12) * 3.8;

  const headRadius = 18;
  const headTilt =
    (angles.headTilt || 0) +
    velocityX * 0.08 +
    speechBeat * 0.06;
  const headCenterX = neckX + Math.sin(effectiveBodyLean + headTilt) * 16;
  const headCenterY = neckY - headRadius + angles.headBob + speechBeat * 1.1;

  return {
    pelvisX,
    pelvisY,
    pelvisTilt,
    leftHipX,
    leftHipY,
    rightHipX,
    rightHipY,
    lumbarX,
    lumbarY,
    thoraxX,
    thoraxY,
    neckX,
    neckY,
    leftShoulderX,
    leftShoulderY,
    rightShoulderX,
    rightShoulderY,
    headCenterX,
    headCenterY,
    headTilt,
    chestBreath,
    leftLeg: {
      kneeX: kneeLX,
      kneeY: kneeLY,
      ankleX: ankleLX,
      ankleY: ankleLY,
      toeX: toeLX,
      toeY: toeLY,
      planted: plantedL,
    },
    rightLeg: {
      kneeX: kneeRX,
      kneeY: kneeRY,
      ankleX: ankleRX,
      ankleY: ankleRY,
      toeX: toeRX,
      toeY: toeRY,
      planted: plantedR,
    },
    leftArm: {
      elbowX: elbowLX,
      elbowY: elbowLY,
      wristX: wristLX,
      wristY: wristLY,
      handX: handLX,
      handY: handLY,
      thumbX: thumbLX,
      thumbY: thumbLY,
      fingerX: fingerLX,
      fingerY: fingerLY,
      wristAngle: wristAngleL,
    },
    rightArm: {
      elbowX: elbowRX,
      elbowY: elbowRY,
      wristX: wristRX,
      wristY: wristRY,
      handX: handRX,
      handY: handRY,
      thumbX: thumbRX,
      thumbY: thumbRY,
      fingerX: fingerRX,
      fingerY: fingerRY,
      wristAngle: wristAngleR,
    },
  };
}


