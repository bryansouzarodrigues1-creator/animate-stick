import React, { useState, useRef } from 'react';
import { X, Download, Film, CheckCircle2, Loader2, Sparkles } from 'lucide-react';
import { ProjectState } from '../types/editor';
import { renderProceduralFrame } from '../utils/proceduralClips';
import { getCssFilterString } from '../utils/timelineMath';
import { audioEngine } from '../utils/audioEngine';

interface ExportModalProps {
  isOpen: boolean;
  project: ProjectState;
  onClose: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  project,
  onClose,
}) => {
  const [resolution, setResolution] = useState<'1080p' | '720p' | '480p'>('720p');
  const [fps, setFps] = useState<30 | 60>(30);
  const [isRendering, setIsRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const cancelRenderRef = useRef(false);

  if (!isOpen) return null;

  const getDimensions = () => {
    const isPortrait = project.aspectRatio === '9:16';
    const isSquare = project.aspectRatio === '1:1';

    if (isPortrait) {
      if (resolution === '1080p') return { w: 1080, h: 1920 };
      if (resolution === '720p') return { w: 720, h: 1280 };
      return { w: 480, h: 854 };
    }
    if (isSquare) {
      if (resolution === '1080p') return { w: 1080, h: 1080 };
      if (resolution === '720p') return { w: 720, h: 720 };
      return { w: 480, h: 480 };
    }
    // 16:9 standard
    if (resolution === '1080p') return { w: 1920, h: 1080 };
    if (resolution === '720p') return { w: 1280, h: 720 };
    return { w: 854, h: 480 };
  };

  const handleStartRender = async () => {
    setIsRendering(true);
    setRenderProgress(0);
    setDownloadUrl(null);
    cancelRenderRef.current = false;
    audioEngine.playSFX('click');

    const { w: exportW, h: exportH } = getDimensions();
    const totalFrames = Math.floor(project.duration * fps);

    // Create offscreen render canvas
    const canvas = document.createElement('canvas');
    canvas.width = exportW;
    canvas.height = exportH;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      setIsRendering(false);
      return;
    }

    // MediaRecorder setup
    const stream = canvas.captureStream(fps);
    let mimeType = 'video/webm;codecs=vp9';
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      mimeType = 'video/webm';
    }

    const recordedChunks: Blob[] = [];
    const mediaRecorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 5000000 });

    mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        recordedChunks.push(e.data);
      }
    };

    mediaRecorder.onstop = () => {
      const blob = new Blob(recordedChunks, { type: mimeType });
      const url = URL.createObjectURL(blob);
      setDownloadUrl(url);
      setIsRendering(false);
      audioEngine.playSFX('success');
    };

    mediaRecorder.start();

    // Render loop
    for (let frame = 0; frame <= totalFrames; frame++) {
      if (cancelRenderRef.current) {
        mediaRecorder.stop();
        setIsRendering(false);
        return;
      }

      const frameTime = frame / fps;

      // Clear frame
      ctx.clearRect(0, 0, exportW, exportH);
      ctx.fillStyle = '#05070a';
      ctx.fillRect(0, 0, exportW, exportH);

      // Compositing active clips
      const activeClips = project.clips.filter((c) => {
        const track = project.tracks.find((t) => t.id === c.trackId);
        if (track?.hidden) return false;
        return frameTime >= c.startTime && frameTime <= c.startTime + c.duration;
      });

      const layerPriority: Record<string, number> = { video: 1, image: 2, sticker: 3, text: 4 };
      activeClips.sort((a, b) => (layerPriority[a.type] || 0) - (layerPriority[b.type] || 0));

      activeClips.forEach((clip) => {
        ctx.save();
        const centerX = exportW / 2 + (clip.transform.x || 0);
        const centerY = exportH / 2 + (clip.transform.y || 0);
        const scale = clip.transform.scale || 1;
        const rot = ((clip.transform.rotation || 0) * Math.PI) / 180;
        const opacity = clip.transform.opacity ?? 1;

        // Fades
        const clipElapsed = frameTime - clip.startTime;
        const clipRemaining = clip.startTime + clip.duration - frameTime;
        let alpha = 1;
        if (clip.fadeIn > 0 && clipElapsed < clip.fadeIn) {
          alpha = clipElapsed / clip.fadeIn;
        } else if (clip.fadeOut > 0 && clipRemaining < clip.fadeOut) {
          alpha = clipRemaining / clip.fadeOut;
        }

        ctx.globalAlpha = Math.max(0, Math.min(1, opacity * alpha));
        ctx.translate(centerX, centerY);
        ctx.rotate(rot);
        ctx.scale(scale, scale);

        ctx.filter = getCssFilterString(clip.filters);

        if (clip.type === 'video' && clip.sourceUrl.startsWith('procedural:')) {
          const procType = clip.sourceUrl.replace('procedural:', '');
          ctx.save();
          ctx.translate(-exportW / 2, -exportH / 2);
          renderProceduralFrame(ctx, procType, frameTime, exportW, exportH);
          ctx.restore();
        } else if (clip.type === 'text' && clip.textProps) {
          const { text, fontSize, color, backgroundColor, align, shadow, bold, animation } = clip.textProps;
          let displayText = text;
          if (animation === 'typewriter') {
            const progress = Math.min(1, clipElapsed / 1.5);
            displayText = text.slice(0, Math.floor(text.length * progress));
          } else if (animation === 'zoom') {
            const zoomProgress = Math.min(1, clipElapsed / 0.5);
            ctx.scale(0.5 + 0.5 * zoomProgress, 0.5 + 0.5 * zoomProgress);
          }

          ctx.font = `${bold ? 'bold' : 'normal'} ${fontSize}px 'Plus Jakarta Sans', sans-serif`;
          ctx.textAlign = align || 'center';
          ctx.textBaseline = 'middle';

          if (shadow) {
            ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
            ctx.shadowBlur = 10;
          }

          ctx.fillStyle = color || '#ffffff';
          ctx.fillText(displayText, 0, 0);
        }

        ctx.restore();
      });

      // Update progress
      setRenderProgress(Math.round((frame / totalFrames) * 100));

      // Yield frame to event loop
      if (frame % 5 === 0) {
        await new Promise((r) => setTimeout(r, 10));
      }
    }

    // Stop recording and finalize blob
    mediaRecorder.stop();
  };

  const handleDownload = () => {
    if (!downloadUrl) return;
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = `${project.title.toLowerCase().replace(/\s+/g, '_')}_render.webm`;
    a.click();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-slate-950 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl p-6 text-slate-100 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center">
              <Film className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Exportar Vídeo</h2>
              <p className="text-slate-400 text-xs">Renderização no navegador de alta fidelidade</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar janela de exportação"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-900 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Configurations */}
        {!isRendering && !downloadUrl && (
          <div className="space-y-4 text-xs">
            {/* Resolution */}
            <div>
              <label className="text-slate-400 font-semibold block mb-2">Resolução</label>
              <div className="grid grid-cols-3 gap-2">
                {(['1080p', '720p', '480p'] as const).map((res) => (
                  <button
                    key={res}
                    onClick={() => setResolution(res)}
                    className={`py-2 px-3 rounded-lg border text-center transition-all ${
                      resolution === res
                        ? 'border-sky-500 bg-sky-500/20 text-sky-300 font-semibold'
                        : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:text-white'
                    }`}
                  >
                    <span className="block font-bold">{res}</span>
                    <span className="text-[10px] opacity-75">
                      {res === '1080p' ? 'Full HD' : res === '720p' ? 'HD (Recomendado)' : 'Padrão'}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Framerate */}
            <div>
              <label className="text-slate-400 font-semibold block mb-2">Taxa de Quadros (FPS)</label>
              <div className="grid grid-cols-2 gap-2">
                {[30, 60].map((rate) => (
                  <button
                    key={rate}
                    onClick={() => setFps(rate as any)}
                    className={`py-2 px-3 rounded-lg border text-center transition-all ${
                      fps === rate
                        ? 'border-sky-500 bg-sky-500/20 text-sky-300 font-semibold'
                        : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:text-white'
                    }`}
                  >
                    <span className="font-bold">{rate} FPS</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Summary details */}
            <div className="p-3 bg-slate-900/40 rounded-lg border border-slate-800 space-y-1.5 text-slate-400">
              <div className="flex justify-between">
                <span>Duração do Vídeo:</span>
                <span className="font-mono-time text-white">{Math.round(project.duration)}s</span>
              </div>
              <div className="flex justify-between">
                <span>Formato de Proporção:</span>
                <span className="text-sky-400">{project.aspectRatio}</span>
              </div>
              <div className="flex justify-between">
                <span>Total de Trilhas e Clipes:</span>
                <span className="text-white">{project.clips.length} clipes</span>
              </div>
            </div>
          </div>
        )}

        {/* Rendering in progress */}
        {isRendering && (
          <div className="py-6 space-y-4 text-center">
            <Loader2 className="w-10 h-10 text-sky-400 animate-spin mx-auto" />
            <div>
              <span className="text-sm font-bold text-white block">Renderizando vídeo...</span>
              <p className="text-xs text-slate-400 mt-1">Compondo frames, textos e filtros em tempo real</p>
            </div>

            <div className="w-full bg-slate-900 h-2.5 rounded-full overflow-hidden border border-slate-800">
              <div
                className="h-full bg-gradient-to-r from-sky-500 to-indigo-500 transition-all duration-150"
                style={{ width: `${renderProgress}%` }}
              />
            </div>
            <span className="font-mono-time text-sm font-semibold text-sky-400">{renderProgress}%</span>
          </div>
        )}

        {/* Render Finished / Ready to Download */}
        {downloadUrl && (
          <div className="py-6 space-y-4 text-center">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
            <div>
              <span className="text-base font-bold text-white block">Vídeo renderizado com sucesso!</span>
              <p className="text-xs text-slate-400 mt-1">Seu arquivo está pronto para download em alta qualidade.</p>
            </div>

            <button
              onClick={handleDownload}
              className="w-full py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 transition-all"
            >
              <Download className="w-4 h-4" />
              <span>Baixar Arquivo de Vídeo</span>
            </button>
          </div>
        )}

        {/* Footer Actions */}
        {!downloadUrl && (
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              onClick={() => {
                cancelRenderRef.current = true;
                onClose();
              }}
              className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white rounded-lg transition-colors"
            >
              Cancelar
            </button>

            {!isRendering && (
              <button
                onClick={handleStartRender}
                className="px-5 py-2 text-xs font-bold text-white bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 rounded-lg shadow-sm shadow-indigo-500/20 flex items-center gap-2 transition-all"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Iniciar Renderização</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
