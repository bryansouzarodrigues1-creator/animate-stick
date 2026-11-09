import React, { useRef, useState, useEffect, useCallback } from 'react';
import { 
  Scissors, 
  Trash2, 
  Copy, 
  Eye, 
  EyeOff, 
  Volume2, 
  VolumeX, 
  Lock, 
  Unlock, 
  ZoomIn, 
  ZoomOut, 
  Magnet, 
  MousePointer,
  Plus
} from 'lucide-react';
import { Clip, Track, ProjectState, ActiveTool } from '../types/editor';
import { formatTimecode, formatDurationSimple } from '../utils/timecode';
import { snapToPoints } from '../utils/timelineMath';
import { audioEngine } from '../utils/audioEngine';

interface TimelineProps {
  project: ProjectState;
  currentTime: number;
  selectedClipId: string | null;
  onTimeUpdate: (time: number) => void;
  onSelectClip: (clipId: string | null) => void;
  onUpdateClip: (clipId: string, updates: Partial<Clip>) => void;
  onSplitClip: (clipId: string, splitTime?: number) => void;
  onDeleteClip: (clipId: string) => void;
  onDuplicateClip: (clipId: string) => void;
  onToggleTrackMute: (trackId: string) => void;
  onToggleTrackHide: (trackId: string) => void;
  onToggleTrackLock: (trackId: string) => void;
}

