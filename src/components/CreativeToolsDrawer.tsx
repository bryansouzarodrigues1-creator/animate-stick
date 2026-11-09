import React, { useState } from 'react';
import {
  X,
  Palette,
  Sparkles,
  Film,
  Bookmark,
  Layers,
  Wand2,
  Clock,
  Car,
  Flame,
  Zap,
  Download,
  Code,
  GitBranch,
  Check,
} from 'lucide-react';
import {
  StickmanAction,
  EnvironmentTheme,
  VisualFilter,
  FloatingVfxIcon,
  StickmanScene,
  SavedProjectSnapshot,
  StickmanProject,
} from '../types/stickman';

interface CreativeToolsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  activeScene: StickmanScene | null;
  activeSceneIndex: number;
  onUpdateScene: (idx: number, updated: Partial<StickmanScene>) => void;
  onSaveSnapshot: () => void;
  savedSnapshots: SavedProjectSnapshot[];
  onRestoreSnapshot: (snapshot: SavedProjectSnapshot) => void;
  onLoad12MinEpic: () => void;
  project?: StickmanProject;
}

const ACTION_CATALOG: { action: StickmanAction; label: string; icon: string; desc: string }[] = [
  { action: 'drive_car', label: 'Carro Esportivo', icon: '🏎️', desc: 'Piloto no cockpit segurando o volante' },
  { action: 'car_chase', label: 'Perseguição & Fuga', icon: '🚨', desc: 'Alta velocidade e vibração intensa' },
  { action: 'car_drift', label: 'Drift na Curva', icon: '💨', desc: 'Deslizando de lado na pista' },
  { action: 'motorcycle', label: 'Motocicleta Ninja', icon: '🏍️', desc: 'Inclinado na moto de alta cilindrada' },
  { action: 'presentation_stage', label: 'Palco & Telão', icon: '🎤', desc: 'Apresentando gráficos para investidores' },
  { action: 'hero_rooftop', label: 'Topo do Prédio', icon: '🌆', desc: 'Vigilante observando a metrópole' },
  { action: 'walk_city', label: 'Caminhar na Cidade', icon: '🏙️', desc: 'Andando com pasta ou café' },
  { action: 'fight_kungfu', label: 'Luta Kung-Fu', icon: '🥋', desc: 'Golpes rápidos de artes marciais' },
  { action: 'sword_duel', label: 'Espadas de Luz', icon: '⚔️', desc: 'Katana de energia com faíscas' },
  { action: 'gun_aim', label: 'Mirando / Disparo', icon: '🎯', desc: 'Postura tática de tiro e recuo' },
  { action: 'work_computer', label: 'Laptop & Código', icon: '💻', desc: 'Digitando freneticamente à noite' },
  { action: 'money_celebrate', label: 'Chuva de Dinheiro', icon: '💰', desc: 'Pulando de comemoração com sacos de dólar' },
  { action: 'panic_freakout', label: 'Pânico / Choque', icon: '😱', desc: 'Mãos na cabeça tremendo' },
  { action: 'thinking', label: 'Pensativo / Eureka', icon: '🤔', desc: 'Mão no queixo analisando' },
  { action: 'running', label: 'Corrida Acelerada', icon: '🏃', desc: 'Sprint em alta velocidade' },
  { action: 'reading_book', label: 'Lendo Livro Secreto', icon: '📖', desc: 'Estudando segredos antigos' },
  { action: 'coffee_sip', label: 'Tomando Café', icon: '☕', desc: 'Relaxando com caneca quente' },
  { action: 'hero_landing', label: 'Aterrissagem Épica', icon: '💥', desc: 'Punho no chão com onda de choque' },
  { action: 'dramatic_fall', label: 'Nocaute / Queda', icon: '😵', desc: 'Caindo de costas derrotado' },
  { action: 'talk_explaining', label: 'Explicando & Falar', icon: '🗣️', desc: 'Gesticulando enquanto narra' },
];

