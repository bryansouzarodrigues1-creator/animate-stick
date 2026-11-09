import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Maximize2,
  Tv,
  Smartphone,
  Sparkles,
  Sliders,
  CheckCircle,
  Mic,
} from 'lucide-react';
import { StickmanProject, StickmanScene } from '../types/stickman';
import { renderStickmanFrame } from '../utils/stickmanRenderer';
import {
  calculateTotalDuration,
  getSceneAtTimestamp,
} from '../utils/stickmanMath';
import { playSoundEffect } from '../utils/sfxAudio';
import { resolveActiveBeatState } from '../utils/choreographyEngine';

interface StickmanCanvasProps {
  project: StickmanProject;
  activeSceneIndex: number;
  onSelectScene: (idx: number) => void;
  onUpdateAspectRatio: (ratio: '16:9' | '9:16') => void;
  externalCanvasRef?: React.RefObject<HTMLCanvasElement | null>;
}

export const StickmanCanvas: React.FC<StickmanCanvasProps> = ({
  project,
  activeSceneIndex,
  onSelectScene,
  onUpdateAspectRatio,
  externalCanvasRef,
}) => {
  const localCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const canvasRef = externalCanvasRef || localCanvasRef;

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [volume, setVolume] = useState(0.85);
  const [isMuted, setIsMuted] = useState(false);
  // Default to false: animation runs silky-smooth at 60 FPS without native audio lag, speech plays ONLY when requested
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(false);
  const [syncOffsetMs, setSyncOffsetMs] = useState(project.audioLatencyOffsetMs || 0);
  const [showSyncSettings, setShowSyncSettings] = useState(false);

  const totalDuration = calculateTotalDuration(project.scenes);
  const animFrameIdRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);
  const lastSceneIdRef = useRef<string | null>(null);
  const isSpeechPendingRef = useRef<boolean>(false);

  // Audio elements
  const currentAudioElementRef = useRef<HTMLAudioElement | null>(null);
  const speechUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Stop all active audio / speech
  const stopAllAudio = useCallback(() => {
    if (currentAudioElementRef.current) {
      currentAudioElementRef.current.pause();
      currentAudioElementRef.current = null;
    }
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
    isSpeechPendingRef.current = false;
  }, []);

  // Play voice narration for current scene:
  // ONLY triggered when custom ElevenLabs audio is present OR when user explicitly toggled voice on or clicked on-demand speak
  const triggerSceneNarration = useCallback(
    (scene: StickmanScene, seekOffsetSeconds: number = 0, forceManual: boolean = false) => {
      stopAllAudio();
      if (isMuted) return;

      // 1. If user uploaded custom ElevenLabs audio file
      if (scene.customAudioUrl) {
        const audio = new Audio(scene.customAudioUrl);
        audio.volume = volume;
        if (seekOffsetSeconds > 0) {
          audio.currentTime = seekOffsetSeconds;
        }
        audio.onplay = () => {
          setIsSpeaking(true);
        };
        audio.onended = () => {
          setIsSpeaking(false);
        };
        audio.onerror = () => {
          setIsSpeaking(false);
        };
        audio.play().catch(() => {});
        currentAudioElementRef.current = audio;
        return;
      }

      // 2. Browser native speech: ONLY run if user explicitly enabled voice or forced manual speak
      if (!isVoiceEnabled && !forceManual) {
        return;
      }

      // High-precision Web Speech API on-demand
      if (scene.narration && window.speechSynthesis) {
        isSpeechPendingRef.current = true;
        const utter = new SpeechSynthesisUtterance(scene.narration);
        utter.lang = 'pt-BR';
        utter.rate = project.voiceSpeed || 1.1;
        utter.pitch = 1.0;
        utter.volume = volume;

        // Try to pick a natural Brazilian Portuguese voice
        const voices = window.speechSynthesis.getVoices();
        const ptVoice =
          voices.find(
            (v) =>
              v.lang.startsWith('pt') &&
              (v.name.includes('Google') ||
                v.name.includes('Natural') ||
                v.name.includes('Luciana') ||
                v.name.includes('Francisca') ||
                v.name.includes('Antonio'))
          ) || voices.find((v) => v.lang.startsWith('pt'));

        if (ptVoice) {
          utter.voice = ptVoice;
        }

        utter.onstart = () => {
          setIsSpeaking(true);
          isSpeechPendingRef.current = false;
        };
        utter.onend = () => {
          setIsSpeaking(false);
          isSpeechPendingRef.current = false;
        };
        utter.onerror = () => {
          setIsSpeaking(false);
          isSpeechPendingRef.current = false;
        };

        speechUtteranceRef.current = utter;
        window.speechSynthesis.speak(utter);
      }
    },
    [isMuted, volume, project.voiceSpeed, isVoiceEnabled, stopAllAudio]
  );

  const currentTimeRef = useRef(0);
  const activeSceneIndexRef = useRef(activeSceneIndex);

  useEffect(() => {
    activeSceneIndexRef.current = activeSceneIndex;
  }, [activeSceneIndex]);

  // Keep currentTimeRef in sync
  useEffect(() => {
    currentTimeRef.current = currentTime;
  }, [currentTime]);

  // Sync playhead when user selects a different scene in director
  const prevActiveSceneIdxRef = useRef(activeSceneIndex);
  useEffect(() => {
    if (prevActiveSceneIdxRef.current !== activeSceneIndex && !isPlaying) {
      prevActiveSceneIdxRef.current = activeSceneIndex;
      let startTime = 0;
      for (let i = 0; i < activeSceneIndex; i++) {
        startTime += Math.max(1, project.scenes[i]?.duration || 4);
      }
      currentTimeRef.current = startTime;
      setCurrentTime(startTime);
    } else {
      prevActiveSceneIdxRef.current = activeSceneIndex;
    }
  }, [activeSceneIndex, isPlaying, project.scenes]);

  // Seek handler
  const handleSeek = (newTime: number) => {
    const clamped = Math.max(0, Math.min(totalDuration, newTime));
    currentTimeRef.current = clamped;
    setCurrentTime(clamped);
    const { index, scene } = getSceneAtTimestamp(project.scenes, clamped);
    if (index !== -1 && index !== activeSceneIndexRef.current) {
      onSelectScene(index);
    }

    if (isPlaying && scene) {
      let sceneStart = 0;
      for (let i = 0; i < index; i++) {
        sceneStart += Math.max(1, project.scenes[i]?.duration || 4);
      }
      const sceneElapsed = Math.max(0, clamped - sceneStart);

      lastSceneIdRef.current = scene.id;
      if (scene.soundEffect !== 'none') {
        playSoundEffect(scene.soundEffect, volume);
      }
      triggerSceneNarration(scene, sceneElapsed);
    } else {
      stopAllAudio();
    }
  };

  // Toggle Play / Pause
  const togglePlay = () => {
    if (isPlaying) {
      setIsPlaying(false);
      stopAllAudio();
      lastTimeRef.current = null;
    } else {
      if (currentTimeRef.current >= totalDuration - 0.1) {
        currentTimeRef.current = 0;
        setCurrentTime(0);
        lastSceneIdRef.current = null;
      }
      setIsPlaying(true);
      lastTimeRef.current = performance.now();

      const { scene, index } = getSceneAtTimestamp(project.scenes, currentTimeRef.current);
      if (scene) {
        let sceneStart = 0;
        for (let i = 0; i < index; i++) {
          sceneStart += Math.max(1, project.scenes[i]?.duration || 4);
        }
        const sceneElapsed = Math.max(0, currentTimeRef.current - sceneStart);

        lastSceneIdRef.current = scene.id;
        if (scene.soundEffect !== 'none' && sceneElapsed < 0.2) {
          playSoundEffect(scene.soundEffect, volume);
        }
        triggerSceneNarration(scene, sceneElapsed);
      }
    }
  };

  // Restart from beginning
  const handleRestart = () => {
    stopAllAudio();
    currentTimeRef.current = 0;
    setCurrentTime(0);
    lastSceneIdRef.current = null;
    if (activeSceneIndexRef.current !== 0) {
      onSelectScene(0);
    }
    if (isPlaying) {
      const firstScene = project.scenes[0];
      if (firstScene) {
        lastSceneIdRef.current = firstScene.id;
        if (firstScene.soundEffect !== 'none') {
          playSoundEffect(firstScene.soundEffect, volume);
        }
        triggerSceneNarration(firstScene, 0);
      }
    }
  };

  // 60 FPS animation loop with Master Audio Clock Sync
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let localFrameId: number;

    const render = (now: number) => {
      if (isPlaying && lastTimeRef.current !== null) {
        const delta = (now - lastTimeRef.current) / 1000;
        lastTimeRef.current = now;

        let nextTime = currentTimeRef.current + delta;

        // If audio element is playing, lock playhead directly to audio currentTime
        if (currentAudioElementRef.current && !currentAudioElementRef.current.paused) {
          const audioTime = currentAudioElementRef.current.currentTime;
          let sceneStart = 0;
          const { index } = getSceneAtTimestamp(project.scenes, currentTimeRef.current);
          for (let i = 0; i < index; i++) {
            sceneStart += Math.max(1, project.scenes[i]?.duration || 4);
          }
          const adjustedTime = sceneStart + audioTime + syncOffsetMs / 1000;
          nextTime = Math.min(totalDuration, Math.max(0, adjustedTime));
        }

        if (nextTime >= totalDuration) {
          currentTimeRef.current = totalDuration;
          setCurrentTime(totalDuration);
          setIsPlaying(false);
          stopAllAudio();
        } else {
          // Check if we entered a new scene - cleanly in animation frame callback
          const { scene, index } = getSceneAtTimestamp(project.scenes, nextTime);
          if (scene && scene.id !== lastSceneIdRef.current) {
            lastSceneIdRef.current = scene.id;
            if (scene.soundEffect !== 'none') {
              playSoundEffect(scene.soundEffect, isMuted ? 0 : volume);
            }
            triggerSceneNarration(scene, 0);
            if (index !== activeSceneIndexRef.current) {
              onSelectScene(index);
            }
          }

          currentTimeRef.current = nextTime;
          setCurrentTime(nextTime);
        }
      }

      // Draw current frame using currentTimeRef.current
      const { scene, sceneProgress } = getSceneAtTimestamp(
        project.scenes,
        currentTimeRef.current
      );

      if (scene) {
        renderStickmanFrame({
          ctx,
          width: canvas.width,
          height: canvas.height,
          scene,
          sceneProgress,
          isSpeaking,
          aspectRatio: project.aspectRatio,
          wpm: project.wordsPerMinute || 155,
        });
      }

      localFrameId = requestAnimationFrame(render);
    };

    localFrameId = requestAnimationFrame(render);
    animFrameIdRef.current = localFrameId;

    return () => {
      cancelAnimationFrame(localFrameId);
    };
  }, [
    isPlaying,
    totalDuration,
    project.scenes,
    project.aspectRatio,
    project.wordsPerMinute,
    isSpeaking,
    volume,
    isMuted,
    syncOffsetMs,
    onSelectScene,
    triggerSceneNarration,
    stopAllAudio,
    canvasRef,
  ]);

  const toggleFullscreen = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!document.fullscreenElement) {
      canvas.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  };

  const { scene: activeScene, sceneProgress, index: activeIdx } = getSceneAtTimestamp(
    project.scenes,
    currentTime
  );

  const activeBeatState = activeScene
    ? resolveActiveBeatState(activeScene, sceneProgress)
    : null;

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    const ms = Math.floor((sec % 1) * 10);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms}`;
  };

  const is916 = project.aspectRatio === '9:16';

  return (
    <div className="flex flex-col h-full bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
      {/* Top Video Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900 border-b border-slate-800 text-xs">
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-semibold text-slate-200">
            {project.title || 'Vídeo Stickman'}
          </span>
          <span className="text-slate-500">•</span>
          <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-medium">
            {activeScene?.title || `Cena ${activeIdx + 1}`}
          </span>
        </div>

        {/* Aspect Ratio & Audio Calibrator */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSyncSettings(!showSyncSettings)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium border transition ${
              showSyncSettings
                ? 'bg-blue-950/80 border-blue-500 text-blue-300'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
            title="Ajuste fino de sincronização de áudio / vídeo"
          >
            <Sliders className="w-3.5 h-3.5 text-cyan-400" />
            <span>Sincronia Áudio</span>
          </button>

          <div className="flex items-center gap-1 bg-slate-950 p-0.5 rounded-lg border border-slate-800">
            <button
              onClick={() => onUpdateAspectRatio('16:9')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition ${
                !is916
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Formato YouTube 16:9 (Horizontal)"
            >
              <Tv className="w-3.5 h-3.5" />
              16:9
            </button>
            <button
              onClick={() => onUpdateAspectRatio('9:16')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition ${
                is916
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Formato Shorts / TikTok 9:16 (Vertical)"
            >
              <Smartphone className="w-3.5 h-3.5" />
              9:16 Shorts
            </button>
          </div>
        </div>
      </div>

      {/* Sync Calibrator Bar (if opened) */}
      {showSyncSettings && (
        <div className="flex items-center justify-between px-4 py-2 bg-slate-900/90 border-b border-blue-500/30 text-xs animate-in slide-in-from-top duration-150">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-400" />
            <span className="text-slate-300">Calibrador de Sincronia:</span>
            <span className="font-mono text-cyan-400 font-bold">
              {syncOffsetMs > 0 ? `+${syncOffsetMs}` : syncOffsetMs} ms
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-[11px] text-slate-500">Áudio adiantado</span>
            <input
              type="range"
              min={-400}
              max={400}
              step={20}
              value={syncOffsetMs}
              onChange={(e) => setSyncOffsetMs(parseInt(e.target.value, 10))}
              className="w-32 h-1.5 bg-slate-800 rounded-lg cursor-pointer accent-blue-500"
            />
            <span className="text-[11px] text-slate-500">Áudio atrasado</span>
            <button
              onClick={() => setSyncOffsetMs(0)}
              className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 hover:bg-slate-700"
            >
              Resetar (0ms)
            </button>
          </div>
        </div>
      )}

      {/* Main Canvas Container */}
      <div className="relative flex-1 bg-black flex items-center justify-center p-3 overflow-hidden select-none">
        <canvas
          ref={canvasRef}
          width={is916 ? 720 : 1280}
          height={is916 ? 1280 : 720}
          className={`max-h-full max-w-full rounded-lg shadow-2xl object-contain bg-slate-900 transition-all ${
            is916 ? 'aspect-[9/16]' : 'aspect-[16/9]'
          }`}
        />

        {/* Floating Speaking Pill */}
        {isSpeaking && (
          <div className="absolute top-6 left-6 flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/90 border border-emerald-500/50 backdrop-blur text-emerald-400 text-xs font-semibold shadow-lg">
            <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
            Locução em tempo real...
          </div>
        )}

        {/* Active Scene Overlay Badge */}
        {activeScene && (
          <div className="absolute top-6 right-6 flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/80 border border-slate-700/60 backdrop-blur text-slate-300 text-xs shadow-lg">
            {activeScene.chapter && (
              <span className="text-amber-400 font-bold mr-1 border-r border-slate-700 pr-2">
                {activeScene.chapter}
              </span>
            )}
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>{activeScene.environment.replace(/_/g, ' ').toUpperCase()}</span>
          </div>
        )}
      </div>

      {/* Live Second-by-Second Choreography Indicator */}
      <div className="flex items-center justify-between px-4 py-1.5 bg-slate-950 border-t border-slate-800 text-[11px] text-slate-400">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          <span className="text-slate-300 font-semibold">Coreografia ao Vivo:</span>
          <span className="px-2 py-0.5 rounded bg-blue-950/80 border border-blue-500/40 text-cyan-300 font-medium">
            {activeBeatState?.beat.label || 'Ação Fluida'}
          </span>
          {activeBeatState && (
            <span className="text-slate-500 text-[10px]">
              (Beat {activeBeatState.beatIndex + 1}/{activeBeatState.totalBeats} • {activeBeatState.maneuver !== 'none' ? `Manobra: ${activeBeatState.maneuver}` : 'Ação Dinâmica'})
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (activeScene) {
                triggerSceneNarration(activeScene, 0, true);
              }
            }}
            className="flex items-center gap-1 px-2.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] transition"
            title="Ouvir locução narrada desta cena sob demanda"
          >
            <Mic className="w-3 h-3 text-cyan-400" />
            <span>Ouvir Cena</span>
          </button>
          <span className="text-slate-600">|</span>
          <span className="text-[10px] text-slate-500">
            {isVoiceEnabled ? '🔊 Locução Ativada' : '⚡ 60 FPS Fluido (Áudio sob Demanda)'}
          </span>
        </div>
      </div>

      {/* Timeline Scrubber Bar */}
      <div className="px-4 pt-2 bg-slate-900 border-t border-slate-800">
        <div className="relative flex items-center h-4 cursor-pointer group">
          <div className="relative w-full h-2 rounded-full bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-600 via-cyan-500 to-emerald-400 transition-all duration-75"
              style={{
                width: `${totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0}%`,
              }}
            />
          </div>

          <input
            type="range"
            min={0}
            max={totalDuration || 1}
            step={0.05}
            value={currentTime}
            onChange={(e) => handleSeek(parseFloat(e.target.value))}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
        </div>
      </div>

      {/* Player Bottom Control Bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-900 text-slate-300">
        <div className="flex items-center gap-3">
          <button
            onClick={togglePlay}
            className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-600 hover:bg-blue-500 text-white font-bold transition shadow-lg shadow-blue-600/30 active:scale-95"
            title={isPlaying ? 'Pausar (Espaço)' : 'Reproduzir (Espaço)'}
          >
            {isPlaying ? (
              <Pause className="w-5 h-5 fill-current" />
            ) : (
              <Play className="w-5 h-5 fill-current ml-0.5" />
            )}
          </button>

          <button
            onClick={handleRestart}
            className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition"
            title="Reiniciar do Início"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-1 font-mono text-xs text-slate-400 ml-1">
            <span className="text-slate-200 font-semibold">
              {formatSeconds(currentTime)}
            </span>
            <span>/</span>
            <span>{formatSeconds(totalDuration)}</span>
          </div>

          {/* On-Demand Voice Mode Toggle Button */}
          <button
            onClick={() => {
              const nextVal = !isVoiceEnabled;
              setIsVoiceEnabled(nextVal);
              if (!nextVal) {
                stopAllAudio();
              } else if (activeScene) {
                triggerSceneNarration(activeScene, 0, true);
              }
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition ml-2 ${
              isVoiceEnabled
                ? 'bg-amber-500/20 border-amber-500/60 text-amber-300 shadow-sm'
                : 'bg-emerald-950/50 border-emerald-500/40 text-emerald-300 hover:bg-emerald-900/40'
            }`}
            title={
              isVoiceEnabled
                ? 'Voz ativada (clique para voltar à animação fluida silenciosa)'
                : 'Modo Animação Fluida Ativo (Sem atrasos de voz - locução gerada apenas quando solicitado)'
            }
          >
            {isVoiceEnabled ? (
              <>
                <Volume2 className="w-3.5 h-3.5 text-amber-400" />
                <span>🔊 Locução: Ativada</span>
              </>
            ) : (
              <>
                <VolumeX className="w-3.5 h-3.5 text-emerald-400" />
                <span>⚡ Animação Fluida (Áudio sob Demanda)</span>
              </>
            )}
          </button>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsMuted(!isMuted)}
              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition"
              title={isMuted ? 'Ativar Áudio' : 'Mutar'}
            >
              {isMuted ? (
                <VolumeX className="w-4 h-4 text-red-400" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={isMuted ? 0 : volume}
              onChange={(e) => {
                setVolume(parseFloat(e.target.value));
                if (isMuted) setIsMuted(false);
              }}
              className="w-20 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
          </div>

          <button
            onClick={toggleFullscreen}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition"
            title="Tela Cheia"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
