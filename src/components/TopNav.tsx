import React from 'react';
import { Undo2, Redo2, Download, Film, Sparkles, FolderOpen, Type, Wand2, Music2, Scissors } from 'lucide-react';
import { formatTimecode } from '../utils/timecode';

interface TopNavProps {
  title: string;
  onTitleChange: (newTitle: string) => void;
  activePanel: 'media' | 'text' | 'filters' | 'ai' | 'audio';
  onSelectPanel: (panel: 'media' | 'text' | 'filters' | 'ai' | 'audio') => void;
  currentTime: number;
  fps: number;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onOpenExport: () => void;
  onOpenScriptToVideo: () => void;
}

export const TopNav: React.FC<TopNavProps> = ({
  title,
  onTitleChange,
  activePanel,
  onSelectPanel,
  currentTime,
  fps,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onOpenExport,
  onOpenScriptToVideo,
}) => {
  return (
    <header className="flex items-center justify-between gap-8 px-5 py-2.5 bg-slate-950 border-b border-slate-800 text-slate-100 select-none z-30 shrink-0">
      {/* Zone 1: Brand wordmark & Project Name */}
      <div className="flex items-center gap-4 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-sky-500 via-indigo-500 to-pink-500 flex items-center justify-center text-white shadow-sm shadow-indigo-500/20">
            <Film className="w-4 h-4" />
          </div>
          <span className="text-base font-bold tracking-tight text-white whitespace-nowrap">
            NovaCut Studio
          </span>
        </div>

        <div className="h-4 w-[1px] bg-slate-800 hidden sm:block" />

        <input
          type="text"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          className="text-xs bg-slate-900/60 hover:bg-slate-900 focus:bg-slate-900 border border-transparent hover:border-slate-800 focus:border-indigo-500 text-slate-300 focus:text-white px-2.5 py-1 rounded-md transition-colors outline-none w-44 truncate hidden sm:block"
          placeholder="Nome do projeto"
          aria-label="Nome do projeto"
        />

        {/* Undo / Redo */}
        <div className="flex items-center gap-1 text-slate-400">
          <button
            onClick={onUndo}
            disabled={!canUndo}
            aria-label="Desfazer ação (Ctrl+Z)"
            title="Desfazer (Ctrl+Z)"
            className="p-1.5 rounded-md hover:bg-slate-800 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            aria-label="Refazer ação (Ctrl+Y)"
            title="Refazer (Ctrl+Y)"
            className="p-1.5 rounded-md hover:bg-slate-800 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
          >
            <Redo2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Zone 2: Navigation Links / Panel Switchers */}
      <nav className="flex items-center gap-1.5 overflow-x-auto text-xs font-medium">
        <button
          onClick={() => onSelectPanel('media')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-md transition-all whitespace-nowrap ${
            activePanel === 'media'
              ? 'bg-slate-800 text-sky-400 shadow-sm border border-slate-700/60'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <FolderOpen className="w-3.5 h-3.5" />
          <span>Mídia</span>
        </button>

        <button
          onClick={() => onSelectPanel('text')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-md transition-all whitespace-nowrap ${
            activePanel === 'text'
              ? 'bg-slate-800 text-sky-400 shadow-sm border border-slate-700/60'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Type className="w-3.5 h-3.5" />
          <span>Títulos & Texto</span>
        </button>

        <button
          onClick={() => onSelectPanel('audio')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-md transition-all whitespace-nowrap ${
            activePanel === 'audio'
              ? 'bg-slate-800 text-sky-400 shadow-sm border border-slate-700/60'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Music2 className="w-3.5 h-3.5" />
          <span>Áudio & SFX</span>
        </button>

        <button
          onClick={() => onSelectPanel('filters')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-md transition-all whitespace-nowrap ${
            activePanel === 'filters'
              ? 'bg-slate-800 text-sky-400 shadow-sm border border-slate-700/60'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Efeitos & LUTs</span>
        </button>

        <button
          onClick={() => onSelectPanel('ai')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-md transition-all whitespace-nowrap ${
            activePanel === 'ai'
              ? 'bg-gradient-to-r from-indigo-500/20 to-purple-500/20 text-indigo-300 border border-indigo-500/40'
              : 'text-indigo-400/80 hover:text-indigo-300 hover:bg-slate-900'
          }`}
        >
          <Wand2 className="w-3.5 h-3.5 text-indigo-400" />
          <span>IA Magic Tools</span>
        </button>
      </nav>

      {/* Zone 3: Timecode and Primary Actions */}
      <div className="flex items-center gap-2.5 shrink-0">
        <div className="px-2.5 py-1 rounded bg-slate-900 border border-slate-800 font-mono-time text-xs font-semibold text-sky-400 hidden md:block">
          {formatTimecode(currentTime, fps)}
        </div>

        <button
          onClick={onOpenScriptToVideo}
          title="Criar Vídeo Profissional a partir de qualquer Roteiro"
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-300 bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/40 rounded-lg transition-all whitespace-nowrap shrink-0 active:scale-95"
        >
          <Wand2 className="w-3.5 h-3.5 text-indigo-400" />
          <span>Criar do Roteiro</span>
        </button>

        <button
          onClick={onOpenExport}
          className="flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold text-white bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 active:scale-95 rounded-lg shadow-sm shadow-indigo-500/20 transition-all whitespace-nowrap shrink-0"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Exportar</span>
        </button>
      </div>
    </header>
  );
};
