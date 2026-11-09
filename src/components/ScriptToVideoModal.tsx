import React, { useState } from 'react';
import { 
  X, 
  Wand2, 
  Sparkles, 
  Swords, 
  Film, 
  Smartphone, 
  Tv, 
  Volume2, 
  Loader2, 
  CheckCircle2, 
  ArrowRight,
  Play
} from 'lucide-react';
import { ProjectState, Clip, FilterPreset, Track } from '../types/editor';
import { audioEngine } from '../utils/audioEngine';
import { voiceNarration } from '../utils/speechVoice';

interface ScriptToVideoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyGeneratedProject: (newProject: ProjectState) => void;
}

export const ScriptToVideoModal: React.FC<ScriptToVideoModalProps> = ({
  isOpen,
  onClose,
  onApplyGeneratedProject,
}) => {
  const [script, setScript] = useState(
    'Em uma arena digital esquecida, dois guerreiros de pura energia se enfrentam pelo domínio total. Cada golpe rasga o espaço em chamas. Apenas o mais rápido sobreviverá ao duelo supremo.'
  );
  const [selectedStyle, setSelectedStyle] = useState<'stickman' | 'cinematic' | 'viral' | 'tech'>('stickman');
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16'>('16:9');
  const [enableVoiceover, setEnableVoiceover] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const quickTemplates = [
    {
      title: 'Batalha Stickman (Alan Becker / Dojo)',
      style: 'stickman' as const,
      aspect: '16:9' as const,
      text: 'Dois mestres do bastão e da lâmina iniciam um confronto implacável. Faíscas voam enquanto golpes supersônicos iluminam o dojo. Com um contra-ataque devastador, o duelo atinge o clímax definitivo.',
    },
    {
      title: 'Teaser Futurista Cyberpunk',
      style: 'cinematic' as const,
      aspect: '16:9' as const,
      text: 'No ano de 2099, as luzes de neon escondem os maiores segredos da humanidade. O futuro não é uma escolha, é uma corrida contra o tempo. Conheça a revolução digital.',
    },
    {
      title: 'Viral TikTok / Reels Impacto',
      style: 'viral' as const,
      aspect: '9:16' as const,
      text: 'Pare tudo o que você está fazendo agora! Esse é o maior segredo que ninguém nunca te contou. Assista até o segundo final se você quer transformar seus resultados hoje.',
    },
    {
      title: 'Comercial Moderno de Produto',
      style: 'tech' as const,
      aspect: '16:9' as const,
      text: 'Criado para quem exige excelência. Design minimalista, potência incomparável e a mais avançada tecnologia na ponta dos seus dedos. O futuro está em suas mãos.',
    },
  ];

  const handleGenerate = async () => {
    setIsLoading(true);
    audioEngine.playSFX('click');

    try {
      const res = await fetch('/api/ai/script-to-full-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          script,
          style: selectedStyle,
          aspectRatio,
        }),
      });

      const data = await res.json();
      if (data && data.scenes && data.scenes.length > 0) {
        // Build complete timeline tracks and clips from the scenes
        const tracks: Track[] = [
          { id: 't-text', type: 'text', name: 'Títulos & Legendas', muted: false, hidden: false, locked: false, order: 0 },
          { id: 't-overlay', type: 'overlay', name: 'Sobreposições', muted: false, hidden: false, locked: false, order: 1 },
          { id: 't-video1', type: 'video', name: 'Vídeo Principal (V1)', muted: false, hidden: false, locked: false, order: 2 },
          { id: 't-audio1', type: 'audio', name: 'Música de Fundo (A1)', muted: false, hidden: false, locked: false, order: 3 },
          { id: 't-audio2', type: 'audio', name: 'Efeitos SFX (A2)', muted: false, hidden: false, locked: false, order: 4 },
        ];

        let timelineCursor = 0;
        const newClips: Clip[] = [];

        data.scenes.forEach((scene: any, idx: number) => {
          const sceneStart = timelineCursor;
          const sceneDur = scene.duration || 5;

          // 1. Video Clip
          newClips.push({
            id: `scene-v-${idx}-${Date.now()}`,
            trackId: 't-video1',
            name: scene.name || `Cena ${idx + 1}`,
            type: 'video',
            startTime: sceneStart,
            duration: sceneDur,
            trimStart: 0,
            trimEnd: 0,
            sourceDuration: sceneDur,
            sourceUrl: `procedural:${scene.visualType || 'stickman-combat'}`,
            speed: 1,
            volume: 1,
            fadeIn: idx === 0 ? 0 : 0.4,
            fadeOut: 0.4,
            color: selectedStyle === 'stickman' ? '#e11d48' : '#0284c7',
            transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
            filters: {
              brightness: 100,
              contrast: 110,
              saturation: 115,
              sepia: 0,
              grayscale: 0,
              blur: 0,
              hueRotate: 0,
              vignette: 0.2,
              preset: (scene.colorPreset as FilterPreset) || 'teal-orange',
            },
            transition: { type: 'dissolve', duration: 0.5 },
          });

          // 2. Headline Title (first half of scene)
          if (scene.headline) {
            newClips.push({
              id: `scene-t-${idx}-${Date.now()}`,
              trackId: 't-text',
              name: `Título ${idx + 1}`,
              type: 'text',
              startTime: sceneStart + 0.2,
              duration: Math.min(3.5, sceneDur - 0.5),
              trimStart: 0,
              trimEnd: 0,
              sourceDuration: 5,
              sourceUrl: '',
              speed: 1,
              volume: 1,
              fadeIn: 0.2,
              fadeOut: 0.3,
              color: '#8b5cf6',
              transform: { x: 0, y: -80, scale: 1, rotation: 0, opacity: 1 },
              filters: {
                brightness: 100,
                contrast: 100,
                saturation: 100,
                sepia: 0,
                grayscale: 0,
                blur: 0,
                hueRotate: 0,
                vignette: 0,
                preset: 'none',
              },
              textProps: {
                text: scene.headline,
                fontFamily: 'Plus Jakarta Sans',
                fontSize: aspectRatio === '9:16' ? 36 : 46,
                color: '#ffffff',
                backgroundColor: 'transparent',
                align: 'center',
                animation: 'zoom',
                bold: true,
                shadow: true,
              },
            });
          }

          // 3. Spoken Caption Subtitle (lower third)
          if (scene.narration) {
            newClips.push({
              id: `scene-cap-${idx}-${Date.now()}`,
              trackId: 't-text',
              name: `Legenda ${idx + 1}`,
              type: 'text',
              startTime: sceneStart + 0.5,
              duration: Math.max(2, sceneDur - 0.8),
              trimStart: 0,
              trimEnd: 0,
              sourceDuration: 5,
              sourceUrl: '',
              speed: 1,
              volume: 1,
              fadeIn: 0.2,
              fadeOut: 0.2,
              color: '#f59e0b',
              transform: { x: 0, y: 130, scale: 1, rotation: 0, opacity: 1 },
              filters: {
                brightness: 100,
                contrast: 100,
                saturation: 100,
                sepia: 0,
                grayscale: 0,
                blur: 0,
                hueRotate: 0,
                vignette: 0,
                preset: 'none',
              },
              textProps: {
                text: scene.narration,
                fontFamily: 'Plus Jakarta Sans',
                fontSize: aspectRatio === '9:16' ? 22 : 24,
                color: selectedStyle === 'viral' ? '#facc15' : '#ffffff',
                backgroundColor: 'rgba(15, 23, 42, 0.85)',
                align: 'center',
                animation: 'slide-up',
                bold: true,
                shadow: false,
              },
            });
          }

          // 4. SFX Transition Cut
          if (idx > 0) {
            newClips.push({
              id: `scene-sfx-${idx}-${Date.now()}`,
              trackId: 't-audio2',
              name: `SFX Transição ${idx}`,
              type: 'audio',
              startTime: Math.max(0, sceneStart - 0.3),
              duration: 0.8,
              trimStart: 0,
              trimEnd: 0,
              sourceDuration: 1,
              sourceUrl: `synth:sfx-${scene.sfx || 'whoosh'}`,
              speed: 1,
              volume: 0.9,
              fadeIn: 0,
              fadeOut: 0,
              color: '#f59e0b',
              transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
              filters: {
                brightness: 100,
                contrast: 100,
                saturation: 100,
                sepia: 0,
                grayscale: 0,
                blur: 0,
                hueRotate: 0,
                vignette: 0,
                preset: 'none',
              },
            });
          }

          timelineCursor += sceneDur;
        });

        // Background Music Track across whole duration
        const totalDuration = timelineCursor;
        newClips.push({
          id: `master-music-${Date.now()}`,
          trackId: 't-audio1',
          name: data.musicGenre === 'beat' ? 'Batida Dinâmica Synthwave' : 'Trilha Sonora Épica',
          type: 'audio',
          startTime: 0,
          duration: totalDuration,
          trimStart: 0,
          trimEnd: 0,
          sourceDuration: totalDuration + 5,
          sourceUrl: data.musicGenre === 'beat' ? 'synth:beat' : 'synth:ambient',
          speed: 1,
          volume: 0.75,
          fadeIn: 0.5,
          fadeOut: 1.5,
          color: '#10b981',
          transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
          filters: {
            brightness: 100,
            contrast: 100,
            saturation: 100,
            sepia: 0,
            grayscale: 0,
            blur: 0,
            hueRotate: 0,
            vignette: 0,
            preset: 'none',
          },
        });

        voiceNarration.setVoiceEnabled(enableVoiceover);

        const newProject: ProjectState = {
          id: `proj-${Date.now()}`,
          title: data.title || 'Vídeo Profissional',
          aspectRatio,
          fps: 30,
          duration: Math.ceil(totalDuration + 2),
          tracks,
          clips: newClips,
        };

        onApplyGeneratedProject(newProject);
        audioEngine.playSFX('success');
        onClose();
      }
    } catch (err) {
      console.error('Failed to generate full video from script:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
      <div className="bg-slate-950 border border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl p-6 text-slate-100 space-y-5 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-sky-500 via-indigo-500 to-pink-500 text-white flex items-center justify-center shadow-md shadow-indigo-500/20">
              <Wand2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>Criador de Vídeo Profissional por Roteiro</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 font-semibold">
                  IA Generativa
                </span>
              </h2>
              <p className="text-slate-400 text-xs">
                Transforme qualquer texto ou ideia em um vídeo completo com cenas, narração, música e legendas
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar criador de vídeo"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-900 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Templates Rápidos */}
        <div className="space-y-2">
          <span className="text-xs font-semibold text-slate-300">Modelos Rápidos de Roteiro:</span>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {quickTemplates.map((tmpl, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  audioEngine.playSFX('click');
                  setScript(tmpl.text);
                  setSelectedStyle(tmpl.style);
                  setAspectRatio(tmpl.aspect);
                }}
                className="p-2 text-left rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 transition-all truncate"
              >
                <span className="font-semibold text-sky-400 block truncate">{tmpl.title}</span>
                <span className="text-[11px] text-slate-400 block truncate">{tmpl.text}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Script Input Textarea */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
            <span>Roteiro / Texto do seu Vídeo</span>
            <span className="text-[11px] text-slate-500 font-normal">Digite ou cole qualquer história ou comercial</span>
          </label>
          <textarea
            rows={4}
            value={script}
            onChange={(e) => setScript(e.target.value)}
            placeholder="Digite o roteiro completo aqui..."
            className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-white text-xs outline-none focus:border-indigo-500 leading-relaxed resize-none"
          />
        </div>

        {/* Style Selection */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-300 block">Estilo Visual do Vídeo</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            {[
              { id: 'stickman', label: 'Stickman Luta', icon: Swords, desc: 'Alan Becker & Hyun Dojo' },
              { id: 'cinematic', label: 'Cinematográfico', icon: Film, desc: 'Épico & Dramatic' },
              { id: 'viral', label: 'TikTok / Viral', icon: Smartphone, desc: 'Shorts & Reels' },
              { id: 'tech', label: 'Apresentação Tech', icon: Tv, desc: 'Studio Minimalista' },
            ].map((st) => {
              const Icon = st.icon;
              const isSelected = selectedStyle === st.id;
              return (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => setSelectedStyle(st.id as any)}
                  className={`p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between h-20 ${
                    isSelected
                      ? 'border-indigo-500 bg-indigo-500/15 text-indigo-300 font-semibold'
                      : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:text-white'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <Icon className="w-4 h-4 text-indigo-400" />
                    {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400" />}
                  </div>
                  <div>
                    <span className="block font-bold text-white text-xs">{st.label}</span>
                    <span className="text-[10px] opacity-75">{st.desc}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Options Row: Aspect Ratio & Voiceover */}
        <div className="grid grid-cols-2 gap-4 p-3 bg-slate-900/60 rounded-xl border border-slate-800 text-xs">
          <div>
            <label className="text-slate-400 font-medium block mb-1.5">Formato de Tela</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setAspectRatio('16:9')}
                className={`flex-1 py-1.5 px-2 rounded-lg border text-center transition-colors ${
                  aspectRatio === '16:9'
                    ? 'border-sky-500 bg-sky-500/20 text-sky-400 font-semibold'
                    : 'border-slate-800 bg-slate-950 text-slate-400'
                }`}
              >
                16:9 (Horizontal)
              </button>
              <button
                type="button"
                onClick={() => setAspectRatio('9:16')}
                className={`flex-1 py-1.5 px-2 rounded-lg border text-center transition-colors ${
                  aspectRatio === '9:16'
                    ? 'border-sky-500 bg-sky-500/20 text-sky-400 font-semibold'
                    : 'border-slate-800 bg-slate-950 text-slate-400'
                }`}
              >
                9:16 (Vertical)
              </button>
            </div>
          </div>

          <div>
            <label className="text-slate-400 font-medium block mb-1.5">Locução / Voz por IA</label>
            <button
              type="button"
              onClick={() => setEnableVoiceover(!enableVoiceover)}
              className={`w-full py-1.5 px-3 rounded-lg border flex items-center justify-center gap-2 transition-colors ${
                enableVoiceover
                  ? 'border-emerald-500 bg-emerald-500/20 text-emerald-400 font-semibold'
                  : 'border-slate-800 bg-slate-950 text-slate-400'
              }`}
            >
              <Volume2 className="w-3.5 h-3.5" />
              <span>{enableVoiceover ? 'Narração Ativada (pt-BR)' : 'Sem Narração'}</span>
            </button>
          </div>
        </div>

        {/* Actions Footer */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white rounded-lg transition-colors"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleGenerate}
            disabled={isLoading || !script.trim()}
            className="px-6 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-sky-500 via-indigo-600 to-pink-500 hover:from-sky-400 hover:to-pink-400 rounded-xl shadow-lg shadow-indigo-500/25 flex items-center gap-2 disabled:opacity-50 transition-all active:scale-95"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            <span>{isLoading ? 'Construindo Produção...' : 'Gerar Vídeo Completo do Roteiro'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
