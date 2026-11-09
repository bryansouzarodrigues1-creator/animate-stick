import React from 'react';
import {
  Plus,
  Trash2,
  Copy,
  Volume2,
  Upload,
  User,
  Users,
  Camera,
  Film,
  Zap,
  Check,
  Car,
  Clock,
  Sparkles,
  Layers,
} from 'lucide-react';
import {
  StickmanScene,
  StickmanAction,
  StickmanExpression,
  EnvironmentTheme,
  CameraEffect,
  SoundEffectType,
  VisualFilter,
  FloatingVfxIcon,
} from '../types/stickman';
import { playSoundEffect } from '../utils/sfxAudio';
import {
  estimateSpeechDuration,
  calculateElevenLabsTiming,
} from '../utils/stickmanMath';
import { generateChoreographyForScene } from '../utils/choreographyEngine';

interface ScriptDirectorProps {
  scenes: StickmanScene[];
  activeSceneIndex: number;
  onSelectScene: (idx: number) => void;
  onUpdateScene: (idx: number, updated: Partial<StickmanScene>) => void;
  onAddScene: () => void;
  onDuplicateScene: (idx: number) => void;
  onDeleteScene: (idx: number) => void;
  onOpenAudioModal: (sceneIdx: number) => void;
  wordsPerMinute?: number;
  onUpdateWpm?: (wpm: number) => void;
}

const ACTION_OPTIONS: { label: string; value: StickmanAction }[] = [
  { label: '🧟 Defender Barricada & Sobreviver (Zumbi)', value: 'zombie_survive_barricade' },
  { label: '💎 Comprar Tudo: Jatos, Ilhas & Mansões (1 Trilhão)', value: 'trillion_buy_everything' },
  { label: '🎒 Explorar Cenário & Coletar Suprimentos', value: 'scavenge_supplies' },
  { label: '📢 Coordenar Pessoas & Objetivos no Cenário', value: 'command_crowd' },
  { label: '🏎️ Dirigir Carro Esportivo', value: 'drive_car' },
  { label: '🚨 Perseguição / Fuga com Carros', value: 'car_chase' },
  { label: '💨 Fazer Drift na Curva', value: 'car_drift' },
  { label: '🏙️ Caminhar na Cidade', value: 'walk_city' },
  { label: '🎤 Apresentação no Palco', value: 'presentation_stage' },
  { label: '🌆 No Topo do Arranha-Céu', value: 'hero_rooftop' },
  { label: '🗣️ Gesticular / Falar', value: 'talk_explaining' },
  { label: '🥋 Lutar Kung-Fu', value: 'fight_kungfu' },
  { label: '⚔️ Duelo com Espada', value: 'sword_duel' },
  { label: '💻 Trabalhar no Computador', value: 'work_computer' },
  { label: '💰 Celebrar Riqueza / Dinheiro', value: 'money_celebrate' },
  { label: '😱 Pânico / Desespero', value: 'panic_freakout' },
  { label: '🤔 Pensativo / Curioso', value: 'thinking' },
  { label: '🚶 Caminhando', value: 'walking' },
  { label: '💥 Aterrissagem Heroica', value: 'hero_landing' },
  { label: '😵 Nocaute / Queda Dramática', value: 'dramatic_fall' },
];

const EXPRESSION_OPTIONS: { label: string; value: StickmanExpression }[] = [
  { label: 'Falando / Neutro', value: 'talking' },
  { label: 'Confiante / Esperto', value: 'confident' },
  { label: 'Bravo / Focado', value: 'angry' },
  { label: 'Chocado / Assustado', value: 'shocked' },
  { label: 'Sorrindo / Feliz', value: 'smile' },
  { label: 'Rindo / Zombando', value: 'laughing' },
  { label: 'Intenso / Alerta', value: 'intense' },
  { label: 'Determinado', value: 'determined' },
];

