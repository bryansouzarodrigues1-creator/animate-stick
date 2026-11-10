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
 * Uses irrational frequency ratios (phi = 1.618, sqrt2 = 1.414, sqrt3 = 1.732)
 * and optional deterministic `motionContext` (seed, intensity, anticipation, reaction, settle, weightShift)
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

  // Non-repeating irrational harmonics for organic looseness ("solto mas controlado")
  const PHI = 1.6180339;
  const SQRT2 = 1.4142135;
  const SQRT3 = 1.7320508;

  // Gentle phase offset per beat + deterministic seedPhaseOffset
  const beatSeed = beatIndex * 1.15 + seedPhaseOffset;
  const ampScale = motionContext !== undefined ? 0.68 + ctxIntensity * 0.48 : 1.0;

  const oscL =
    (Math.sin(t + beatSeed) * 0.42 + Math.sin(t * PHI * 0.65 + 1.1 + seedAsymmetry) * 0.22) *
    ampScale;
  const oscR =
    (Math.sin(t * SQRT2 * 0.65 + 2.3 + beatSeed) * 0.42 +
      Math.cos(t * 0.55 - seedAsymmetry) * 0.22) *
    ampScale;
  const wristWhipL = Math.sin(t * SQRT3 * 0.6 - 0.6 + seedPhaseOffset * 0.5) * 0.22 * ampScale;
  const wristWhipR = Math.cos(t * PHI * 0.6 - 0.8 - seedPhaseOffset * 0.5) * 0.22 * ampScale;
  const breathe = Math.sin(t * 0.45 + seedPhaseOffset * 0.25) * 0.035;

  // Controlled beat impulse curve with anticipation -> action/reaction -> settle envelope
  const clampedBeatProg = Math.max(0, Math.min(1, beatProgress));
  const settleEnvelope =
    clampedBeatProg > 0.75
      ? 1 - ((clampedBeatProg - 0.75) / 0.25) * (0.35 * ctxSettle)
      : 1.0;
  const impulse =
    Math.sin(clampedBeatProg * Math.PI) * (0.45 + 0.35 * ctxReaction) * settleEnvelope;
  const anticipation =
    clampedBeatProg < 0.24
      ? -Math.sin((clampedBeatProg / 0.24) * Math.PI) * (0.1 + 0.18 * ctxAnticipation)
      : 0;

  const speechBob = isSpeaking
    ? Math.sin(t * 1.8) * 0.08 + Math.cos(t * 2.7) * 0.04
    : Math.sin(t * 0.5) * 0.025;

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
