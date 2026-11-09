import React, { useRef, useEffect, useState, useCallback } from 'react';
import { 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  RotateCcw, 
  Camera, 
  Maximize2, 
  Repeat, 
  Volume2, 
  VolumeX,
  Smartphone,
  Monitor,
  Square
} from 'lucide-react';
import { Clip, AspectRatio, ProjectState } from '../types/editor';
import { formatTimecode, formatDurationSimple } from '../utils/timecode';
import { renderProceduralFrame } from '../utils/proceduralClips';
import { getCssFilterString } from '../utils/timelineMath';
import { audioEngine } from '../utils/audioEngine';

interface CanvasPreviewProps {
  project: ProjectState;
  currentTime: number;
  isPlaying: boolean;
  selectedClipId: string | null;
  onTimeUpdate: (time: number) => void;
  onTogglePlay: () => void;
  onClipTransformUpdate?: (clipId: string, transform: Partial<Clip['transform']>) => void;
  onAspectRatioChange: (ratio: AspectRatio) => void;
}

export const CanvasPreview: React.FC<CanvasPreviewProps> = ({
  project,
  currentTime,
  isPlaying,
  selectedClipId,
  onTimeUpdate,
  onTogglePlay,
  onClipTransformUpdate,
  onAspectRatioChange,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [vuLevel, setVuLevel] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isLooping, setIsLooping] = useState(false);
  const [isDraggingGizmo, setIsDraggingGizmo] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number; initialClipX: number; initialClipY: number } | null>(null);

  // Aspect ratio resolution dimensions
  const getCanvasDimensions = (ratio: AspectRatio) => {
    switch (ratio) {
      case '9:16':
        return { width: 720, height: 1280, label: '9:16 (Shorts/Reels)' };
      case '1:1':
        return { width: 1080, height: 1080, label: '1:1 (Quadrado)' };
      case '4:5':
        return { width: 864, height: 1080, label: '4:5 (Instagram)' };
      case '16:9':
      default:
        return { width: 1280, height: 720, label: '16:9 (YouTube)' };
    }
  };

  const { width: renderWidth, height: renderHeight } = getCanvasDimensions(project.aspectRatio);

  // VU meter polling loop during playback
  useEffect(() => {
    let animId: number;
    const pollVu = () => {
      if (isPlaying) {
        setVuLevel(audioEngine.getMeterLevel());
      } else {
        setVuLevel(0);
      }
      animId = requestAnimationFrame(pollVu);
    };
    animId = requestAnimationFrame(pollVu);
    return () => cancelAnimationFrame(animId);
  }, [isPlaying]);

  // Main canvas render compositor
  const renderFrame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, renderWidth, renderHeight);
    ctx.fillStyle = '#05070a';
    ctx.fillRect(0, 0, renderWidth, renderHeight);

    // Sort tracks so video is drawn first, then overlay, then text
    const activeClips = project.clips.filter((c) => {
      const track = project.tracks.find((t) => t.id === c.trackId);
      if (track?.hidden) return false;
      return currentTime >= c.startTime && currentTime <= c.startTime + c.duration;
    });

    // Layer order: video -> overlay -> text
    const layerPriority: Record<string, number> = { video: 1, image: 2, sticker: 3, text: 4 };
    activeClips.sort((a, b) => (layerPriority[a.type] || 0) - (layerPriority[b.type] || 0));

    activeClips.forEach((clip) => {
      ctx.save();

      // Transform
      const centerX = renderWidth / 2 + (clip.transform.x || 0);
      const centerY = renderHeight / 2 + (clip.transform.y || 0);
      const scale = clip.transform.scale || 1;
      const rotation = ((clip.transform.rotation || 0) * Math.PI) / 180;
      const opacity = clip.transform.opacity ?? 1;

      // Handle Transitions (Fade in / out, dissolve)
      const clipElapsed = currentTime - clip.startTime;
      const clipRemaining = clip.startTime + clip.duration - currentTime;
      let alphaMultiplier = 1;

      if (clip.fadeIn > 0 && clipElapsed < clip.fadeIn) {
        alphaMultiplier = clipElapsed / clip.fadeIn;
      } else if (clip.fadeOut > 0 && clipRemaining < clip.fadeOut) {
        alphaMultiplier = clipRemaining / clip.fadeOut;
      }

      ctx.globalAlpha = Math.max(0, Math.min(1, opacity * alphaMultiplier));

      ctx.translate(centerX, centerY);
      ctx.rotate(rotation);
      ctx.scale(scale, scale);

      // Apply Filter Matrix
      ctx.filter = getCssFilterString(clip.filters);

      if (clip.type === 'video') {
        if (clip.sourceUrl.startsWith('procedural:')) {
          const procType = clip.sourceUrl.replace('procedural:', '');
          // Render procedural frame into offscreen canvas or directly
          ctx.save();
          ctx.translate(-renderWidth / 2, -renderHeight / 2);
          renderProceduralFrame(ctx, procType, currentTime, renderWidth, renderHeight);
          ctx.restore();
        }
      } else if (clip.type === 'text' && clip.textProps) {
        const { text, fontSize, color, backgroundColor, align, shadow, bold, animation } = clip.textProps;
        
        // Animation effects
        let displayText = text;
        if (animation === 'typewriter') {
          const progress = Math.min(1, Math.max(0.1, clipElapsed / 1.5));
          const charsToShow = Math.max(1, Math.ceil(text.length * progress));
          displayText = text.slice(0, charsToShow);
        } else if (animation === 'zoom') {
          const zoomProgress = Math.min(1, Math.max(0.2, clipElapsed / 0.5));
          const textScale = 0.85 + 0.15 * zoomProgress;
          ctx.scale(textScale, textScale);
        } else if (animation === 'slide-up') {
          const slideProgress = Math.min(1, Math.max(0, clipElapsed / 0.4));
          const offsetY = (1 - slideProgress) * 20;
          ctx.translate(0, offsetY);
        }

        ctx.font = `${bold ? 'bold' : 'normal'} ${fontSize}px 'Plus Jakarta Sans', sans-serif`;
        ctx.textAlign = align || 'center';
        ctx.textBaseline = 'middle';

        // Measure for background box
        const metrics = ctx.measureText(displayText);
        const paddingX = 16;
        const paddingY = 10;
        const boxWidth = metrics.width + paddingX * 2;
        const boxHeight = fontSize + paddingY * 2;

        if (backgroundColor && backgroundColor !== 'transparent') {
          ctx.fillStyle = backgroundColor;
          const boxX = align === 'left' ? -paddingX : align === 'right' ? -boxWidth + paddingX : -boxWidth / 2;
          ctx.fillRect(boxX, -boxHeight / 2, boxWidth, boxHeight);
        }

        if (shadow) {
          ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
          ctx.shadowBlur = 10;
          ctx.shadowOffsetX = 2;
          ctx.shadowOffsetY = 2;
        }

        ctx.fillStyle = color || '#ffffff';
        ctx.fillText(displayText, 0, 0);
      }

      ctx.restore();

      // Vignette effect post-pass
      if (clip.filters.vignette > 0) {
        ctx.save();
        const vigGrad = ctx.createRadialGradient(
          renderWidth / 2,
          renderHeight / 2,
          renderWidth * 0.3,
          renderWidth / 2,
          renderHeight / 2,
          renderWidth * 0.7
        );
        vigGrad.addColorStop(0, 'rgba(0,0,0,0)');
        vigGrad.addColorStop(1, `rgba(0,0,0,${clip.filters.vignette})`);
        ctx.fillStyle = vigGrad;
        ctx.fillRect(0, 0, renderWidth, renderHeight);
        ctx.restore();
      }
    });

    // Draw selection bounding box if selected clip is visible
    if (selectedClipId) {
      const selectedClip = activeClips.find((c) => c.id === selectedClipId);
      if (selectedClip) {
        ctx.save();
        const cx = renderWidth / 2 + (selectedClip.transform.x || 0);
        const cy = renderHeight / 2 + (selectedClip.transform.y || 0);
        const scale = selectedClip.transform.scale || 1;
        const rot = ((selectedClip.transform.rotation || 0) * Math.PI) / 180;

        ctx.translate(cx, cy);
        ctx.rotate(rot);
        ctx.scale(scale, scale);

        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);

        const boxW = selectedClip.type === 'text' ? 400 : renderWidth * 0.8;
        const boxH = selectedClip.type === 'text' ? 120 : renderHeight * 0.8;

        ctx.strokeRect(-boxW / 2, -boxH / 2, boxW, boxH);

        // Handles at corners
        ctx.setLineDash([]);
        ctx.fillStyle = '#ffffff';
        const handles = [
          [-boxW / 2, -boxH / 2],
          [boxW / 2, -boxH / 2],
          [-boxW / 2, boxH / 2],
          [boxW / 2, boxH / 2],
        ];
        handles.forEach(([hx, hy]) => {
          ctx.fillRect(hx - 4, hy - 4, 8, 8);
          ctx.strokeRect(hx - 4, hy - 4, 8, 8);
        });

        ctx.restore();
      }
    }
  }, [project, currentTime, renderWidth, renderHeight, selectedClipId]);

  // Re-render when time or project changes
  useEffect(() => {
    renderFrame();
  }, [renderFrame]);

  // Canvas Mouse Dragging for Gizmo repositioning
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!selectedClipId || !onClipTransformUpdate) return;
    const clip = project.clips.find((c) => c.id === selectedClipId);
    if (!clip) return;

    setIsDraggingGizmo(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      initialClipX: clip.transform.x || 0,
      initialClipY: clip.transform.y || 0,
    };
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDraggingGizmo || !dragStartRef.current || !selectedClipId || !onClipTransformUpdate) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;

    onClipTransformUpdate(selectedClipId, {
      x: Math.round(dragStartRef.current.initialClipX + dx),
      y: Math.round(dragStartRef.current.initialClipY + dy),
    });
  };

  const handleCanvasMouseUp = () => {
    setIsDraggingGizmo(false);
    dragStartRef.current = null;
  };

  // Snapshot frame download
  const handleTakeSnapshot = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    audioEngine.playSFX('click');
    const dataUrl = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `frame_${formatTimecode(currentTime, project.fps).replace(/:/g, '-')}.png`;
    a.click();
  };

  // Step 1 frame
  const handleStep = (frames: number) => {
    const frameDuration = 1 / project.fps;
    const nextTime = Math.max(0, Math.min(project.duration, currentTime + frames * frameDuration));
    onTimeUpdate(nextTime);
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 border-r border-slate-800">
      {/* Top Preview Bar with Aspect Ratio Switcher */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800/80 bg-slate-900/40 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-slate-400 font-medium">Formato:</span>
          <div className="flex items-center gap-1 bg-slate-950 p-0.5 rounded-lg border border-slate-800">
            <button
              onClick={() => onAspectRatioChange('16:9')}
              title="YouTube / Desktop (16:9)"
              aria-label="Formato 16:9"
              className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                project.aspectRatio === '16:9' ? 'bg-sky-500/20 text-sky-400 border border-sky-500/40' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Monitor className="w-3 h-3" />
              <span>16:9</span>
            </button>
            <button
              onClick={() => onAspectRatioChange('9:16')}
              title="TikTok / Reels / Shorts (9:16)"
              aria-label="Formato 9:16"
              className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                project.aspectRatio === '9:16' ? 'bg-sky-500/20 text-sky-400 border border-sky-500/40' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Smartphone className="w-3 h-3" />
              <span>9:16</span>
            </button>
            <button
              onClick={() => onAspectRatioChange('1:1')}
              title="Quadrado Feed (1:1)"
              aria-label="Formato 1:1"
              className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                project.aspectRatio === '1:1' ? 'bg-sky-500/20 text-sky-400 border border-sky-500/40' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Square className="w-3 h-3" />
              <span>1:1</span>
            </button>
          </div>
        </div>

        {/* Action icons right */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleTakeSnapshot}
            title="Capturar Frame (PNG)"
            aria-label="Capturar Frame"
            className="flex items-center gap-1 text-slate-400 hover:text-white px-2 py-1 rounded hover:bg-slate-800 transition-colors"
          >
            <Camera className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Foto</span>
          </button>
        </div>
      </div>

      {/* Main Viewport Stage with Canvas & Audio VU Meter */}
      <div 
        ref={containerRef}
        className="flex-1 flex items-center justify-center p-4 relative overflow-hidden bg-slate-950/80"
      >
        <div className="relative shadow-2xl rounded border border-slate-800 max-h-full max-w-full flex items-center justify-center">
          <canvas
            ref={canvasRef}
            width={renderWidth}
            height={renderHeight}
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            className={`max-h-[46vh] max-w-full object-contain rounded bg-black cursor-${
              selectedClipId ? (isDraggingGizmo ? 'grabbing' : 'grab') : 'default'
            }`}
          />
        </div>

        {/* Live Audio VU Meter on Right Edge */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex flex-col items-center gap-1.5 p-1.5 bg-slate-900/80 backdrop-blur rounded border border-slate-800 shadow-lg">
          <div className="w-2.5 h-24 bg-slate-950 rounded-full overflow-hidden flex flex-col-reverse p-0.5 border border-slate-800">
            <div
              className="w-full rounded-full transition-all duration-75 bg-gradient-to-t from-emerald-500 via-amber-400 to-rose-500"
              style={{ height: `${Math.round(vuLevel * 100)}%` }}
            />
          </div>
          <button
            onClick={() => {
              const nextMute = !isMuted;
              setIsMuted(nextMute);
              audioEngine.setMute(nextMute);
            }}
            aria-label={isMuted ? 'Ativar áudio' : 'Mutar áudio'}
            title={isMuted ? 'Desmutar' : 'Mutar'}
            className="text-slate-400 hover:text-white transition-colors"
          >
            {isMuted ? <VolumeX className="w-3.5 h-3.5 text-rose-400" /> : <Volume2 className="w-3.5 h-3.5 text-slate-300" />}
          </button>
        </div>
      </div>

      {/* Playback Controls Toolbar */}
      <div className="flex items-center justify-between px-5 py-2.5 bg-slate-900/60 border-t border-slate-800 text-slate-200 select-none">
        {/* Time info */}
        <div className="flex items-center gap-2 text-xs font-mono-time">
          <span className="text-sky-400 font-semibold">{formatTimecode(currentTime, project.fps)}</span>
          <span className="text-slate-600">/</span>
          <span className="text-slate-400">{formatDurationSimple(project.duration)}</span>
        </div>

        {/* Transport controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => onTimeUpdate(0)}
            title="Ir para o início (Home)"
            aria-label="Ir para o início"
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors"
          >
            <SkipBack className="w-4 h-4" />
          </button>

          <button
            onClick={() => handleStep(-1)}
            title="Voltar 1 frame (Seta Esquerda)"
            aria-label="Voltar 1 frame"
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors text-xs font-mono"
          >
            -1f
          </button>

          <button
            onClick={onTogglePlay}
            title="Play / Pause (Barra de Espaço)"
            aria-label={isPlaying ? 'Pausar vídeo' : 'Reproduzir vídeo'}
            className="w-9 h-9 rounded-full bg-sky-500 hover:bg-sky-400 text-white flex items-center justify-center shadow-lg shadow-sky-500/25 active:scale-95 transition-all"
          >
            {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
          </button>

          <button
            onClick={() => handleStep(1)}
            title="Avançar 1 frame (Seta Direita)"
            aria-label="Avançar 1 frame"
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors text-xs font-mono"
          >
            +1f
          </button>

          <button
            onClick={() => onTimeUpdate(project.duration)}
            title="Ir para o final (End)"
            aria-label="Ir para o final"
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors"
          >
            <SkipForward className="w-4 h-4" />
          </button>
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsLooping(!isLooping)}
            title={`Repetição: ${isLooping ? 'Ativada' : 'Desativada'}`}
            aria-label="Repetição em Loop"
            className={`p-1.5 rounded transition-colors ${
              isLooping ? 'text-sky-400 bg-sky-500/20' : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Repeat className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