const ENVIRONMENT_OPTIONS: { label: string; value: EnvironmentTheme }[] = [
  { label: '🧟 Apocalipse Zumbi (Barricada, Horda & Helicóptero)', value: 'zombie_apocalypse' },
  { label: '💎 Desafio 1 Trilhão em 1 Mês (Jatos, Iates & Entregas)', value: 'trillionaire_sandbox' },
  { label: '🛡️ Bunker Subterrâneo & Radar de Sobrevivência', value: 'bunker_survival' },
  { label: '🌍 Simulação Global & Multidão com Objetivos', value: 'global_simulation' },
  { label: '🌅 Rodovia ao Pôr do Sol (Carros)', value: 'highway_sunset' },
  { label: '🏙️ Metrópole & Prédios (Downtown)', value: 'city_downtown' },
  { label: '🚨 Perseguição Policial Noturna', value: 'police_chase_night' },
  { label: '🏦 Banco & Cofre com Lasers', value: 'bank_heist' },
  { label: '🌆 Cobertura de Luxo (Penthouse)', value: 'luxury_penthouse' },
  { label: '🌐 Estrada Cyberpunk Futurista', value: 'cyber_highway' },
  { label: '📊 Gráficos de Trading & Finanças', value: 'finance_trading' },
  { label: '🥋 Dojo Marcial sob a Lua', value: 'japanese_dojo' },
  { label: '💻 Escritório Cyber Hacker', value: 'hacker_den' },
  { label: '🔦 Holofote Dramático no Escuro', value: 'spotlight_dark' },
  { label: '🌃 Noite Urbana & Poste de Luz', value: 'street_night' },
  { label: '💰 Cofre de Ouro & Dinheiro', value: 'money_vault' },
  { label: '📝 Papel Milimetrado (Doodle)', value: 'sketch_grid' },
];

const CAMERA_OPTIONS: { label: string; value: CameraEffect }[] = [
  { label: 'Estática Normal', value: 'none' },
  { label: 'Zoom Dramático', value: 'zoom_in' },
  { label: 'Tremor de Impacto', value: 'shake' },
  { label: 'Panorâmica Direita', value: 'pan_right' },
  { label: 'Pulso de Ênfase', value: 'pulse' },
];

const SFX_OPTIONS: { label: string; value: SoundEffectType }[] = [
  { label: 'Nenhum', value: 'none' },
  { label: '🏎️ Motor de Carro Acelerando', value: 'car_engine' },
  { label: '💨 Pneu Cantando / Drift', value: 'car_screech' },
  { label: '🚨 Sirene Policial', value: 'police_siren' },
  { label: '🔥 Nitro Boost / Fogo', value: 'nitro_boost' },
  { label: '🥊 Soco / Impacto', value: 'punch' },
  { label: '⚔️ Espada de Luz / Choque', value: 'sword_clash' },
  { label: '🌪️ Whoosh / Transição', value: 'whoosh' },
  { label: '💵 Caixa Registradora (Cash)', value: 'cash_register' },
  { label: '⌨️ Digitação Mecânica', value: 'typing' },
  { label: '💥 Boom Sub-Grave Dramático', value: 'dramatic_boom' },
  { label: '💡 Sino Eureka / Ideia', value: 'ding_idea' },
];

const VISUAL_FILTER_OPTIONS: { label: string; value: VisualFilter }[] = [
  { label: 'Nenhum Filtro', value: 'none' },
  { label: '🎬 Cinemascope 2.35:1', value: 'cinemascope' },
  { label: '🌑 Vinheta Escura', value: 'vignette' },
  { label: '🎞️ Granulação de Filme', value: 'film_grain' },
  { label: '📺 CRT Cyber Linhas', value: 'crt_cyber' },
  { label: '💵 Chuva de Dinheiro', value: 'money_rain' },
  { label: '🔥 Faíscas & Chamas', value: 'fire_sparks' },
];

