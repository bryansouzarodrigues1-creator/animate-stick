/**
 * Timecode formatting and calculation utilities for video editing (SMPTE style & duration)
 */

export function formatTimecode(seconds: number, fps = 30): string {
  const safeSeconds = Math.max(0, isNaN(seconds) ? 0 : seconds);
  const totalFrames = Math.floor(safeSeconds * fps);
  
  const hours = Math.floor(totalFrames / (fps * 3600));
  const minutes = Math.floor((totalFrames % (fps * 3600)) / (fps * 60));
  const secs = Math.floor((totalFrames % (fps * 60)) / fps);
  const frames = totalFrames % fps;

  const pad = (n: number) => n.toString().padStart(2, '0');
  
  if (hours > 0) {
    return `${pad(hours)}:${pad(minutes)}:${pad(secs)}:${pad(frames)}`;
  }
  return `${pad(minutes)}:${pad(secs)}:${pad(frames)}`;
}

export function formatSecondsShort(seconds: number): string {
  const safe = Math.max(0, isNaN(seconds) ? 0 : seconds);
  const mins = Math.floor(safe / 60);
  const secs = Math.floor(safe % 60);
  const millis = Math.floor((safe % 1) * 10);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(mins)}:${pad(secs)}.${millis}`;
}

export function formatDurationSimple(seconds: number): string {
  const safe = Math.max(0, isNaN(seconds) ? 0 : seconds);
  const mins = Math.floor(safe / 60);
  const secs = Math.floor(safe % 60);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(mins)}:${pad(secs)}`;
}

export function parseTimecodeToSeconds(timecode: string, fps = 30): number {
  if (!timecode) return 0;
  const parts = timecode.split(':').map(p => parseInt(p, 10));
  if (parts.some(isNaN)) return 0;

  if (parts.length === 4) {
    // HH:MM:SS:FF
    const [h, m, s, f] = parts;
    return h * 3600 + m * 60 + s + f / fps;
  }
  if (parts.length === 3) {
    // MM:SS:FF
    const [m, s, f] = parts;
    return m * 60 + s + f / fps;
  }
  if (parts.length === 2) {
    // MM:SS
    const [m, s] = parts;
    return m * 60 + s;
  }
  return 0;
}