export const Timeline: React.FC<TimelineProps> = ({
  project,
  currentTime,
  selectedClipId,
  onTimeUpdate,
  onSelectClip,
  onUpdateClip,
  onSplitClip,
  onDeleteClip,
  onDuplicateClip,
  onToggleTrackMute,
  onToggleTrackHide,
  onToggleTrackLock,
}) => {
  const [zoom, setZoom] = useState(45); // pixels per second
  const [activeTool, setActiveTool] = useState<ActiveTool>('select');
  const [snappingEnabled, setSnappingEnabled] = useState(true);

  // Dragging state for playhead or clips
  const [isScrubbingRuler, setIsScrubbingRuler] = useState(false);
  const [draggingClip, setDraggingClip] = useState<{
    clipId: string;
    mode: 'move' | 'trim-start' | 'trim-end';
    startX: number;
    initialStartTime: number;
    initialDuration: number;
    initialTrimStart: number;
  } | null>(null);

  const rulerRef = useRef<HTMLDivElement | null>(null);
  const tracksScrollRef = useRef<HTMLDivElement | null>(null);

  // Compute timeline width in pixels
  const timelinePixelWidth = Math.max(1200, project.duration * zoom + 300);

  // All snap points (0, all clip starts, all clip ends, playhead)
  const getSnapPoints = useCallback(
    (excludeClipId?: string) => {
      const points = [0, currentTime];
      project.clips.forEach((c) => {
        if (c.id !== excludeClipId) {
          points.push(c.startTime);
          points.push(c.startTime + c.duration);
        }
      });
      return points;
    },
    [project.clips, currentTime]
  );

  // Convert pixel offset to timeline seconds
  const pixelToTime = (px: number) => Math.max(0, px / zoom);
  const timeToPixel = (sec: number) => sec * zoom;

  // Handle Playhead Scrubbing on Ruler
  const handleRulerMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!rulerRef.current) return;
    const rect = rulerRef.current.getBoundingClientRect();
    const scrollLeft = tracksScrollRef.current ? tracksScrollRef.current.scrollLeft : 0;
    const clickX = e.clientX - rect.left + scrollLeft;
    const newTime = Math.max(0, Math.min(project.duration, pixelToTime(clickX)));
    
    onTimeUpdate(newTime);
    setIsScrubbingRuler(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isScrubbingRuler && rulerRef.current && tracksScrollRef.current) {
        const rect = rulerRef.current.getBoundingClientRect();
        const scrollLeft = tracksScrollRef.current.scrollLeft;
        const clickX = e.clientX - rect.left + scrollLeft;
        const targetTime = pixelToTime(clickX);
        const snapped = snappingEnabled ? snapToPoints(targetTime, getSnapPoints(), 0.15) : { snappedTime: targetTime };
        onTimeUpdate(Math.max(0, Math.min(project.duration, snapped.snappedTime)));
      } else if (draggingClip) {
        const deltaPx = e.clientX - draggingClip.startX;
        const deltaSec = deltaPx / zoom;

        if (draggingClip.mode === 'move') {
          let targetStartTime = Math.max(0, draggingClip.initialStartTime + deltaSec);
          if (snappingEnabled) {
            const snapPoints = getSnapPoints(draggingClip.clipId);
            const snapped = snapToPoints(targetStartTime, snapPoints, 0.15);
            targetStartTime = snapped.snappedTime;
          }
          onUpdateClip(draggingClip.clipId, {
            startTime: Math.round(targetStartTime * 100) / 100,
          });
        } else if (draggingClip.mode === 'trim-start') {
          const maxAllowedStart = draggingClip.initialStartTime + draggingClip.initialDuration - 0.2;
          let newStart = Math.max(0, Math.min(maxAllowedStart, draggingClip.initialStartTime + deltaSec));
          if (snappingEnabled) {
            const snapPoints = getSnapPoints(draggingClip.clipId);
            const snapped = snapToPoints(newStart, snapPoints, 0.15);
            newStart = snapped.snappedTime;
          }
          const changeInStart = newStart - draggingClip.initialStartTime;
          const newDur = Math.max(0.2, draggingClip.initialDuration - changeInStart);
          const newTrim = Math.max(0, draggingClip.initialTrimStart + changeInStart);

          onUpdateClip(draggingClip.clipId, {
            startTime: Math.round(newStart * 100) / 100,
            duration: Math.round(newDur * 100) / 100,
            trimStart: Math.round(newTrim * 100) / 100,
          });
        } else if (draggingClip.mode === 'trim-end') {
          let newDur = Math.max(0.2, draggingClip.initialDuration + deltaSec);
          if (snappingEnabled) {
            const snapTarget = draggingClip.initialStartTime + newDur;
            const snapPoints = getSnapPoints(draggingClip.clipId);
            const snapped = snapToPoints(snapTarget, snapPoints, 0.15);
            newDur = Math.max(0.2, snapped.snappedTime - draggingClip.initialStartTime);
          }
          onUpdateClip(draggingClip.clipId, {
            duration: Math.round(newDur * 100) / 100,
          });
        }
      }
    };

    const handleMouseUp = () => {
      setIsScrubbingRuler(false);
      setDraggingClip(null);
    };

    if (isScrubbingRuler || draggingClip) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isScrubbingRuler, draggingClip, zoom, snappingEnabled, project.duration, getSnapPoints, onTimeUpdate, onUpdateClip]);

  // Handle clicking a clip
  const handleClipClick = (e: React.MouseEvent, clip: Clip) => {
    e.stopPropagation();

    if (activeTool === 'razor') {
      // Split clip directly at click time
      if (!rulerRef.current || !tracksScrollRef.current) return;
      const rect = rulerRef.current.getBoundingClientRect();
      const scrollLeft = tracksScrollRef.current.scrollLeft;
      const clickX = e.clientX - rect.left + scrollLeft;
      const clickTime = pixelToTime(clickX);
      audioEngine.playSFX('cut');
      onSplitClip(clip.id, clickTime);
    } else {
      audioEngine.playSFX('click');
      onSelectClip(clip.id);
    }
  };

  // Generate ruler tick marks
  const renderRulerTicks = () => {
    const ticks = [];
    const interval = zoom > 60 ? 1 : zoom > 30 ? 2 : 5; // seconds
    const totalSeconds = Math.ceil(project.duration + 5);

    for (let sec = 0; sec <= totalSeconds; sec += interval) {
      const left = timeToPixel(sec);
      ticks.push(
        <div
          key={`tick-${sec}`}
          className="absolute top-0 bottom-0 border-l border-slate-700/60 flex flex-col justify-between pl-1"
          style={{ left: `${left}px` }}
        >
          <span className="text-[10px] text-slate-400 font-mono-time select-none">
            {formatTimecode(sec, project.fps)}
          </span>
          <div className="h-1.5 w-[1px] bg-slate-600" />
        </div>
      );
    }
    return ticks;
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 select-none">
      {/* TIMELINE TOOLBAR */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-900/80 border-b border-slate-800 text-xs">
        {/* Left Tools */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setActiveTool('select')}
            title="Ferramenta Seleção (V)"
            aria-label="Ferramenta de Seleção"
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded transition-colors ${
              activeTool === 'select'
                ? 'bg-sky-500 text-white font-medium shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <MousePointer className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Seleção</span>
          </button>

          <button
            onClick={() => setActiveTool('razor')}
            title="Ferramenta Navalha / Cortar (C)"
            aria-label="Ferramenta Navalha de Corte"
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded transition-colors ${
              activeTool === 'razor'
                ? 'bg-rose-500 text-white font-medium shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Scissors className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Navalha</span>
          </button>

          <div className="h-3.5 w-[1px] bg-slate-800 mx-1" />

          {/* Quick Split button at playhead */}
          <button
            onClick={() => {
              if (selectedClipId) {
                audioEngine.playSFX('cut');
                onSplitClip(selectedClipId, currentTime);
              }
            }}
            disabled={!selectedClipId}
            title="Dividir Clipe Selecionado no Cursor"
            aria-label="Dividir Clipe Selecionado"
            className="flex items-center gap-1 px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 disabled:opacity-30 disabled:hover:bg-slate-900 transition-colors"
          >
            <Scissors className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Dividir</span>
          </button>

          {/* Duplicate button */}
          <button
            onClick={() => {
              if (selectedClipId) {
                audioEngine.playSFX('pop');
                onDuplicateClip(selectedClipId);
              }
            }}
            disabled={!selectedClipId}
            title="Duplicar Clipe Selecionado"
            aria-label="Duplicar Clipe"
            className="flex items-center gap-1 px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 disabled:opacity-30 disabled:hover:bg-slate-900 transition-colors"
          >
            <Copy className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Duplicar</span>
          </button>

          {/* Delete button */}
          <button
            onClick={() => {
              if (selectedClipId) {
                audioEngine.playSFX('cut');
                onDeleteClip(selectedClipId);
              }
            }}
            disabled={!selectedClipId}
            title="Excluir Clipe Selecionado (Del)"
            aria-label="Excluir Clipe"
            className="flex items-center gap-1 px-2 py-1 rounded bg-slate-900 hover:bg-rose-500/20 text-slate-300 hover:text-rose-400 disabled:opacity-30 disabled:hover:bg-slate-900 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Excluir</span>
          </button>
        </div>

        {/* Right Tools (Snapping & Zoom) */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSnappingEnabled(!snappingEnabled)}
            title={`Atração Magnética (Snapping): ${snappingEnabled ? 'Ativada' : 'Desativada'}`}
            aria-label="Atração Magnética"
            className={`p-1.5 rounded transition-colors ${
              snappingEnabled ? 'text-sky-400 bg-sky-500/20' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <Magnet className="w-3.5 h-3.5" />
          </button>

          {/* Zoom Controls */}
          <div className="flex items-center gap-1.5 text-slate-400">
            <button
              onClick={() => setZoom(Math.max(15, zoom - 10))}
              aria-label="Diminuir Zoom da Linha do Tempo"
              className="p-1 hover:text-white"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <input
              type="range"
              min="15"
              max="120"
              value={zoom}
              onChange={(e) => setZoom(parseInt(e.target.value, 10))}
              className="w-16 sm:w-24 accent-sky-500 h-1 bg-slate-800 rounded appearance-none"
            />
            <button
              onClick={() => setZoom(Math.min(120, zoom + 10))}
              aria-label="Aumentar Zoom da Linha do Tempo"
              className="p-1 hover:text-white"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* TIMELINE WORKSPACE: TRACK HEADERS + TRACK LANES */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Track Headers (Left Column) */}
        <div className="w-48 sm:w-56 bg-slate-950 border-r border-slate-800 flex flex-col shrink-0 z-20 shadow-md">
          {/* Header empty space matching ruler height */}
          <div className="h-7 border-b border-slate-800 bg-slate-900/60 px-3 flex items-center text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
            Trilhas ({project.tracks.length})
          </div>

          {/* Track Labels */}
          <div className="flex-1 overflow-hidden space-y-1 py-1">
            {project.tracks.map((track) => (
              <div
                key={track.id}
                className="h-14 px-3 flex items-center justify-between bg-slate-900/40 border-y border-slate-800/60 text-xs"
              >
                <div className="flex items-center gap-2 truncate">
                  <span
                    className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${
                      track.type === 'video'
                        ? 'bg-sky-500/20 text-sky-400'
                        : track.type === 'audio'
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : track.type === 'text'
                        ? 'bg-purple-500/20 text-purple-400'
                        : 'bg-amber-500/20 text-amber-400'
                    }`}
                  >
                    {track.type === 'video' ? 'V' : track.type === 'audio' ? 'A' : track.type === 'text' ? 'T' : 'O'}
                  </span>
                  <span className="font-medium text-slate-200 truncate">{track.name}</span>
                </div>

                {/* Track controls */}
                <div className="flex items-center gap-1 text-slate-400">
                  {track.type === 'audio' ? (
                    <button
                      onClick={() => onToggleTrackMute(track.id)}
                      title={track.muted ? 'Desmutar Trilha' : 'Mutar Trilha'}
                      aria-label="Mutar Trilha"
                      className="p-1 hover:text-white rounded"
                    >
                      {track.muted ? <VolumeX className="w-3.5 h-3.5 text-rose-400" /> : <Volume2 className="w-3.5 h-3.5" />}
                    </button>
                  ) : (
                    <button
                      onClick={() => onToggleTrackHide(track.id)}
                      title={track.hidden ? 'Mostrar Trilha' : 'Ocultar Trilha'}
                      aria-label="Ocultar Trilha"
                      className="p-1 hover:text-white rounded"
                    >
                      {track.hidden ? <EyeOff className="w-3.5 h-3.5 text-slate-600" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  )}
                  <button
                    onClick={() => onToggleTrackLock(track.id)}
                    title={track.locked ? 'Destravar Trilha' : 'Travar Trilha'}
                    aria-label="Travar Trilha"
                    className="p-1 hover:text-white rounded"
                  >
                    {track.locked ? <Lock className="w-3.5 h-3.5 text-amber-400" /> : <Unlock className="w-3.5 h-3.5 opacity-40 hover:opacity-100" />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Scrollable Track Content & Ruler (Right Area) */}
        <div
          ref={tracksScrollRef}
          onClick={() => onSelectClip(null)}
          className="flex-1 overflow-x-auto overflow-y-hidden relative bg-[#07090e]"
        >
          <div style={{ width: `${timelinePixelWidth}px` }} className="relative h-full flex flex-col">
            {/* Top Ruler */}
            <div
              ref={rulerRef}
              onMouseDown={handleRulerMouseDown}
              className="h-7 border-b border-slate-800 bg-slate-900/50 relative cursor-pointer select-none"
            >
              {renderRulerTicks()}
            </div>

            {/* Playhead Red Needle across all tracks */}
            <div
              className="absolute top-0 bottom-0 pointer-events-none z-30 transition-none"
              style={{ left: `${timeToPixel(currentTime)}px` }}
            >
              {/* Playhead Head Marker */}
              <div className="w-3.5 h-3.5 bg-rose-500 rounded-b -translate-x-1/2 flex items-center justify-center shadow-md">
                <div className="w-1 h-1.5 bg-white rounded-full" />
              </div>
              {/* Playhead Line */}
              <div className="w-[1.5px] h-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.7)]" />
            </div>

            {/* Tracks Container */}
            <div className="flex-1 space-y-1 py-1">
              {project.tracks.map((track) => {
                const trackClips = project.clips.filter((c) => c.trackId === track.id);

                return (
                  <div
                    key={track.id}
                    className={`h-14 relative border-y border-slate-900 bg-slate-950/40 ${
                      track.locked ? 'opacity-50 pointer-events-none' : ''
                    }`}
                  >
                    {/* Background grid lines aligned to seconds */}
                    <div className="absolute inset-0 pointer-events-none opacity-10 flex">
                      {Array.from({ length: Math.ceil(project.duration) }).map((_, i) => (
                        <div
                          key={i}
                          className="border-r border-slate-700 h-full"
                          style={{ width: `${zoom}px` }}
                        />
                      ))}
                    </div>

                    {/* Clips on this track */}
                    {trackClips.map((clip) => {
                      const leftPx = timeToPixel(clip.startTime);
                      const widthPx = Math.max(16, timeToPixel(clip.duration));
                      const isSelected = clip.id === selectedClipId;

                      return (
                        <div
                          key={clip.id}
                          onClick={(e) => handleClipClick(e, clip)}
                          onMouseDown={(e) => {
                            if (activeTool === 'select' && !track.locked) {
                              onSelectClip(clip.id);
                              setDraggingClip({
                                clipId: clip.id,
                                mode: 'move',
                                startX: e.clientX,
                                initialStartTime: clip.startTime,
                                initialDuration: clip.duration,
                                initialTrimStart: clip.trimStart,
                              });
                            }
                          }}
                          className={`absolute top-1 bottom-1 rounded-md overflow-hidden cursor-grab active:cursor-grabbing border text-xs flex flex-col justify-between p-1.5 transition-shadow ${
                            isSelected
                              ? 'border-sky-400 ring-2 ring-sky-500/50 shadow-lg z-10'
                              : 'border-slate-700/60 hover:border-slate-500'
                          }`}
                          style={{
                            left: `${leftPx}px`,
                            width: `${widthPx}px`,
                            backgroundColor: clip.color || '#1e293b',
                          }}
                        >
                          {/* Left Trim Handle */}
                          <div
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              onSelectClip(clip.id);
                              setDraggingClip({
                                clipId: clip.id,
                                mode: 'trim-start',
                                startX: e.clientX,
                                initialStartTime: clip.startTime,
                                initialDuration: clip.duration,
                                initialTrimStart: clip.trimStart,
                              });
                            }}
                            className="absolute left-0 top-0 bottom-0 w-2 hover:w-3 cursor-ew-resize bg-black/20 hover:bg-sky-400/80 transition-all z-20"
                            title="Ajustar início do clipe"
                          />

                          {/* Right Trim Handle */}
                          <div
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              onSelectClip(clip.id);
                              setDraggingClip({
                                clipId: clip.id,
                                mode: 'trim-end',
                                startX: e.clientX,
                                initialStartTime: clip.startTime,
                                initialDuration: clip.duration,
                                initialTrimStart: clip.trimStart,
                              });
                            }}
                            className="absolute right-0 top-0 bottom-0 w-2 hover:w-3 cursor-ew-resize bg-black/20 hover:bg-sky-400/80 transition-all z-20"
                            title="Ajustar final do clipe"
                          />

                          {/* Clip Header Label */}
                          <div className="flex items-center justify-between text-[11px] font-semibold text-white/90 drop-shadow truncate pointer-events-none px-1">
                            <span className="truncate">{clip.name}</span>
                            <span className="text-[10px] font-mono-time opacity-75 shrink-0 ml-1">
                              {formatDurationSimple(clip.duration)}
                            </span>
                          </div>

                          {/* Audio Waveform visualization bar if audio */}
                          {clip.type === 'audio' && (
                            <div className="h-3 flex items-center gap-[2px] opacity-40 px-1 pointer-events-none">
                              {Array.from({ length: Math.min(24, Math.floor(widthPx / 6)) }).map((_, idx) => (
                                <div
                                  key={idx}
                                  className="w-[2px] bg-white rounded-full"
                                  style={{ height: `${20 + (Math.sin(idx * 0.8) + 1) * 35}%` }}
                                />
                              ))}
                            </div>
                          )}

                          {/* Transition indicator */}
                          {clip.transition && clip.transition.type !== 'none' && (
                            <div className="absolute left-0 bottom-0 top-0 w-4 bg-sky-500/30 border-r border-sky-400/60 pointer-events-none" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