const FLOATING_ICON_OPTIONS: { label: string; value: FloatingVfxIcon }[] = [
  { label: 'Sem Ícone Flutuante', value: 'none' },
  { label: '💡 Ideia / Lâmpada', value: 'lightbulb' },
  { label: '🔥 Fogo / Em Chamas', value: 'fire' },
  { label: '💰 Saco de Dólares', value: 'money_bag' },
  { label: '⚡ Raio de Energia', value: 'lightning' },
  { label: '🎯 Alvo / Mira', value: 'target' },
  { label: '📈 Gráfico de Alta', value: 'chart_up' },
  { label: '📉 Gráfico de Queda', value: 'chart_down' },
  { label: '💀 Perigo / Caveira', value: 'skull' },
  { label: '❗ Alerta Máximo', value: 'exclamation' },
  { label: '❓ Dúvida / Mistério', value: 'question' },
  { label: '☕ Café / Concentração', value: 'coffee' },
  { label: '❤️ Paixão / Sucesso', value: 'heart' },
];

export const ScriptDirector: React.FC<ScriptDirectorProps> = ({
  scenes,
  activeSceneIndex,
  onSelectScene,
  onUpdateScene,
  onAddScene,
  onDuplicateScene,
  onDeleteScene,
  onOpenAudioModal,
  wordsPerMinute = 155,
  onUpdateWpm,
}) => {
  const [localWpm, setLocalWpm] = React.useState<number>(wordsPerMinute);
  const currentWpm = onUpdateWpm ? wordsPerMinute : localWpm;

  const handleWpmChange = (newWpm: number) => {
    const clamped = Math.max(95, Math.min(220, newWpm));
    setLocalWpm(clamped);
    onUpdateWpm?.(clamped);
  };

  const testSceneSpeech = (text: string) => {
    if (!text || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'pt-BR';
    utter.rate = Math.max(0.75, Math.min(1.4, currentWpm / 150));
    window.speechSynthesis.speak(utter);
  };

  const handleAutoSyncAllScenes = (targetWpm = currentWpm) => {
    scenes.forEach((sc, idx) => {
      const timing = calculateElevenLabsTiming(sc.narration, targetWpm);
      onUpdateScene(idx, {
        duration: sc.customAudioDuration || timing.totalDurationSec,
        choreography: undefined, // regenerate fresh non-repeating beats for new duration
      });
    });
  };

  const totalWordsInProject = scenes.reduce(
    (acc, sc) => acc + calculateElevenLabsTiming(sc.narration, currentWpm).wordCount,
    0
  );
  const totalEstimatedSec = scenes.reduce(
    (acc, sc) =>
      acc +
      (sc.customAudioDuration ||
        calculateElevenLabsTiming(sc.narration, currentWpm).totalDurationSec),
    0
  );

  return (
    <div className="flex flex-col h-full bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-950 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Film className="w-4 h-4 text-blue-400" />
          <h2 className="text-sm font-bold text-slate-100">
            Direção de Cenas & Roteiro
          </h2>
          <span className="px-2 py-0.5 rounded-full bg-blue-900/60 text-blue-300 text-xs font-mono">
            {scenes.length} cenas
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleAutoSyncAllScenes(currentWpm)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/40 text-emerald-300 text-[11px] font-semibold transition"
            title="Crava o tempo de todas as cenas usando o Timer de Palavras por Minuto (PPM) calibrado para o ElevenLabs!"
          >
            <Clock className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">Cravar Tempo ElevenLabs</span>
          </button>

          <button
            onClick={onAddScene}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition shadow-md shadow-blue-600/30"
          >
            <Plus className="w-3.5 h-3.5" />
            Nova Cena
          </button>
        </div>
      </div>

      {/* ElevenLabs WPM (Palavras Por Minuto) Master Timer Bar */}
      <div className="px-3.5 py-2.5 bg-slate-950/90 border-b border-slate-800/90 flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-[11px] font-bold text-slate-200">
              Timer PPM / ElevenLabs:
            </span>
            <span className="px-2 py-0.5 rounded bg-cyan-950 border border-cyan-500/40 text-cyan-300 font-mono text-[11px] font-bold">
              {currentWpm} palavras/min
            </span>
          </div>

          <div className="flex items-center gap-1 text-[10px]">
            <button
              type="button"
              onClick={() => {
                handleWpmChange(135);
                handleAutoSyncAllScenes(135);
              }}
              className={`px-2 py-0.5 rounded border transition font-medium ${
                currentWpm === 135
                  ? 'bg-blue-600 border-blue-400 text-white'
                  : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200'
              }`}
              title="Cadência dramática / documentário (135 palavras por minuto)"
            >
              🎬 Doc (135)
            </button>
            <button
              type="button"
              onClick={() => {
                handleWpmChange(155);
                handleAutoSyncAllScenes(155);
              }}
              className={`px-2 py-0.5 rounded border transition font-medium ${
                currentWpm === 155
                  ? 'bg-emerald-600 border-emerald-400 text-white'
                  : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200'
              }`}
              title="Cadência padrão ElevenLabs Multilingual v2 em Português (155 palavras por minuto)"
            >
              🎙️ ElevenLabs (155)
            </button>
            <button
              type="button"
              onClick={() => {
                handleWpmChange(175);
                handleAutoSyncAllScenes(175);
              }}
              className={`px-2 py-0.5 rounded border transition font-medium ${
                currentWpm === 175
                  ? 'bg-amber-600 border-amber-400 text-white'
                  : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200'
              }`}
              title="Cadência rápida para Shorts / Reels virais (175 palavras por minuto)"
            >
              ⚡ Rápido (175)
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="range"
            min={100}
            max={210}
            step={5}
            value={currentWpm}
            onChange={(e) => handleWpmChange(parseInt(e.target.value, 10))}
            className="flex-1 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
          />
          <span className="text-[10px] text-slate-400 font-mono whitespace-nowrap">
            📝 {totalWordsInProject} pal. • ⏱️ {totalEstimatedSec.toFixed(1)}s total
          </span>
        </div>
      </div>

      {/* Scenes List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
        {scenes.map((scene, idx) => {
          const isActive = idx === activeSceneIndex;
          const sceneTiming = calculateElevenLabsTiming(scene.narration, currentWpm);

          return (
            <div
              key={scene.id}
              onClick={() => onSelectScene(idx)}
              className={`p-3.5 rounded-xl border transition cursor-pointer ${
                isActive
                  ? 'bg-slate-800/90 border-blue-500 shadow-lg ring-1 ring-blue-500/50'
                  : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900/60'
              }`}
            >
              {/* Scene Title Bar */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`flex items-center justify-center w-5 h-5 rounded-md font-mono text-xs font-bold ${
                      isActive
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {idx + 1}
                  </span>
                  <input
                    type="text"
                    value={scene.title}
                    onChange={(e) =>
                      onUpdateScene(idx, { title: e.target.value })
                    }
                    className="bg-transparent font-semibold text-xs text-slate-200 focus:outline-none focus:border-b border-blue-400 px-1 py-0.5"
                  />
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDuplicateScene(idx);
                    }}
                    className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
                    title="Duplicar cena"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  {scenes.length > 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteScene(idx);
                      }}
                      className="p-1 rounded text-slate-400 hover:text-red-400 hover:bg-slate-800 transition"
                      title="Excluir cena"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Spoken Narration Textarea */}
              <div className="mb-2.5">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-medium text-slate-400 flex items-center gap-1">
                    <Volume2 className="w-3 h-3 text-emerald-400" />
                    Fala da Narração (Legenda & Voz):
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                      {sceneTiming.wordCount} pal. • {sceneTiming.syllableCount} síl.
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        testSceneSpeech(scene.narration);
                      }}
                      className="text-[10px] text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1"
                    >
                      Ouvir fala 🔊
                    </button>
                  </div>
                </div>
                <textarea
                  rows={2}
                  value={scene.narration}
                  onChange={(e) =>
                    onUpdateScene(idx, {
                      narration: e.target.value,
                      choreography: undefined,
                    })
                  }
                  placeholder="Escreva a fala exata narrada nesta cena..."
                  className="w-full bg-slate-900 border border-slate-700/80 rounded-lg p-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition resize-none leading-relaxed"
                />
                {/* Live ElevenLabs WPM Formula Readout */}
                <div className="mt-1 flex items-center justify-between text-[10px] text-slate-400 bg-slate-900/70 px-2 py-1 rounded border border-slate-800/80">
                  <span>
                    ⏱️ ElevenLabs ({currentWpm} PPM):{' '}
                    <strong className="text-emerald-400 font-mono">
                      {sceneTiming.totalDurationSec}s
                    </strong>{' '}
                    <span className="text-slate-500">
                      (fala {sceneTiming.spokenDurationSec}s + pausas {sceneTiming.punctuationPauseSec}s)
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onUpdateScene(idx, {
                        duration: sceneTiming.totalDurationSec,
                        choreography: undefined,
                      });
                    }}
                    className="text-cyan-400 hover:text-cyan-300 font-semibold underline"
                  >
                    Aplicar {sceneTiming.totalDurationSec}s
                  </button>
                </div>
              </div>

              {/* Quick Settings Row: Duration & ElevenLabs Audio */}
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                    <span className="flex items-center gap-1">
                      <span>Duração:</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          const est = estimateSpeechDuration(
                            scene.narration,
                            1.0,
                            currentWpm
                          );
                          onUpdateScene(idx, {
                            duration: est,
                            choreography: undefined,
                          });
                        }}
                        className="text-[10px] text-cyan-400 hover:text-cyan-300 font-semibold underline decoration-cyan-500/40 ml-1"
                        title="Calcula e aplica a duração exata da fala para o ElevenLabs"
                      >
                        Auto ({sceneTiming.totalDurationSec}s)
                      </button>
                    </span>
                    <span className="font-mono text-blue-400 font-bold">
                      {scene.duration}s
                    </span>
                  </div>
                  <input
                    type="range"
                    min={1.8}
                    max={90}
                    step={0.1}
                    value={scene.duration}
                    onChange={(e) =>
                      onUpdateScene(idx, {
                        duration: parseFloat(e.target.value),
                        choreography: undefined,
                      })
                    }
                    className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                </div>

                <div className="flex flex-col justify-end">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenAudioModal(idx);
                    }}
                    className={`flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium border transition ${
                      scene.customAudioUrl
                        ? 'bg-emerald-950/60 border-emerald-500 text-emerald-300'
                        : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-600'
                    }`}
                  >
                    {scene.customAudioUrl ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="truncate max-w-[100px]">
                          {scene.customAudioFileName || 'Áudio ElevenLabs'}
                        </span>
                      </>
                    ) : (
                      <>
                        <Upload className="w-3.5 h-3.5 text-slate-400" />
                        <span>Voz ElevenLabs</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Action & Environment Grid */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                {/* Character 1 Action */}
                <div>
                  <label className="text-[10px] font-medium text-slate-400 mb-1 flex items-center gap-1">
                    <User className="w-3 h-3 text-cyan-400" />
                    Ação Stickman / Veículo:
                  </label>
                  <select
                    value={scene.character1.action}
                    onChange={(e) =>
                      onUpdateScene(idx, {
                        character1: {
                          ...scene.character1,
                          action: e.target.value as StickmanAction,
                        },
                      })
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                  >
                    {ACTION_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Character 1 Expression */}
                <div>
                  <label className="text-[10px] font-medium text-slate-400 mb-1 flex items-center gap-1">
                    Expressão Facial:
                  </label>
                  <select
                    value={scene.character1.expression}
                    onChange={(e) =>
                      onUpdateScene(idx, {
                        character1: {
                          ...scene.character1,
                          expression: e.target.value as StickmanExpression,
                        },
                      })
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                  >
                    {EXPRESSION_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Environment Theme */}
                <div>
                  <label className="text-[10px] font-medium text-slate-400 mb-1 flex items-center gap-1">
                    Cenário / Lugar:
                  </label>
                  <select
                    value={scene.environment}
                    onChange={(e) =>
                      onUpdateScene(idx, {
                        environment: e.target.value as EnvironmentTheme,
                      })
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                  >
                    {ENVIRONMENT_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Camera Effect */}
                <div>
                  <label className="text-[10px] font-medium text-slate-400 mb-1 flex items-center gap-1">
                    <Camera className="w-3 h-3 text-amber-400" />
                    Câmera:
                  </label>
                  <select
                    value={scene.cameraEffect}
                    onChange={(e) =>
                      onUpdateScene(idx, {
                        cameraEffect: e.target.value as CameraEffect,
                      })
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                  >
                    {CAMERA_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Sound Effect */}
                <div>
                  <label className="text-[10px] font-medium text-slate-400 mb-1 flex items-center gap-1">
                    <Zap className="w-3 h-3 text-yellow-400" />
                    Efeito Sonoro (SFX):
                  </label>
                  <select
                    value={scene.soundEffect}
                    onChange={(e) => {
                      const sfx = e.target.value as SoundEffectType;
                      onUpdateScene(idx, { soundEffect: sfx });
                      if (sfx !== 'none') playSoundEffect(sfx);
                    }}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                  >
                    {SFX_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Visual Filter */}
                <div>
                  <label className="text-[10px] font-medium text-slate-400 mb-1 flex items-center gap-1">
                    <Film className="w-3 h-3 text-purple-400" />
                    Filtro Visual:
                  </label>
                  <select
                    value={scene.visualFilter || 'none'}
                    onChange={(e) =>
                      onUpdateScene(idx, {
                        visualFilter: e.target.value as VisualFilter,
                      })
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                  >
                    {VISUAL_FILTER_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Floating VFX Icon */}
                <div>
                  <label className="text-[10px] font-medium text-slate-400 mb-1 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-amber-400" />
                    Ícone VFX Flutuante:
                  </label>
                  <select
                    value={scene.floatingIcon || 'none'}
                    onChange={(e) =>
                      onUpdateScene(idx, {
                        floatingIcon: e.target.value as FloatingVfxIcon,
                      })
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                  >
                    {FLOATING_ICON_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Second Character Toggle */}
                <div className="flex flex-col justify-end">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (scene.character2) {
                        onUpdateScene(idx, { character2: undefined });
                      } else {
                        onUpdateScene(idx, {
                          character2: {
                            name: 'Oponente',
                            color: '#DC2626',
                            action: 'car_chase',
                            expression: 'angry',
                            prop: 'steering_wheel',
                            position: 'right',
                          },
                        });
                      }
                    }}
                    className={`flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg border text-xs font-medium transition ${
                      scene.character2
                        ? 'bg-rose-950/60 border-rose-500 text-rose-300'
                        : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Users className="w-3.5 h-3.5" />
                    {scene.character2 ? '2 Personagens Ativos' : '+ Adicionar Rival/Viatura'}
                  </button>
                </div>
              </div>

              {/* Second-by-Second Dynamic Choreography Preview */}
              <div className="mt-3 pt-2.5 border-t border-slate-700/60">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-semibold text-cyan-400 uppercase tracking-wider flex items-center gap-1">
                    <Zap className="w-3 h-3 text-cyan-400" />
                    Coreografia Segundo a Segundo:
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {generateChoreographyForScene(scene).length} beats cronometrados
                  </span>
                </div>
                <div className="flex gap-1.5 overflow-x-auto pb-1.5">
                  {generateChoreographyForScene(scene).map((beat, bIdx) => (
                    <div
                      key={bIdx}
                      className="flex-shrink-0 bg-slate-900 border border-slate-700/80 rounded-lg p-2 min-w-[130px] max-w-[160px] text-[10px]"
                    >
                      <div className="flex items-center justify-between text-slate-500 text-[9px] font-mono mb-0.5">
                        <span>{beat.timeRange}</span>
                        <span className="text-cyan-400 font-semibold">#{bIdx + 1}</span>
                      </div>
                      <div className="text-slate-200 font-medium truncate mb-0.5">
                        {beat.label}
                      </div>
                      <div className="text-[9px] text-slate-400 truncate">
                        "{beat.words}"
                      </div>
                      {beat.maneuver !== 'none' && (
                        <div className="mt-1 inline-block px-1 py-0.5 rounded bg-blue-950 text-blue-300 font-mono text-[8px] border border-blue-500/30">
                          {beat.maneuver}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
