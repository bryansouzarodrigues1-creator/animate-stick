import { getAudioDestinationStream } from './sfxAudio';

export interface RecorderOptions {
  canvas: HTMLCanvasElement;
  durationMs: number;
  onProgress?: (percent: number) => void;
  onComplete: (blob: Blob, url: string) => void;
  onError: (error: Error) => void;
}

export class VideoExportManager {
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private progressInterval: number | null = null;

  startRecording({
    canvas,
    durationMs,
    onProgress,
    onComplete,
    onError,
  }: RecorderOptions) {
    try {
      this.recordedChunks = [];
      const canvasStream = canvas.captureStream(60); // 60 FPS capture

      // Combine with audio stream from SFX & voice
      const audioStream = getAudioDestinationStream();
      const combinedTracks = [...canvasStream.getVideoTracks()];

      if (audioStream && audioStream.getAudioTracks().length > 0) {
        combinedTracks.push(...audioStream.getAudioTracks());
      }

      const combinedStream = new MediaStream(combinedTracks);

      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
        ? 'video/webm;codecs=vp9,opus'
        : MediaRecorder.isTypeSupported('video/webm')
        ? 'video/webm'
        : 'video/mp4';

      this.mediaRecorder = new MediaRecorder(combinedStream, {
        mimeType,
        videoBitsPerSecond: 6_000_000, // 6 Mbps clean high quality
      });

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          this.recordedChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        if (this.progressInterval) {
          clearInterval(this.progressInterval);
          this.progressInterval = null;
        }
        const blob = new Blob(this.recordedChunks, { type: mimeType });
        const videoUrl = URL.createObjectURL(blob);
        onComplete(blob, videoUrl);
      };

      this.mediaRecorder.onerror = (e) => {
        if (this.progressInterval) {
          clearInterval(this.progressInterval);
          this.progressInterval = null;
        }
        onError(new Error('MediaRecorder encountered an error: ' + String(e)));
      };

      this.mediaRecorder.start(200); // 200ms chunk slices

      const startTime = Date.now();
      this.progressInterval = window.setInterval(() => {
        const elapsed = Date.now() - startTime;
        const pct = Math.min(100, Math.round((elapsed / durationMs) * 100));
        onProgress?.(pct);

        if (elapsed >= durationMs) {
          this.stopRecording();
        }
      }, 100);
    } catch (err) {
      onError(err instanceof Error ? err : new Error(String(err)));
    }
  }

  stopRecording() {
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
  }
}
