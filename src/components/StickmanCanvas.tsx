import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  Download,
  Tv,
  Smartphone,
  Sparkles,
  Sliders,
  CheckCircle,
  Mic,
  Camera,
  Box,
  Subtitles,
} from 'lucide-react';
import { StickmanProject, StickmanScene } from '../types/stickman';
import { renderStickmanFrame } from '../utils/stickmanRenderer';
import { threeStageEngine } from '../utils/threeStageEngine';
import { CinematicShotType, evaluateWorldStageFrame3D } from '../utils/cinematicShotDirector';
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
  onOpenExportModal?: () => void;
  externalCanvasRef?: React.RefObject<HTMLCanvasElement | null>;
}

export const StickmanCanvas: React.FC<StickmanCanvasProps> = ({
  project,
  activeSceneIndex,
  onSelectScene,
  onUpdateAspectRatio,
  onOpenExportModal,
  externalCanvasRef,
}) => {
  const localCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const playerContainerRef = useRef<HTMLDivElement | null>(null);
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
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [renderEngineMode, setRenderEngineMode] = useState<'3d_webgl' | '2d_canvas'>('3d_webgl');
  const [cameraOverride, setCameraOverride] = useState<CinematicShotType | 'auto'>('auto');
  const [showSubtitles, setShowSubtitles] = useState(true);

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
      const { scene, sceneProgress, index } = getSceneAtTimestamp(
        project.scenes,
        currentTimeRef.current
      );

      if (scene) {
        if (renderEngineMode === '3d_webgl') {
          threeStageEngine.renderFrameTo2DCanvas({
            ctx,
            width: canvas.width,
            height: canvas.height,
            scene,
            sceneProgress,
            sceneIndex: index,
            cameraOverride,
            showSubtitles,
            wpm: project.wordsPerMinute || 155,
          });
        } else {
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
      }

      if (isPlaying) {
        localFrameId = requestAnimationFrame(render);
      }
    };

    localFrameId = requestAnimationFrame(render);
    animFrameIdRef.current = localFrameId;

    return () => {
      cancelAnimationFrame(localFrameId);
    };
  }, [
    isPlaying,
    currentTime,
    totalDuration,
    project.scenes,
    project.aspectRatio,
    project.wordsPerMinute,
    isSpeaking,
    volume,
    isMuted,
    syncOffsetMs,
    renderEngineMode,
    cameraOverride,
    showSubtitles,
    onSelectScene,
    triggerSceneNarration,
    stopAllAudio,
    canvasRef,
  ]);

  // Sync ESC key and browser native fullscreen with in-app cinema fullscreen state
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    const handleFsChange = () => {
      if (document.fullscreenElement) {
        setIsFullscreen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('fullscreenchange', handleFsChange);
    };
  }, [isFullscreen]);

  const toggleFullscreen = () => {
    const nextState = !isFullscreen;
    setIsFullscreen(nextState);
    const container = playerContainerRef.current;
    if (nextState) {
      container?.requestFullscreen?.().catch(() => {});
    } else if (document.fullscreenElement) {
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

  const active3DFrame =
    activeScene && renderEngineMode === '3d_webgl'
      ? evaluateWorldStageFrame3D(
          activeScene,
          sceneProgress,
          activeIdx,
          cameraOverride,
          project.wordsPerMinute || 155
        )
      : null;

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    const ms = Math.floor((sec % 1) * 10);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms}`;
  };

  const is916 = project.aspectRatio === '9:16';

  return (
    <div
      ref={playerContainerRef}
      className={
        isFullscreen
          ? 'fixed inset-0 z-50 flex flex-col w-screen h-screen bg-slate-950 overflow-hidden shadow-2xl'
          : 'flex flex-col h-full bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl'
      }
    >
      {/* Top Video Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 bg-slate-900 border-b border-slate-800 text-xs">
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 rounded-full bg-emerald-500" />
          <span className="font-semibold text-slate-200 truncate max-w-[160px] sm:max-w-[220px]">
            {project.title || 'Vídeo Stickman'}
          </span>
          <span className="text-slate-500">•</span>
          <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-medium truncate max-w-[140px]">
            {activeScene?.title || `Cena ${activeIdx + 1}`}
          </span>
        </div>

        {/* Engine Switcher, Aspect Ratio, Fullscreen & Download MP4 */}
        <div className="flex flex-wrap items-center gap-2">
          {/* 3D WebGL vs 2.5D Canvas Engine Switch */}
          <div className="flex items-center bg-slate-950 p-0.5 rounded-lg border border-slate-800">
            <button
              onClick={() => setRenderEngineMode('3d_webgl')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold transition ${
                renderEngineMode === '3d_webgl'
                  ? 'bg-cyan-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Motor 3D Cinematográfico (Three.js WebGL com Multi-Câmera e Física de Impacto)"
            >
              <Box className="w-3.5 h-3.5" />
              <span>Motor 3D WebGL</span>
            </button>
            <button
              onClick={() => setRenderEngineMode('2d_canvas')}
              className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition ${
                renderEngineMode === '2d_canvas'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Motor 2.5D Canvas Clássico"
            >
              <span>2.5D</span>
            </button>
          </div>

          {onOpenExportModal && (
            <button
              onClick={onOpenExportModal}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition active:scale-95"
              title="Renderizar e baixar vídeo em MP4"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Baixar MP4</span>
            </button>
          )}

          <button
            onClick={toggleFullscreen}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition ${
              isFullscreen
                ? 'bg-amber-500/20 border-amber-500/60 text-amber-300'
                : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-100'
            }`}
            title={isFullscreen ? 'Sair da Tela Cheia (ESC)' : 'Expandir para Tela Cheia'}
          >
            {isFullscreen ? (
              <>
                <Minimize2 className="w-3.5 h-3.5 text-amber-400" />
                <span>Sair Tela Cheia</span>
              </>
            ) : (
              <>
                <Maximize2 className="w-3.5 h-3.5 text-cyan-400" />
                <span>Tela Cheia</span>
              </>
            )}
          </button>

          <button
            onClick={() => setShowSyncSettings(!showSyncSettings)}
            className={`hidden xl:flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium border transition ${
              showSyncSettings
                ? 'bg-blue-950/80 border-blue-500 text-blue-300'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
            title="Ajuste fino de sincronização de áudio / vídeo"
          >
            <Sliders className="w-3.5 h-3.5 text-cyan-400" />
            <span>Sincronia</span>
          </button>

          <div className="flex items-center gap-1 bg-slate-950 p-0.5 rounded-lg border border-slate-800">
            <button
              onClick={() => onUpdateAspectRatio('16:9')}
              className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition ${
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
              className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition ${
                is916
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Formato Shorts / TikTok 9:16 (Vertical)"
            >
              <Smartphone className="w-3.5 h-3.5" />
              9:16
            </button>
          </div>
        </div>
      </div>

      {/* Sync Calibrator Bar (if opened) */}
      {showSyncSettings && (
        <div className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-blue-500/30 text-xs">
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

        {/* Floating Speaking Indicator (solid surface, no backdrop-blur or pulse) */}
        {isSpeaking && (
          <div className="absolute top-6 left-6 flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900 border border-emerald-500/50 text-emerald-400 text-xs font-semibold shadow-lg">
            <span className="flex h-2 w-2 rounded-full bg-emerald-400" />
            Locução em tempo real...
          </div>
        )}

        {/* Active Scene Overlay Badge */}
        {activeScene && (
          <div className="absolute top-6 right-6 flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900 border border-slate-700 text-slate-300 text-xs shadow-lg">
            {activeScene.chapter && (
              <span className="text-amber-400 font-bold mr-1 border-r border-slate-700 pr-2">
                {activeScene.chapter}
              </span>
            )}
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>
              {active3DFrame
                ? active3DFrame.shot.shotLabel
                : activeScene.environment.replace(/_/g, ' ').toUpperCase()}
            </span>
          </div>
        )}
      </div>

      {/* Live 3D Camera Shot Director & Choreography Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-1.5 bg-slate-950 border-t border-slate-800 text-[11px] text-slate-400">
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-cyan-400" />
          <span className="text-slate-300 font-semibold">Direção 3D:</span>
          <span className="px-2 py-0.5 rounded bg-blue-950/80 border border-blue-500/40 text-cyan-300 font-medium">
            {active3DFrame
              ? `${active3DFrame.shot.shotLabel} • Fase: ${active3DFrame.heroRig.boardingPhase}`
              : activeBeatState?.beat.label || 'Ação Fluida'}
          </span>

          {renderEngineMode === '3d_webgl' && (
            <div className="flex items-center gap-1.5 ml-1">
              <Camera className="w-3.5 h-3.5 text-amber-400" />
              <select
                aria-label="Plano de Câmera 3D"
                value={cameraOverride}
                onChange={(e) =>
                  setCameraOverride(e.target.value as CinematicShotType | 'auto')
                }
                className="bg-slate-900 border border-slate-700 rounded px-2 py-0.5 text-[11px] text-slate-200 font-medium focus:outline-none focus:border-cyan-500 cursor-pointer"
              >
                <option value="auto">🎥 Cortes Automáticos IA (Multi-Câmera)</option>
                <option value="low_angle_tracking">📐 35mm Tracking Baixo (Roda & Botas)</option>
                <option value="close_up_emotion">🎭 85mm Close-Up Rosto & Atuação</option>
                <option value="over_the_shoulder">🎯 50mm Over-The-Shoulder Tático</option>
                <option value="dutch_impact_blast">💥 24mm Impacto & Explosão (Dutch)</option>
                <option value="tailgate_action_mount">🚛 40mm Embarque na Traseira do Caminhão</option>
                <option value="crane_establishing">🏔️ 28mm Grua Panorâmica 3D</option>
              </select>

              <button
                onClick={() => setShowSubtitles(!showSubtitles)}
                className={`flex items-center gap-1 px-2 py-0.5 rounded border text-[11px] font-medium transition ${
                  showSubtitles
                    ? 'bg-slate-800 border-slate-700 text-slate-200'
                    : 'bg-slate-950 border-slate-800 text-slate-500'
                }`}
                title="Mostrar ou ocultar legendas para avaliar a narrativa visual pura"
              >
                <Subtitles className="w-3 h-3 text-cyan-400" />
                <span>{showSubtitles ? 'Legendas: ON' : 'Sem Legendas'}</span>
              </button>
            </div>
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

        <div className="flex items-center gap-2.5">
          <div className="hidden sm:flex items-center gap-2">
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
              className="w-16 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
          </div>

          {onOpenExportModal && (
            <button
              onClick={onOpenExportModal}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-md shadow-emerald-600/20"
              title="Baixar vídeo em MP4"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Baixar MP4</span>
            </button>
          )}

          <button
            onClick={toggleFullscreen}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold transition"
            title={isFullscreen ? 'Sair da Tela Cheia (ESC)' : 'Tela Cheia'}
          >
            {isFullscreen ? (
              <>
                <Minimize2 className="w-3.5 h-3.5 text-amber-400" />
                <span>Sair Tela Cheia</span>
              </>
            ) : (
              <>
                <Maximize2 className="w-3.5 h-3.5 text-cyan-400" />
                <span>Tela Cheia</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
