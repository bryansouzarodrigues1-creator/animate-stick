import React, { useState, useRef } from 'react';
import { X, Upload, Music, Volume2, CheckCircle2, Trash2, Timer, Copy, Check } from 'lucide-react';
import { StickmanScene } from '../types/stickman';
import { calculateElevenLabsTiming } from '../utils/stickmanMath';

interface ElevenLabsAudioModalProps {
  isOpen: boolean;
  scene: StickmanScene | null;
  sceneIndex: number;
  wpm?: number;
  onClose: () => void;
  onSaveAudio: (
    sceneIndex: number,
    audioUrl?: string,
    fileName?: string,
    durationSec?: number
  ) => void;
}

export const ElevenLabsAudioModal: React.FC<ElevenLabsAudioModalProps> = ({
  isOpen,
  scene,
  sceneIndex,
  wpm = 155,
  onClose,
  onSaveAudio,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(
    scene?.customAudioUrl || null
  );
  const [detectedDuration, setDetectedDuration] = useState<number | null>(
    scene?.customAudioDuration || null
  );
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const [copiedMode, setCopiedMode] = useState<'plain' | 'breaks' | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  if (!isOpen || !scene) return null;

  const timing = calculateElevenLabsTiming(scene.narration, wpm);

  const handleCopyText = (mode: 'plain' | 'breaks') => {
    const textToCopy = mode === 'breaks' ? timing.elevenLabsBreakScript : scene.narration;
    navigator.clipboard?.writeText(textToCopy).catch(() => {});
    setCopiedMode(mode);
    setTimeout(() => setCopiedMode(null), 2000);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    const objectUrl = URL.createObjectURL(file);
    setAudioPreviewUrl(objectUrl);

    // Detect audio length
    const tempAudio = new Audio(objectUrl);
    tempAudio.onloadedmetadata = () => {
      const dur = Math.round(tempAudio.duration * 10) / 10;
      setDetectedDuration(dur);
    };
  };

  const handleSave = () => {
    if (audioPreviewUrl) {
      onSaveAudio(
        sceneIndex,
        audioPreviewUrl,
        selectedFile ? selectedFile.name : scene.customAudioFileName || 'Audio-ElevenLabs.mp3',
        detectedDuration || timing.totalDurationSec
      );
    } else {
      // Save calibrated ElevenLabs WPM duration even without file
      onSaveAudio(
        sceneIndex,
        scene.customAudioUrl,
        scene.customAudioFileName,
        timing.totalDurationSec
      );
    }
    onClose();
  };

  const handleRemove = () => {
    setSelectedFile(null);
    setAudioPreviewUrl(null);
    setDetectedDuration(null);
    onSaveAudio(sceneIndex, undefined, undefined, timing.totalDurationSec);
    onClose();
  };

  const togglePreview = () => {
    if (!audioRef.current && audioPreviewUrl) {
      const a = new Audio(audioPreviewUrl);
      a.onended = () => setIsPlayingPreview(false);
      audioRef.current = a;
    }

    if (isPlayingPreview) {
      audioRef.current?.pause();
      setIsPlayingPreview(false);
    } else {
      audioRef.current?.play();
      setIsPlayingPreview(true);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-950 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Volume2 className="w-5 h-5 text-emerald-400" />
            <h3 className="text-base font-bold text-slate-100">
              Voz da Cena & Timer ElevenLabs ({wpm} PPM)
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
          <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400 font-medium">
                Texto da Cena {sceneIndex + 1}:
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleCopyText('plain')}
                  className="flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-200 transition"
                >
                  {copiedMode === 'plain' ? (
                    <Check className="w-3 h-3 text-emerald-400" />
                  ) : (
                    <Copy className="w-3 h-3 text-slate-400" />
                  )}
                  <span>Copiar Texto</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleCopyText('breaks')}
                  className="flex items-center gap-1 px-2 py-1 rounded bg-emerald-950/80 hover:bg-emerald-900/80 border border-emerald-500/40 text-[11px] text-emerald-300 transition"
                  title="Copia com tags <break> de respiração para o ElevenLabs"
                >
                  {copiedMode === 'breaks' ? (
                    <Check className="w-3 h-3 text-emerald-400" />
                  ) : (
                    <Copy className="w-3 h-3 text-emerald-400" />
                  )}
                  <span>Copiar c/ Pausas ElevenLabs</span>
                </button>
              </div>
            </div>
            <p className="text-sm text-slate-200 italic font-serif">
              "{scene.narration}"
            </p>

            {/* ElevenLabs Precision WPM Breakdown */}
            <div className="grid grid-cols-4 gap-2 pt-2 border-t border-slate-800/80 text-center">
              <div className="p-1.5 rounded-lg bg-slate-900/90 border border-slate-800">
                <div className="text-[10px] text-slate-500">Palavras / Sílabas</div>
                <div className="text-xs font-mono font-bold text-slate-200">
                  {timing.wordCount} pal • {timing.syllableCount} síl
                </div>
              </div>
              <div className="p-1.5 rounded-lg bg-slate-900/90 border border-slate-800">
                <div className="text-[10px] text-slate-500">Caracteres</div>
                <div className="text-xs font-mono font-bold text-slate-200">
                  {timing.charCount} chars
                </div>
              </div>
              <div className="p-1.5 rounded-lg bg-slate-900/90 border border-slate-800">
                <div className="text-[10px] text-slate-500">Fala + Pausas</div>
                <div className="text-xs font-mono font-bold text-cyan-300">
                  {timing.spokenDurationSec}s + {timing.punctuationPauseSec}s
                </div>
              </div>
              <div className="p-1.5 rounded-lg bg-emerald-950/50 border border-emerald-500/40">
                <div className="text-[10px] text-emerald-400 font-semibold">Timer ElevenLabs</div>
                <div className="text-xs font-mono font-bold text-emerald-300">
                  {timing.totalDurationSec}s ({wpm} PPM)
                </div>
              </div>
            </div>
          </div>

          {/* ElevenLabs Step by Step Guide */}
          <div className="p-3.5 rounded-xl bg-gradient-to-br from-emerald-950/40 to-slate-900 border border-emerald-500/30">
            <div className="flex items-center gap-2 text-emerald-300 font-semibold text-xs mb-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              Sincronia Perfeita com ElevenLabs ({wpm} Palavras/Minuto):
            </div>
            <ol className="text-xs text-slate-300 space-y-1 list-decimal list-inside leading-relaxed">
              <li>Copie o texto acima (normal ou com pausas <code>&lt;break&gt;</code>) e gere no <strong>ElevenLabs</strong>.</li>
              <li>Mesmo antes de subir o MP3, o timer já crava <strong>{timing.totalDurationSec}s</strong> pela contagem exata de palavras, sílabas e pontuação.</li>
              <li>Quando subir o MP3/WAV abaixo, o player trava no clock exato do arquivo!</li>
            </ol>
          </div>

          {/* Upload Area */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="audio/*"
            className="hidden"
          />

          <div
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center justify-center p-5 border-2 border-dashed border-slate-700 hover:border-emerald-500 bg-slate-950/60 hover:bg-slate-950 rounded-xl cursor-pointer transition text-center group"
          >
            <Upload className="w-7 h-7 text-slate-400 group-hover:text-emerald-400 mb-1.5 transition" />
            <div className="text-sm font-semibold text-slate-200 group-hover:text-emerald-300">
              {selectedFile
                ? selectedFile.name
                : scene.customAudioFileName
                ? scene.customAudioFileName
                : 'Clique para carregar arquivo de áudio do ElevenLabs (.mp3 / .wav)'}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              Ou clique em "Cravar Timer ({timing.totalDurationSec}s)" abaixo para ajustar o tempo sem áudio
            </div>
          </div>

          {/* Audio Preview if loaded */}
          {audioPreviewUrl && (
            <div className="flex items-center justify-between p-3 bg-slate-800 rounded-xl border border-slate-700">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={togglePreview}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 transition shadow"
                >
                  <Music className="w-3.5 h-3.5" />
                  {isPlayingPreview ? 'Pausar' : 'Tocar Prévia'}
                </button>
                {detectedDuration && (
                  <span className="text-xs text-slate-300 font-mono">
                    Duração real MP3: {detectedDuration}s
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={handleRemove}
                className="p-1.5 text-slate-400 hover:text-red-400 transition"
                title="Remover áudio da cena"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-950 border-t border-slate-800">
          <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-mono">
            <Timer className="w-3.5 h-3.5" />
            <span>Tempo ElevenLabs: {detectedDuration || timing.totalDurationSec}s</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200 transition"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition shadow-lg shadow-emerald-600/30"
            >
              {audioPreviewUrl
                ? 'Confirmar Áudio ElevenLabs'
                : `Cravar Timer (${timing.totalDurationSec}s)`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
