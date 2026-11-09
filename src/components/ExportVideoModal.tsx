import React, { useState } from 'react';
import {
  X,
  Download,
  Video,
  Loader2,
  CheckCircle2,
  Play,
  Sparkles,
} from 'lucide-react';
import { StickmanProject } from '../types/stickman';
import { VideoExportManager } from '../utils/videoRecorder';
import { calculateTotalDuration } from '../utils/stickmanMath';

interface ExportVideoModalProps {
  isOpen: boolean;
  project: StickmanProject;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  onClose: () => void;
}

export const ExportVideoModal: React.FC<ExportVideoModalProps> = ({
  isOpen,
  project,
  canvasRef,
  onClose,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [progress, setProgress] = useState(0);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const totalDuration = calculateTotalDuration(project.scenes);
  const totalDurationMs = Math.round(totalDuration * 1000);

  const handleStartExport = () => {
    const canvas = canvasRef.current;
    if (!canvas) {
      setErrorMessage('Canvas de renderização não encontrado.');
      return;
    }

    setIsRecording(true);
    setProgress(0);
    setDownloadUrl(null);
    setErrorMessage(null);

    const exporter = new VideoExportManager();
    exporter.startRecording({
      canvas,
      durationMs: totalDurationMs,
      onProgress: (pct) => setProgress(pct),
      onComplete: (_blob, url) => {
        setIsRecording(false);
        setProgress(100);
        setDownloadUrl(url);
      },
      onError: (err) => {
        setIsRecording(false);
        setErrorMessage(err.message || 'Erro durante a exportação.');
      },
    });
  };

  const handleDownload = () => {
    if (!downloadUrl) return;
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = `${(project.title || 'video_stickman').toLowerCase().replace(/\s+/g, '_')}.webm`;
    a.click();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-950 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Video className="w-5 h-5 text-blue-400" />
            <h3 className="text-base font-bold text-slate-100">
              Exportar Vídeo Final
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between p-3.5 bg-slate-950 rounded-xl border border-slate-800 text-xs">
            <div>
              <span className="text-slate-400">Resolução & Formato:</span>
              <div className="font-bold text-slate-200 mt-0.5">
                {project.aspectRatio === '9:16' ? '1080x1920 (Vertical Shorts/TikTok)' : '1920x1080 (Full HD YouTube)'}
              </div>
            </div>
            <div className="text-right">
              <span className="text-slate-400">Duração Total:</span>
              <div className="font-bold text-emerald-400 mt-0.5 font-mono">
                {totalDuration.toFixed(1)} segundos
              </div>
            </div>
          </div>

          {/* Recording in progress */}
          {isRecording && (
            <div className="space-y-3 p-4 bg-slate-950 rounded-xl border border-blue-500/40">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2 text-blue-400 font-semibold">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Renderizando animação em tempo real...
                </span>
                <span className="font-mono font-bold text-slate-200">
                  {progress}%
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-emerald-400 transition-all duration-150"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-[11px] text-slate-400 text-center">
                Gravando canvas a 60 FPS com mixagem de áudio sincronizada...
              </p>
            </div>
          )}

          {/* Video Completed Preview */}
          {downloadUrl && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold">
                <CheckCircle2 className="w-4 h-4" />
                Vídeo renderizado com sucesso!
              </div>

              <div className="rounded-xl overflow-hidden bg-black border border-slate-700 shadow-md">
                <video
                  src={downloadUrl}
                  controls
                  autoPlay
                  className="w-full max-h-56 object-contain"
                />
              </div>
            </div>
          )}

          {errorMessage && (
            <div className="p-3 rounded-lg bg-red-950/50 border border-red-500/40 text-red-300 text-xs">
              {errorMessage}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 bg-slate-950 border-t border-slate-800">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200 transition"
          >
            Fechar
          </button>

          {!downloadUrl ? (
            <button
              onClick={handleStartExport}
              disabled={isRecording}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold transition flex items-center gap-2 shadow-lg shadow-blue-600/30"
            >
              {isRecording ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Renderizando...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  Iniciar Renderização do Vídeo
                </>
              )}
            </button>
          ) : (
            <button
              onClick={handleDownload}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center gap-2 shadow-lg shadow-emerald-600/30"
            >
              <Download className="w-4 h-4" />
              Baixar Arquivo de Vídeo
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
