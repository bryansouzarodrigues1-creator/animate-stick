import React, { useState, useRef } from 'react';
import {
  X,
  Download,
  Video,
  Loader2,
  CheckCircle2,
  Sparkles,
  Square,
  Film,
} from 'lucide-react';
import { StickmanProject } from '../types/stickman';
import { VideoExportManager } from '../utils/videoRecorder';
import { calculateTotalDuration } from '../utils/stickmanMath';

interface ExportVideoModalProps {
  isOpen: boolean;
  project: StickmanProject;
  activeSceneIndex?: number;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  onClose: () => void;
}

export const ExportVideoModal: React.FC<ExportVideoModalProps> = ({
  isOpen,
  project,
  activeSceneIndex = 0,
  canvasRef,
  onClose,
}) => {
  const [exportScope, setExportScope] = useState<'scene' | 'full'>('scene');
  const [isRecording, setIsRecording] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentSceneTitle, setCurrentSceneTitle] = useState<string>('');
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const exporterRef = useRef<VideoExportManager | null>(null);

  if (!isOpen) return null;

  const currentScene = project.scenes[activeSceneIndex] || project.scenes[0];
  const fullDuration = calculateTotalDuration(project.scenes);
  const sceneDuration = currentScene ? Math.max(2, currentScene.duration || 5) : 5;
  const activeDuration = exportScope === 'scene' ? sceneDuration : fullDuration;
  const activeDurationMs = Math.round(activeDuration * 1000);

  const triggerBrowserDownload = (url: string) => {
    const a = document.createElement('a');
    a.href = url;
    const baseName =
      exportScope === 'scene' && currentScene
        ? `${project.title || 'stickstory'}_cena_${activeSceneIndex + 1}`
        : project.title || 'stickstory_completo';
    const cleanSlug = baseName
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
    a.download = `${cleanSlug || 'video_stickman'}.mp4`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

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
    exporterRef.current = exporter;

    exporter.startRecording({
      canvas,
      project,
      targetScene: exportScope === 'scene' ? currentScene : undefined,
      durationMs: activeDurationMs,
      onProgress: (pct, sceneTitle) => {
        setProgress(pct);
        if (sceneTitle) setCurrentSceneTitle(sceneTitle);
      },
      onComplete: (_blob, url) => {
        setIsRecording(false);
        setProgress(100);
        setDownloadUrl(url);
        triggerBrowserDownload(url);
      },
      onError: (err) => {
        setIsRecording(false);
        setErrorMessage(err.message || 'Erro durante a exportação MP4.');
      },
    });
  };

  const handleStopEarly = () => {
    if (exporterRef.current) {
      exporterRef.current.stopRecording();
    }
  };

  const handleDownload = () => {
    if (!downloadUrl) return;
    triggerBrowserDownload(downloadUrl);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-950 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Video className="w-5 h-5 text-emerald-400" />
            <h3 className="text-base font-bold text-slate-100">
              Baixar Vídeo em MP4 (60 FPS)
            </h3>
          </div>
          <button
            onClick={() => {
              if (isRecording) handleStopEarly();
              onClose();
            }}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Scope Selector: Current Scene vs Full Project */}
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              disabled={isRecording}
              onClick={() => {
                setExportScope('scene');
                setDownloadUrl(null);
              }}
              className={`flex flex-col items-start p-3 rounded-xl border text-left transition ${
                exportScope === 'scene'
                  ? 'bg-emerald-950/50 border-emerald-500/70 text-emerald-200 shadow-md'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <span className="text-xs font-bold flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                  Cena Atual (Rápido)
                </span>
                <span className="text-[11px] font-mono font-bold text-emerald-400">
                  {sceneDuration.toFixed(1)}s
                </span>
              </div>
              <span className="text-[11px] text-slate-400 mt-1 line-clamp-1">
                {currentScene?.title || `Cena ${activeSceneIndex + 1}`}
              </span>
            </button>

            <button
              type="button"
              disabled={isRecording}
              onClick={() => {
                setExportScope('full');
                setDownloadUrl(null);
              }}
              className={`flex flex-col items-start p-3 rounded-xl border text-left transition ${
                exportScope === 'full'
                  ? 'bg-blue-950/50 border-blue-500/70 text-blue-200 shadow-md'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <span className="text-xs font-bold flex items-center gap-1.5">
                  <Film className="w-3.5 h-3.5 text-blue-400" />
                  Projeto Completo
                </span>
                <span className="text-[11px] font-mono font-bold text-blue-400">
                  {fullDuration.toFixed(1)}s
                </span>
              </div>
              <span className="text-[11px] text-slate-400 mt-1">
                Todas as {project.scenes.length} cenas em sequência
              </span>
            </button>
          </div>

          <div className="flex items-center justify-between p-3.5 bg-slate-950 rounded-xl border border-slate-800 text-xs">
            <div>
              <span className="text-slate-400">Formato de Saída:</span>
              <div className="font-bold text-slate-200 mt-0.5">
                MP4 ({project.aspectRatio === '9:16' ? '720x1280 Vertical 9:16' : '1280x720 HD Horizontal 16:9'})
              </div>
            </div>
            <div className="text-right">
              <span className="text-slate-400">Duração Selecionada:</span>
              <div className="font-bold text-emerald-400 mt-0.5 font-mono">
                {activeDuration.toFixed(1)} segundos
              </div>
            </div>
          </div>

          {/* Recording in progress */}
          {isRecording && (
            <div className="space-y-3 p-4 bg-slate-950 rounded-xl border border-emerald-500/40">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2 text-emerald-400 font-semibold">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Gravando MP4 ({currentSceneTitle || 'Animação 2.5D'})...
                </span>
                <span className="font-mono font-bold text-slate-200">
                  {progress}%
                </span>
              </div>
              <div className="w-full h-2.5 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-cyan-400 transition-all duration-150"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="flex items-center justify-between pt-1">
                <p className="text-[11px] text-slate-400">
                  O download do arquivo .MP4 iniciará automaticamente ao concluir.
                </p>
                <button
                  onClick={handleStopEarly}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-[11px] font-semibold transition"
                >
                  <Square className="w-3 h-3 fill-current" />
                  Finalizar e Baixar Agora
                </button>
              </div>
            </div>
          )}

          {/* Video Completed Preview */}
          {downloadUrl && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-emerald-400 text-xs font-semibold">
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  Arquivo MP4 pronto e enviado para download!
                </span>
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
            onClick={() => {
              if (isRecording) handleStopEarly();
              onClose();
            }}
            className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200 transition"
          >
            Fechar
          </button>

          {!downloadUrl ? (
            <button
              onClick={handleStartExport}
              disabled={isRecording}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 disabled:opacity-50 text-white text-xs font-bold transition flex items-center gap-2 shadow-lg shadow-emerald-600/30"
            >
              {isRecording ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Gerando MP4 ({progress}%)...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Gerar e Baixar MP4 Agora
                </>
              )}
            </button>
          ) : (
            <button
              onClick={handleDownload}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center gap-2 shadow-lg shadow-emerald-600/30"
            >
              <Download className="w-4 h-4" />
              Baixar MP4 Novamente (.mp4)
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
