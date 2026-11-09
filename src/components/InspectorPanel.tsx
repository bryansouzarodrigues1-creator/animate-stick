import React from 'react';
import { 
  Trash2, 
  Copy, 
  Scissors, 
  Sliders, 
  Sparkles, 
  Volume2, 
  Type, 
  Layers, 
  Gauge,
  Eye,
  Info
} from 'lucide-react';
import { Clip, FilterPreset, ProjectState } from '../types/editor';
import { formatTimecode, formatDurationSimple } from '../utils/timecode';
import { audioEngine } from '../utils/audioEngine';

interface InspectorPanelProps {
  project: ProjectState;
  selectedClip: Clip | null;
  currentTime: number;
  onUpdateClip: (clipId: string, updates: Partial<Clip>) => void;
  onDeleteClip: (clipId: string) => void;
  onDuplicateClip: (clipId: string) => void;
  onSplitClip: (clipId: string) => void;
}

export const InspectorPanel: React.FC<InspectorPanelProps> = ({
  project,
  selectedClip,
  currentTime,
  onUpdateClip,
  onDeleteClip,
  onDuplicateClip,
  onSplitClip,
}) => {
  if (!selectedClip) {
    return (
      <div className="flex flex-col h-full bg-slate-950 p-4 text-slate-300 text-xs overflow-y-auto">
        <div className="flex items-center gap-2 pb-3 mb-4 border-b border-slate-800 text-slate-200 font-semibold text-sm">
          <Info className="w-4 h-4 text-sky-400" />
          <span>Propriedades do Projeto</span>
        </div>

        <div className="space-y-4">
          <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-800 space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-400">Título:</span>
              <span className="font-medium text-white">{project.title}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Formato:</span>
              <span className="font-medium text-sky-400">{project.aspectRatio}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Taxa de Quadros:</span>
              <span className="font-mono-time">{project.fps} FPS</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Duração Total:</span>
              <span className="font-mono-time">{formatDurationSimple(project.duration)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Total de Trilhas:</span>
              <span>{project.tracks.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Total de Clipes:</span>
              <span>{project.clips.length}</span>
            </div>
          </div>

          <div className="p-3 bg-slate-900/40 rounded-lg border border-slate-800/80 space-y-2.5">
            <span className="text-slate-400 font-semibold text-[11px] uppercase tracking-wider block">
              Atalhos Rápidos
            </span>
            <div className="space-y-1.5 text-slate-300">
              <div className="flex justify-between items-center">
                <span>Play / Pause</span>
                <kbd className="px-1.5 py-0.5 bg-slate-800 rounded font-mono text-[10px] text-sky-300">Espaço</kbd>
              </div>
              <div className="flex justify-between items-center">
                <span>Cortar no Cursor</span>
                <kbd className="px-1.5 py-0.5 bg-slate-800 rounded font-mono text-[10px] text-sky-300">C</kbd>
              </div>
              <div className="flex justify-between items-center">
                <span>Excluir Clipe</span>
                <kbd className="px-1.5 py-0.5 bg-slate-800 rounded font-mono text-[10px] text-sky-300">Del / Backspace</kbd>
              </div>
              <div className="flex justify-between items-center">
                <span>Desfazer / Refazer</span>
                <kbd className="px-1.5 py-0.5 bg-slate-800 rounded font-mono text-[10px] text-sky-300">Ctrl+Z / Ctrl+Y</kbd>
              </div>
            </div>
          </div>

          <p className="text-slate-500 italic text-center pt-2">
            Selecione qualquer clipe na timeline para editar filtros, posição, texto e áudio.
          </p>
        </div>
      </div>
    );
  }

  // Helper updates
  const updateTransform = (changes: Partial<Clip['transform']>) => {
    onUpdateClip(selectedClip.id, {
      transform: { ...selectedClip.transform, ...changes },
    });
  };

  const updateFilters = (changes: Partial<Clip['filters']>) => {
    onUpdateClip(selectedClip.id, {
      filters: { ...selectedClip.filters, ...changes },
    });
  };

  const updateTextProps = (changes: Partial<NonNullable<Clip['textProps']>>) => {
    if (!selectedClip.textProps) return;
    onUpdateClip(selectedClip.id, {
      textProps: { ...selectedClip.textProps, ...changes },
    });
  };

  const presets: { id: FilterPreset; label: string }[] = [
    { id: 'none', label: 'Padrão' },
    { id: 'teal-orange', label: 'Teal & Orange' },
    { id: 'vintage', label: 'Vintage 90s' },
    { id: 'noir', label: 'Film Noir' },
    { id: 'cyberpunk', label: 'Cyberpunk' },
    { id: 'warm-sunset', label: 'Pôr do Sol' },
    { id: 'crisp-clean', label: 'Nítido Pro' },
  ];

  return (
    <div className="flex flex-col h-full bg-slate-950 p-4 text-slate-300 text-xs overflow-y-auto space-y-4">
      {/* Header with Title and Actions */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div>
          <span className="text-[10px] uppercase tracking-wider text-sky-400 font-semibold block">
            {selectedClip.type}
          </span>
          <input
            type="text"
            value={selectedClip.name}
            onChange={(e) => onUpdateClip(selectedClip.id, { name: e.target.value })}
            className="text-sm font-semibold text-white bg-transparent hover:bg-slate-900 focus:bg-slate-900 px-1 py-0.5 rounded outline-none border border-transparent focus:border-indigo-500 truncate max-w-[150px]"
          />
        </div>

        {/* Quick action buttons */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              audioEngine.playSFX('cut');
              onSplitClip(selectedClip.id);
            }}
            title="Dividir Clipe no Cursor (C)"
            aria-label="Dividir Clipe"
            className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <Scissors className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => {
              audioEngine.playSFX('pop');
              onDuplicateClip(selectedClip.id);
            }}
            title="Duplicar Clipe"
            aria-label="Duplicar Clipe"
            className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => {
              audioEngine.playSFX('cut');
              onDeleteClip(selectedClip.id);
            }}
            title="Excluir Clipe (Del)"
            aria-label="Excluir Clipe"
            className="p-1.5 rounded hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* SECTION 1: Transform */}
      <div className="space-y-3 p-3 bg-slate-900/60 rounded-lg border border-slate-800">
        <div className="flex items-center gap-2 text-slate-200 font-semibold text-xs">
          <Sliders className="w-3.5 h-3.5 text-sky-400" />
          <span>Transformação & Posição</span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[11px] text-slate-400 block mb-1">Posição X</label>
            <input
              type="number"
              value={selectedClip.transform.x}
              onChange={(e) => updateTransform({ x: Number(e.target.value) })}
              className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-white font-mono text-xs focus:border-sky-500 outline-none"
            />
          </div>
          <div>
            <label className="text-[11px] text-slate-400 block mb-1">Posição Y</label>
            <input
              type="number"
              value={selectedClip.transform.y}
              onChange={(e) => updateTransform({ y: Number(e.target.value) })}
              className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-white font-mono text-xs focus:border-sky-500 outline-none"
            />
          </div>
        </div>

        <div>
          <div className="flex justify-between text-[11px] text-slate-400 mb-1">
            <span>Escala</span>
            <span className="font-mono text-white">{Math.round((selectedClip.transform.scale || 1) * 100)}%</span>
          </div>
          <input
            type="range"
            min="0.2"
            max="3"
            step="0.05"
            value={selectedClip.transform.scale || 1}
            onChange={(e) => updateTransform({ scale: parseFloat(e.target.value) })}
            className="w-full accent-sky-500"
          />
        </div>

        <div>
          <div className="flex justify-between text-[11px] text-slate-400 mb-1">
            <span>Opacidade</span>
            <span className="font-mono text-white">{Math.round((selectedClip.transform.opacity ?? 1) * 100)}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={selectedClip.transform.opacity ?? 1}
            onChange={(e) => updateTransform({ opacity: parseFloat(e.target.value) })}
            className="w-full accent-sky-500"
          />
        </div>

        <div>
          <div className="flex justify-between text-[11px] text-slate-400 mb-1">
            <span>Rotação</span>
            <span className="font-mono text-white">{selectedClip.transform.rotation || 0}°</span>
          </div>
          <input
            type="range"
            min="-180"
            max="180"
            step="1"
            value={selectedClip.transform.rotation || 0}
            onChange={(e) => updateTransform({ rotation: parseInt(e.target.value, 10) })}
            className="w-full accent-sky-500"
          />
        </div>
      </div>

      {/* SECTION 2: Text Customization (if Text Clip) */}
      {selectedClip.type === 'text' && selectedClip.textProps && (
        <div className="space-y-3 p-3 bg-slate-900/60 rounded-lg border border-indigo-900/40">
          <div className="flex items-center gap-2 text-indigo-300 font-semibold text-xs">
            <Type className="w-3.5 h-3.5 text-indigo-400" />
            <span>Conteúdo & Estilo do Texto</span>
          </div>

          <div>
            <label className="text-[11px] text-slate-400 block mb-1">Texto</label>
            <textarea
              rows={2}
              value={selectedClip.textProps.text}
              onChange={(e) => updateTextProps({ text: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white text-xs focus:border-indigo-500 outline-none resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">Tamanho ({selectedClip.textProps.fontSize}px)</label>
              <input
                type="range"
                min="14"
                max="96"
                value={selectedClip.textProps.fontSize}
                onChange={(e) => updateTextProps({ fontSize: parseInt(e.target.value, 10) })}
                className="w-full accent-indigo-500"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">Cor do Texto</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={selectedClip.textProps.color}
                  onChange={(e) => updateTextProps({ color: e.target.value })}
                  className="w-7 h-7 rounded border border-slate-700 bg-transparent cursor-pointer"
                />
                <span className="font-mono text-xs">{selectedClip.textProps.color}</span>
              </div>
            </div>
          </div>

          <div>
            <label className="text-[11px] text-slate-400 block mb-1">Animação</label>
            <select
              value={selectedClip.textProps.animation}
              onChange={(e) => updateTextProps({ animation: e.target.value as any })}
              className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-white text-xs outline-none focus:border-indigo-500"
            >
              <option value="none">Estático</option>
              <option value="typewriter">Máquina de Escrever</option>
              <option value="zoom">Zoom In Impacto</option>
              <option value="slide-up">Deslizar para Cima</option>
            </select>
          </div>
        </div>
      )}

      {/* SECTION 3: Color Grading & Cinematic LUTs */}
      <div className="space-y-3 p-3 bg-slate-900/60 rounded-lg border border-slate-800">
        <div className="flex items-center gap-2 text-slate-200 font-semibold text-xs">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span>Color Grading & LUTs</span>
        </div>

        {/* Quick Presets */}
        <div>
          <label className="text-[11px] text-slate-400 block mb-1.5">Preset Cinematográfico</label>
          <div className="grid grid-cols-2 gap-1.5">
            {presets.map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  audioEngine.playSFX('click');
                  updateFilters({ preset: p.id });
                }}
                className={`px-2 py-1 rounded text-[11px] text-left truncate transition-colors ${
                  selectedClip.filters.preset === p.id
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50 font-medium'
                    : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Sliders */}
        <div className="space-y-2 pt-1 border-t border-slate-800/60">
          <div>
            <div className="flex justify-between text-[11px] text-slate-400 mb-1">
              <span>Brilho</span>
              <span className="font-mono text-white">{selectedClip.filters.brightness}%</span>
            </div>
            <input
              type="range"
              min="20"
              max="180"
              value={selectedClip.filters.brightness}
              onChange={(e) => updateFilters({ brightness: parseInt(e.target.value, 10) })}
              className="w-full accent-amber-500"
            />
          </div>

          <div>
            <div className="flex justify-between text-[11px] text-slate-400 mb-1">
              <span>Contraste</span>
              <span className="font-mono text-white">{selectedClip.filters.contrast}%</span>
            </div>
            <input
              type="range"
              min="40"
              max="200"
              value={selectedClip.filters.contrast}
              onChange={(e) => updateFilters({ contrast: parseInt(e.target.value, 10) })}
              className="w-full accent-amber-500"
            />
          </div>

          <div>
            <div className="flex justify-between text-[11px] text-slate-400 mb-1">
              <span>Saturação</span>
              <span className="font-mono text-white">{selectedClip.filters.saturation}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="250"
              value={selectedClip.filters.saturation}
              onChange={(e) => updateFilters({ saturation: parseInt(e.target.value, 10) })}
              className="w-full accent-amber-500"
            />
          </div>

          <div>
            <div className="flex justify-between text-[11px] text-slate-400 mb-1">
              <span>Vinheta</span>
              <span className="font-mono text-white">{Math.round(selectedClip.filters.vignette * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="0.8"
              step="0.05"
              value={selectedClip.filters.vignette}
              onChange={(e) => updateFilters({ vignette: parseFloat(e.target.value) })}
              className="w-full accent-amber-500"
            />
          </div>
        </div>
      </div>

      {/* SECTION 4: Audio & Speed */}
      <div className="space-y-3 p-3 bg-slate-900/60 rounded-lg border border-slate-800">
        <div className="flex items-center gap-2 text-slate-200 font-semibold text-xs">
          <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
          <span>Áudio & Velocidade</span>
        </div>

        <div>
          <div className="flex justify-between text-[11px] text-slate-400 mb-1">
            <span>Volume</span>
            <span className="font-mono text-white">{Math.round(selectedClip.volume * 100)}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="2"
            step="0.05"
            value={selectedClip.volume}
            onChange={(e) => onUpdateClip(selectedClip.id, { volume: parseFloat(e.target.value) })}
            className="w-full accent-emerald-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[11px] text-slate-400 block mb-1">Fade In (s)</label>
            <input
              type="number"
              step="0.1"
              min="0"
              max="5"
              value={selectedClip.fadeIn}
              onChange={(e) => onUpdateClip(selectedClip.id, { fadeIn: parseFloat(e.target.value) || 0 })}
              className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-white font-mono text-xs focus:border-emerald-500 outline-none"
            />
          </div>
          <div>
            <label className="text-[11px] text-slate-400 block mb-1">Fade Out (s)</label>
            <input
              type="number"
              step="0.1"
              min="0"
              max="5"
              value={selectedClip.fadeOut}
              onChange={(e) => onUpdateClip(selectedClip.id, { fadeOut: parseFloat(e.target.value) || 0 })}
              className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-white font-mono text-xs focus:border-emerald-500 outline-none"
            />
          </div>
        </div>

        <div>
          <label className="text-[11px] text-slate-400 block mb-1">Velocidade do Clipe</label>
          <div className="flex gap-1">
            {[0.5, 1, 1.5, 2].map((spd) => (
              <button
                key={spd}
                onClick={() => onUpdateClip(selectedClip.id, { speed: spd })}
                className={`flex-1 py-1 rounded text-xs font-mono transition-colors ${
                  selectedClip.speed === spd
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50'
                    : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                {spd}x
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
