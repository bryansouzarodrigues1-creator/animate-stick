import { StickmanProject, StickmanScene } from '../types/stickman';
import { getAudioDestinationStream, playSoundEffect } from './sfxAudio';
import { calculateTotalDuration, getSceneAtTimestamp } from './stickmanMath';
import { threeStageEngine } from './threeStageEngine';

export interface RecorderOptions {
  canvas: HTMLCanvasElement;
  project?: StickmanProject;
  targetScene?: StickmanScene;
  durationMs: number;
  onProgress?: (percent: number, activeSceneTitle?: string) => void;
  onComplete: (blob: Blob, url: string, mimeType: string) => void;
  onError: (error: Error) => void;
}

export function getBestSupportedVideoMimeType(): { mimeType: string; extension: 'mp4' | 'webm' } {
  const mp4Candidates = [
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    'video/mp4;codecs=avc1.42E01E',
    'video/mp4;codecs=avc1',
    'video/mp4;codecs=h264',
    'video/mp4',
  ];

  if (typeof MediaRecorder !== 'undefined') {
    for (const candidate of mp4Candidates) {
      if (MediaRecorder.isTypeSupported(candidate)) {
        return { mimeType: candidate, extension: 'webm' };
      }
    }

    const webmCandidates = [
      'video/webm;codecs=h264',
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm',
    ];
    for (const candidate of webmCandidates) {
      if (MediaRecorder.isTypeSupported(candidate)) {
        return { mimeType: candidate, extension: 'mp4' };
      }
    }
  }

  throw new Error('Este navegador não oferece um formato de gravação de vídeo compatível. Tente Chrome ou Edge atualizado.');
}

export class VideoExportManager {
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private animFrameId: number | null = null;
  private progressInterval: number | null = null;

  startRecording({
    canvas,
    project,
    targetScene,
    durationMs,
    onProgress,
    onComplete,
    onError,
  }: RecorderOptions) {
    try {
      this.recordedChunks = [];

      // Create a dedicated render canvas if project or targetScene is passed so export is always animated even if main preview is paused
      const is916 = project?.aspectRatio === '9:16';
      const exportCanvas = project ? document.createElement('canvas') : canvas;
      if (project) {
        exportCanvas.width = is916 ? 720 : 1280;
        exportCanvas.height = is916 ? 1280 : 720;
      }

      const ctx = exportCanvas.getContext('2d');
      const scenesToRender: StickmanScene[] = targetScene
        ? [targetScene]
        : project?.scenes || [];

      const totalSec =
        scenesToRender.length > 0
          ? calculateTotalDuration(scenesToRender)
          : durationMs / 1000;
      const effectiveDurationMs = Math.max(1000, Math.round(totalSec * 1000));

      // Draw initial 3D frame before starting stream capture
      if (ctx && scenesToRender.length > 0 && project) {
        threeStageEngine.renderFrameTo2DCanvas({
          ctx,
          width: exportCanvas.width,
          height: exportCanvas.height,
          scene: scenesToRender[0],
          sceneProgress: 0,
          sceneIndex: 0,
          cameraOverride: 'auto',
          showSubtitles: true,
          wpm: project.wordsPerMinute || 155,
        });
      }

      const canvasStream = exportCanvas.captureStream(60); // 60 FPS capture

      // Combine with audio stream from SFX & voice
      const audioStream = getAudioDestinationStream();
      const combinedTracks = [...canvasStream.getVideoTracks()];

      if (audioStream && audioStream.getAudioTracks().length > 0) {
        combinedTracks.push(...audioStream.getAudioTracks());
      }

      const combinedStream = new MediaStream(combinedTracks);
      const { mimeType } = getBestSupportedVideoMimeType();

      this.mediaRecorder = new MediaRecorder(combinedStream, {
        mimeType,
        videoBitsPerSecond: 8_000_000, // 8 Mbps cinema quality
      });

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          this.recordedChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        this.cleanupLoops();
        const blob = new Blob(this.recordedChunks, { type: mimeType });
        const videoUrl = URL.createObjectURL(blob);
        onComplete(blob, videoUrl, mimeType);
      };

      this.mediaRecorder.onerror = (e) => {
        this.cleanupLoops();
        onError(new Error('Erro durante a gravação MP4: ' + String(e)));
      };

      this.mediaRecorder.start(150);

      const startTime = performance.now();
      let lastRenderedSceneId = '';

      // If project is provided, drive deterministic 60 FPS 3D animation loop across scenes
      if (ctx && scenesToRender.length > 0 && project) {
        const livePreviewCtx = canvas.getContext('2d');

        const renderStep = (now: number) => {
          const elapsedMs = now - startTime;
          const elapsedSec = Math.min(totalSec, elapsedMs / 1000);
          const pct = Math.min(100, Math.round((elapsedMs / effectiveDurationMs) * 100));

          const { scene, sceneProgress, index } = getSceneAtTimestamp(
            scenesToRender,
            elapsedSec
          );

          if (scene) {
            if (scene.id !== lastRenderedSceneId) {
              lastRenderedSceneId = scene.id;
              if (scene.soundEffect && scene.soundEffect !== 'none') {
                playSoundEffect(scene.soundEffect, 0.7);
              }
            }

            threeStageEngine.renderFrameTo2DCanvas({
              ctx,
              width: exportCanvas.width,
              height: exportCanvas.height,
              scene,
              sceneProgress,
              sceneIndex: index,
              cameraOverride: 'auto',
              showSubtitles: true,
              wpm: project.wordsPerMinute || 155,
            });

            // Mirror onto the visible preview canvas so user sees the recording live
            if (livePreviewCtx && canvas !== exportCanvas) {
              livePreviewCtx.drawImage(
                exportCanvas,
                0,
                0,
                canvas.width,
                canvas.height
              );
            }

            onProgress?.(pct, scene.title);
          }

          if (elapsedMs >= effectiveDurationMs) {
            this.stopRecording();
          } else {
            this.animFrameId = requestAnimationFrame(renderStep);
          }
        };

        this.animFrameId = requestAnimationFrame(renderStep);
      } else {
        this.progressInterval = window.setInterval(() => {
          const elapsed = performance.now() - startTime;
          const pct = Math.min(100, Math.round((elapsed / effectiveDurationMs) * 100));
          onProgress?.(pct);

          if (elapsed >= effectiveDurationMs) {
            this.stopRecording();
          }
        }, 100);
      }
    } catch (err) {
      this.cleanupLoops();
      onError(err instanceof Error ? err : new Error(String(err)));
    }
  }

  private cleanupLoops() {
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (this.progressInterval !== null) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }
  }

  stopRecording() {
    this.cleanupLoops();
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
  }
}
