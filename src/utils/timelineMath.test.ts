import test from 'node:test';
import assert from 'node:assert/strict';
import { splitClip, snapToPoints, calculateProjectDuration, findClipsAtTime } from './timelineMath';
import { formatTimecode, parseTimecodeToSeconds } from './timecode';
import { Clip } from '../types/editor';

const mockClip: Clip = {
  id: 'clip-1',
  trackId: 'track-v1',
  name: 'Sample Video',
  type: 'video',
  startTime: 2,
  duration: 6,
  trimStart: 0,
  trimEnd: 0,
  sourceDuration: 10,
  sourceUrl: 'blob:video1',
  speed: 1,
  volume: 1,
  fadeIn: 0,
  fadeOut: 0,
  transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
  filters: {
    brightness: 100,
    contrast: 100,
    saturation: 100,
    sepia: 0,
    grayscale: 0,
    blur: 0,
    hueRotate: 0,
    vignette: 0,
    preset: 'none',
  },
};

test('splitClip correctly cuts a clip into two halves', () => {
  const result = splitClip(mockClip, 5); // split at 5s (3s into clip)
  assert.ok(result !== null);
  const [first, second] = result;

  assert.equal(first.startTime, 2);
  assert.equal(first.duration, 3);
  assert.equal(second.startTime, 5);
  assert.equal(second.duration, 3);
  assert.equal(second.trimStart, 3);
});

test('splitClip returns null when cut time is outside clip boundaries', () => {
  assert.equal(splitClip(mockClip, 1), null);
  assert.equal(splitClip(mockClip, 9), null);
  assert.equal(splitClip(mockClip, 2.01), null); // too close to start edge
});

test('snapToPoints snaps to closest marker within threshold', () => {
  const points = [0, 2.0, 5.0, 8.0, 12.0];
  
  const snap1 = snapToPoints(4.9, points, 0.2);
  assert.equal(snap1.didSnap, true);
  assert.equal(snap1.snappedTime, 5.0);

  const snap2 = snapToPoints(4.5, points, 0.2);
  assert.equal(snap2.didSnap, false);
  assert.equal(snap2.snappedTime, 4.5);
});

test('calculateProjectDuration expands to cover clips with padding', () => {
  const clips = [mockClip];
  const dur = calculateProjectDuration(clips, 10, 4);
  // clip ends at 2+6 = 8. 8 + 4 = 12.
  assert.equal(dur, 12);
});

test('findClipsAtTime returns active clips at playhead', () => {
  const clips = [mockClip];
  assert.equal(findClipsAtTime(clips, 1).length, 0);
  assert.equal(findClipsAtTime(clips, 4).length, 1);
  assert.equal(findClipsAtTime(clips, 4)[0].id, 'clip-1');
  assert.equal(findClipsAtTime(clips, 8.1).length, 0);
});

test('timecode formatting and parsing roundtrip', () => {
  const tc = formatTimecode(65.5, 30); // 1 min, 5 sec, 15 frames
  assert.equal(tc, '01:05:15');
  const parsed = parseTimecodeToSeconds(tc, 30);
  assert.equal(parsed, 65.5);
});
