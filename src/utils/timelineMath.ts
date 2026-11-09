import { Clip, Track } from '../types/editor';

/**
 * Splits a clip into two at a given splitTime on the timeline.
 * Returns [firstClip, secondClip] or null if splitTime is outside the clip.
 */
export function splitClip(clip: Clip, splitTime: number): [Clip, Clip] | null {
  const clipEnd = clip.startTime + clip.duration;
  // Minimum 0.1s threshold so we don't create invisible 0-length clips
  if (splitTime <= clip.startTime + 0.05 || splitTime >= clipEnd - 0.05) {
    return null;
  }

  const firstDuration = splitTime - clip.startTime;
  const secondDuration = clip.duration - firstDuration;

  const firstClip: Clip = {
    ...clip,
    id: `${clip.id}_a_${Date.now()}`,
    duration: firstDuration,
  };

  const secondClip: Clip = {
    ...clip,
    id: `${clip.id}_b_${Date.now() + 1}`,
    startTime: splitTime,
    duration: secondDuration,
    trimStart: clip.trimStart + firstDuration * clip.speed,
  };

  return [firstClip, secondClip];
}

/**
 * Magnetic snapping against candidate points (clip starts, ends, playhead, 0)
 */
export function snapToPoints(time: number, snapPoints: number[], threshold = 0.2): { snappedTime: number; didSnap: boolean } {
  let closestDist = Infinity;
  let closestPoint = time;

  for (const point of snapPoints) {
    const dist = Math.abs(time - point);
    if (dist < closestDist && dist <= threshold) {
      closestDist = dist;
      closestPoint = point;
    }
  }

  if (closestDist <= threshold) {
    return { snappedTime: closestPoint, didSnap: true };
  }

  return { snappedTime: time, didSnap: false };
}

/**
 * Calculates the total project duration based on clips + padding.
 */
export function calculateProjectDuration(clips: Clip[], minDuration = 10, padding = 4): number {
  if (clips.length === 0) return minDuration;
  const maxEnd = Math.max(...clips.map(c => c.startTime + c.duration));
  return Math.max(minDuration, Math.ceil(maxEnd + padding));
}

/**
 * Finds all active clips at a specific playhead time.
 */
export function findClipsAtTime(clips: Clip[], time: number): Clip[] {
  return clips.filter(clip => {
    const end = clip.startTime + clip.duration;
    return time >= clip.startTime && time < end;
  });
}

/**
 * Computes the source media time for a clip given the current timeline time.
 */
export function getClipCurrentSourceTime(clip: Clip, timelineTime: number): number {
  const offset = timelineTime - clip.startTime;
  if (offset < 0 || offset > clip.duration) return clip.trimStart;
  return clip.trimStart + offset * clip.speed;
}

/**
 * Builds CSS filter string for canvas/video element from ClipFilters
 */
export function getCssFilterString(filters: Clip['filters']): string {
  const parts: string[] = [];

  // Base adjustments
  if (filters.brightness !== 100) parts.push(`brightness(${filters.brightness}%)`);
  if (filters.contrast !== 100) parts.push(`contrast(${filters.contrast}%)`);
  if (filters.saturation !== 100) parts.push(`saturate(${filters.saturation}%)`);
  if (filters.sepia > 0) parts.push(`sepia(${filters.sepia}%)`);
  if (filters.grayscale > 0) parts.push(`grayscale(${filters.grayscale}%)`);
  if (filters.blur > 0) parts.push(`blur(${filters.blur}px)`);
  if (filters.hueRotate > 0) parts.push(`hue-rotate(${filters.hueRotate}deg)`);

  // Presets
  switch (filters.preset) {
    case 'teal-orange':
      parts.push('contrast(115%) saturate(130%) hue-rotate(-10deg)');
      break;
    case 'vintage':
      parts.push('sepia(35%) contrast(90%) brightness(105%) saturate(85%)');
      break;
    case 'noir':
      parts.push('grayscale(100%) contrast(140%) brightness(95%)');
      break;
    case 'cyberpunk':
      parts.push('contrast(125%) saturate(160%) hue-rotate(180deg)');
      break;
    case 'warm-sunset':
      parts.push('sepia(20%) saturate(125%) brightness(105%)');
      break;
    case 'crisp-clean':
      parts.push('contrast(110%) brightness(102%) saturate(108%)');
      break;
  }

  return parts.length > 0 ? parts.join(' ') : 'none';
}