const ENVIRONMENT_CATALOG: { env: EnvironmentTheme; label: string; icon: string }[] = [
  { env: 'highway_sunset', label: 'Rodovia Sunset', icon: '🌅' },
  { env: 'city_downtown', label: 'Metrópole Downtown', icon: '🏙️' },
  { env: 'police_chase_night', label: 'Perseguição Policial', icon: '🚨' },
  { env: 'bank_heist', label: 'Cofre Blindado & Lasers', icon: '🏦' },
  { env: 'luxury_penthouse', label: 'Cobertura de Luxo', icon: '🌆' },
  { env: 'cyber_highway', label: 'Estrada Cyberpunk Tron', icon: '🌐' },
  { env: 'space_station', label: 'Estação Espacial / Terra', icon: '🚀' },
  { env: 'traffic_jam', label: 'Engarrafamento Urbano', icon: '🚗' },
  { env: 'secret_lab', label: 'Laboratório Secreto', icon: '🧪' },
  { env: 'interrogation_room', label: 'Sala de Interrogatório', icon: '💡' },
  { env: 'finance_trading', label: 'Trading & Gráficos', icon: '📊' },
  { env: 'japanese_dojo', label: 'Dojo Marcial sob a Lua', icon: '🥋' },
  { env: 'hacker_den', label: 'Escritório Cyber Hacker', icon: '💻' },
  { env: 'spotlight_dark', label: 'Holofote no Escuro', icon: '🔦' },
  { env: 'street_night', label: 'Noite Urbana & Poste', icon: '🌃' },
  { env: 'money_vault', label: 'Cofre de Ouro', icon: '💰' },
  { env: 'sketch_grid', label: 'Whiteboard Doodle', icon: '📝' },
];

const FILTER_CATALOG: { filter: VisualFilter; label: string; desc: string }[] = [
  { filter: 'none', label: 'Nenhum', desc: 'Imagem original limpa' },
  { filter: 'cinemascope', label: 'Cinema Scope 2.39:1', desc: 'Faixas pretas horizontais de cinema' },
  { filter: 'vignette', label: 'Vinheta Sombria', desc: 'Bordas escurecidas cinematográficas' },
  { filter: 'film_grain', label: 'Grão de Película 35mm', desc: 'Textura vintage orgânica' },
  { filter: 'crt_cyber', label: 'Scanlines CRT / Cyberpunk', desc: 'Linhas de monitor retro tech' },
  { filter: 'money_rain', label: 'Chuva de Notas de Dólar', desc: 'Dinheiro caindo pela tela' },
  { filter: 'fire_sparks', label: 'Faíscas de Combate', desc: 'Brasas e faíscas incandescentes' },
];

const VFX_ICONS: { icon: FloatingVfxIcon; label: string; emoji: string }[] = [
  { icon: 'none', label: 'Nenhum', emoji: '✖️' },
  { icon: 'lightbulb', label: 'Ideia Eureka', emoji: '💡' },
  { icon: 'exclamation', label: 'Alerta !', emoji: '❗' },
  { icon: 'question', label: 'Dúvida ?', emoji: '❓' },
  { icon: 'money_bag', label: 'Saco de Dinheiro', emoji: '💰' },
  { icon: 'fire', label: 'Fogo / Em Chamas', emoji: '🔥' },
  { icon: 'skull', label: 'Perigo / Morte', emoji: '💀' },
  { icon: 'chart_up', label: 'Gráfico Subindo', emoji: '📈' },
  { icon: 'chart_down', label: 'Gráfico Caindo', emoji: '📉' },
  { icon: 'lightning', label: 'Raio / Choque', emoji: '⚡' },
  { icon: 'target', label: 'Alvo / Meta', emoji: '🎯' },
  { icon: 'coffee', label: 'Café Dev', emoji: '☕' },
  { icon: 'heart', label: 'Coração / Paixão', emoji: '❤️' },
];

