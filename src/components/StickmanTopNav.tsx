import React from 'react';
import {
  Download,
  FileCode,
  Flame,
} from 'lucide-react';
import { StickmanProject } from '../types/stickman';

interface StickmanTopNavProps {
  currentPresetKey: string;
  onSelectPreset: (presetKey: string) => void;
  onOpenSyncModal: () => void;
  onOpenExportModal: () => void;
  onOpenCreativeTools: () => void;
  project: StickmanProject;
}

export const StickmanTopNav: React.FC<StickmanTopNavProps> = ({
  currentPresetKey,
  onSelectPreset,
  onOpenSyncModal,
  onOpenExportModal,
  onOpenCreativeTools,
}) => {
  return (
    <header className="flex items-center justify-between px-6 py-3 bg-slate-950 border-b border-slate-800 text-slate-100 select-none">
      {/* Brand */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-500 shadow-lg shadow-blue-500/20 text-white font-black text-lg">
          🏎️
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-bold text-sm tracking-tight text-white">
              StickStory Studio
            </h1>
            <span className="px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-[10px] font-semibold text-blue-400">
              Animações, Veículos & 12 Min
            </span>
          </div>
          <p className="text-[11px] text-slate-400">
            Histórias cinematográficas, carros esportivos, perseguição policial e áudio sincronizado
          </p>
        </div>
      </div>

      {/* Preset Selector */}
      <div className="flex items-center gap-2">
        <label className="text-xs text-slate-400 flex items-center gap-1 font-medium hidden md:flex">
          <Flame className="w-3.5 h-3.5 text-amber-400" />
          Simulações & Histórias:
        </label>
        <select
          value={currentPresetKey}
          onChange={(e) => onSelectPreset(e.target.value)}
          className="bg-slate-900 border border-slate-700 hover:border-slate-600 rounded-xl px-3 py-1.5 text-xs text-slate-200 font-medium focus:outline-none focus:border-blue-500 transition cursor-pointer max-w-[330px] truncate"
        >
          <option value="ww2_brazilian_soldier_feb">🇧🇷 Soldado Brasileiro na 2ª Guerra: Monte Castello (FEB 2.5D)</option>
          <option value="zombie_apocalypse_sim">🧟 Como Seria um Apocalipse Zumbi? (Física & Horda)</option>
          <option value="spend_one_trillion_month">💎 E Se Tivesse 1 Trilhão p/ Gastar em 1 Mês?</option>
          <option value="epic_12min_documentary">👑 Documentário Épico (12 Minutos / 14 Cenas)</option>
          <option value="car_chase_action">🏎️ A Grande Fuga: Perseguição de Carros (Ação)</option>
          <option value="success_journey">🚀 Do Zero à Máquina: História de Conquista</option>
          <option value="heist_adventure">🏦 O Assalto ao Banco Central (Aventura)</option>
          <option value="dojo_battle">⚔️ Duelo Supremo no Dojo (Luta Marcial)</option>
          <option value="custom">✏️ Roteiro Personalizado</option>
        </select>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2.5">
        <button
          onClick={onOpenCreativeTools}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-amber-500/15 to-purple-500/15 hover:from-amber-500/25 hover:to-purple-500/25 border border-amber-500/30 hover:border-amber-500/50 text-xs font-semibold text-amber-300 transition shadow-sm"
          title="Biblioteca de poses, veículos, cenários, filtros, ícones e histórico"
        >
          <span>🎨 Ferramentas & Biblioteca</span>
        </button>

        <button
          onClick={onOpenSyncModal}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-slate-600 text-xs font-semibold text-slate-200 transition"
          title="Copie o roteiro para enviar no chat ou cole um roteiro novo"
        >
          <FileCode className="w-3.5 h-3.5 text-blue-400" />
          <span className="hidden sm:inline">Trocar com Chat</span>
        </button>

        <button
          onClick={onOpenExportModal}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white text-xs font-bold transition shadow-lg shadow-emerald-600/25 active:scale-95"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Baixar MP4</span>
        </button>
      </div>
    </header>
  );
};