export const CreativeToolsDrawer: React.FC<CreativeToolsDrawerProps> = ({
  isOpen,
  onClose,
  activeScene,
  activeSceneIndex,
  onUpdateScene,
  onSaveSnapshot,
  savedSnapshots,
  onRestoreSnapshot,
  onLoad12MinEpic,
  project,
}) => {
  const [activeTab, setActiveTab] = React.useState<
    'actions' | 'environments' | 'vfx' | 'filters' | 'history'
  >('actions');
  const [copiedBundle, setCopiedBundle] = useState(false);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-slate-950 border-l border-slate-800 shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 bg-slate-900 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Wand2 className="w-5 h-5 text-amber-400" />
          <h3 className="text-sm font-bold text-slate-100">
            Estúdio Criativo: Ferramentas & Biblioteca
          </h3>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800 bg-slate-900/60 px-3 overflow-x-auto custom-scrollbar text-xs">
        <button
          onClick={() => setActiveTab('actions')}
          className={`py-2.5 px-3 font-semibold border-b-2 whitespace-nowrap transition ${
            activeTab === 'actions'
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          🎭 Poses ({ACTION_CATALOG.length})
        </button>
        <button
          onClick={() => setActiveTab('environments')}
          className={`py-2.5 px-3 font-semibold border-b-2 whitespace-nowrap transition ${
            activeTab === 'environments'
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          🌄 Cenários ({ENVIRONMENT_CATALOG.length})
        </button>
        <button
          onClick={() => setActiveTab('vfx')}
          className={`py-2.5 px-3 font-semibold border-b-2 whitespace-nowrap transition ${
            activeTab === 'vfx'
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          ✨ Ícones VFX
        </button>
        <button
          onClick={() => setActiveTab('filters')}
          className={`py-2.5 px-3 font-semibold border-b-2 whitespace-nowrap transition ${
            activeTab === 'filters'
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          🎬 Filtros
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`py-2.5 px-3 font-semibold border-b-2 whitespace-nowrap transition ${
            activeTab === 'history'
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          📚 Biblioteca
        </button>
      </div>

      {/* Tab Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
        {/* TAB 1: ACTIONS */}
        {activeTab === 'actions' && (
          <div className="space-y-2">
            <p className="text-[11px] text-slate-400 mb-2">
              Clique em qualquer ação para aplicar imediatamente na <strong>Cena {activeSceneIndex + 1}</strong>:
            </p>
            <div className="grid grid-cols-2 gap-2">
              {ACTION_CATALOG.map((item) => {
                const isSelected = activeScene?.character1.action === item.action;
                return (
                  <button
                    key={item.action}
                    onClick={() => {
                      if (activeScene) {
                        onUpdateScene(activeSceneIndex, {
                          character1: {
                            ...activeScene.character1,
                            action: item.action,
                          },
                        });
                      }
                    }}
                    className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between ${
                      isSelected
                        ? 'bg-blue-950/80 border-blue-500 shadow-md ring-1 ring-blue-500'
                        : 'bg-slate-900 border-slate-800 hover:border-slate-700 hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-lg">{item.icon}</span>
                      <span className="font-semibold text-xs text-slate-200 truncate">
                        {item.label}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 leading-tight">
                      {item.desc}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 2: ENVIRONMENTS */}
        {activeTab === 'environments' && (
          <div className="space-y-2">
            <p className="text-[11px] text-slate-400 mb-2">
              Escolha o lugar / cenário de fundo para a <strong>Cena {activeSceneIndex + 1}</strong>:
            </p>
            <div className="grid grid-cols-2 gap-2">
              {ENVIRONMENT_CATALOG.map((item) => {
                const isSelected = activeScene?.environment === item.env;
                return (
                  <button
                    key={item.env}
                    onClick={() => {
                      onUpdateScene(activeSceneIndex, { environment: item.env });
                    }}
                    className={`p-3 rounded-xl border text-left transition flex items-center gap-2 ${
                      isSelected
                        ? 'bg-blue-950/80 border-blue-500 shadow-md ring-1 ring-blue-500'
                        : 'bg-slate-900 border-slate-800 hover:border-slate-700 hover:bg-slate-800/60'
                    }`}
                  >
                    <span className="text-xl">{item.icon}</span>
                    <span className="font-semibold text-xs text-slate-200 leading-tight">
                      {item.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 3: FLOATING VFX ICONS */}
        {activeTab === 'vfx' && (
          <div className="space-y-3">
            <p className="text-[11px] text-slate-400">
              Adicione ícones e reações animadas flutuantes sobre a cabeça do stickman nesta cena:
            </p>
            <div className="grid grid-cols-3 gap-2">
              {VFX_ICONS.map((item) => {
                const isSelected = (activeScene?.floatingIcon || 'none') === item.icon;
                return (
                  <button
                    key={item.icon}
                    onClick={() => {
                      onUpdateScene(activeSceneIndex, { floatingIcon: item.icon });
                    }}
                    className={`p-2.5 rounded-xl border text-center transition flex flex-col items-center gap-1 ${
                      isSelected
                        ? 'bg-amber-950/80 border-amber-500 shadow-md ring-1 ring-amber-500'
                        : 'bg-slate-900 border-slate-800 hover:border-slate-700 hover:bg-slate-800/60'
                    }`}
                  >
                    <span className="text-2xl">{item.emoji}</span>
                    <span className="text-[10px] font-medium text-slate-300">
                      {item.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 4: VISUAL FILTERS */}
        {activeTab === 'filters' && (
          <div className="space-y-2">
            <p className="text-[11px] text-slate-400 mb-2">
              Filtros cinematográficos aplicados em tempo real na cena:
            </p>
            <div className="space-y-2">
              {FILTER_CATALOG.map((item) => {
                const isSelected = (activeScene?.visualFilter || 'none') === item.filter;
                return (
                  <button
                    key={item.filter}
                    onClick={() => {
                      onUpdateScene(activeSceneIndex, { visualFilter: item.filter });
                    }}
                    className={`w-full p-3 rounded-xl border text-left transition flex items-center justify-between ${
                      isSelected
                        ? 'bg-blue-950/80 border-blue-500 shadow-md ring-1 ring-blue-500'
                        : 'bg-slate-900 border-slate-800 hover:border-slate-700 hover:bg-slate-800/60'
                    }`}
                  >
                    <div>
                      <div className="font-semibold text-xs text-slate-200">
                        {item.label}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {item.desc}
                      </div>
                    </div>
                    {isSelected && (
                      <span className="px-2 py-0.5 rounded bg-blue-500 text-white text-[10px] font-bold">
                        ATIVO
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 5: HISTORY, GITHUB REPOSITORY & 12-MINUTE EPIC GENERATOR */}
        {activeTab === 'history' && (
          <div className="space-y-4">
            {/* GitHub & Experience Repository Sync */}
            <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-700 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-cyan-400 font-bold text-xs">
                  <GitBranch className="w-4 h-4 text-cyan-400" />
                  Repositório GitHub & Biblioteca de Códigos
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 font-mono border border-emerald-500/40">
                  GITHUB ATIVO
                </span>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Salve e sincronize todos os códigos, aprendizados kinemáticos, ícones VFX e cenas completas diretamente para o seu repositório.
              </p>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  onClick={() => {
                    const bundle = {
                      exportedAt: new Date().toISOString(),
                      repositoryFormat: 'stickman-kinematics-choreography-v2',
                      project: project,
                      snapshots: savedSnapshots,
                      choreographyCatalog: {
                        actionsCount: ACTION_CATALOG.length,
                        environmentsCount: ENVIRONMENT_CATALOG.length,
                      },
                    };
                    const blob = new Blob([JSON.stringify(bundle, null, 2)], {
                      type: 'application/json',
                    });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `stickman_story_repo_${Date.now()}.json`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition shadow-md shadow-blue-600/30"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Baixar JSON Repo</span>
                </button>
                <button
                  onClick={() => {
                    const code = `// Stickman Choreography & Kinematics Engine
// Exportado para Repositório GitHub
export interface StickmanKinematics {
  scenesCount: ${project?.scenes.length || 0};
  aspectRatio: '${project?.aspectRatio || '16:9'}';
  totalDuration: ${project?.scenes.reduce((acc, s) => acc + (s.duration || 4.5), 0).toFixed(1)}s;
}
`;
                    navigator.clipboard.writeText(code).then(() => {
                      setCopiedBundle(true);
                      setTimeout(() => setCopiedBundle(false), 2000);
                    });
                  }}
                  className="flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-600 transition"
                >
                  {copiedBundle ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-300">Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Code className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Copiar Código TS</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-gradient-to-r from-blue-950/80 to-indigo-950/80 border border-blue-500/40 space-y-2">
              <div className="flex items-center gap-2 text-blue-300 font-bold text-xs">
                <Clock className="w-4 h-4 text-cyan-400" />
                Modo Vídeo Longo (10 a 12 Minutos)
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Carregue um documentário narrativo completo de 12 minutos dividido em 12 capítulos cinematográficos com perseguição, intriga e riqueza!
              </p>
              <button
                onClick={onLoad12MinEpic}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold transition shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2"
              >
                <Flame className="w-4 h-4 text-amber-300" />
                Carregar Documentário de 12 Minutos
              </button>
            </div>

            {/* Snapshot Manager */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-300">
                  Histórico de Versões Salvas:
                </span>
                <button
                  onClick={onSaveSnapshot}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 border border-slate-700 transition"
                >
                  Salvar Versão Atual
                </button>
              </div>

              {savedSnapshots.length === 0 ? (
                <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-center text-xs text-slate-500">
                  Nenhuma versão salva no histórico local ainda.
                </div>
              ) : (
                <div className="space-y-2">
                  {savedSnapshots.map((snap) => (
                    <div
                      key={snap.id}
                      className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between"
                    >
                      <div>
                        <div className="font-semibold text-xs text-slate-200 truncate max-w-[180px]">
                          {snap.title}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {snap.sceneCount} cenas • {snap.totalDuration.toFixed(1)}s • {snap.savedAt}
                        </div>
                      </div>
                      <button
                        onClick={() => onRestoreSnapshot(snap)}
                        className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-semibold transition"
                      >
                        Restaurar
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
