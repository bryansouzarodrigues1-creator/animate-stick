import React, { useState, useRef } from 'react';
import { 
  Upload, 
  Film, 
  Music, 
  Type, 
  Sparkles, 
  Plus, 
  Play, 
  Pause, 
  Wand2, 
  Loader2, 
  CheckCircle2, 
  Layers,
  Sliders
} from 'lucide-react';
import { Clip, MediaAsset, ProjectState, FilterPreset } from '../types/editor';
import { sampleLibraryAssets } from '../utils/sampleData';
import { audioEngine } from '../utils/audioEngine';

interface MediaLibraryProps {
  activePanel: 'media' | 'text' | 'filters' | 'ai' | 'audio';
  project: ProjectState;
  currentTime: number;
  selectedClipId: string | null;
  onAddClip: (clip: Clip) => void;
  onApplyPresetToSelected: (preset: FilterPreset) => void;
  onApplyStoryboard: (storyboard: { title: string; colorPreset: FilterPreset; headline: string; subtitle: string; recommendedMusic: string }) => void;
  onOpenScriptToVideo?: () => void;
}

export const MediaLibrary: React.FC<MediaLibraryProps> = ({
  activePanel,
  project,
  currentTime,
  selectedClipId,
  onAddClip,
  onApplyPresetToSelected,
  onApplyStoryboard,
  onOpenScriptToVideo,
}) => {
  const [userAssets, setUserAssets] = useState<MediaAsset[]>([]);
  const [playingPreviewId, setPlayingPreviewId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // AI State
  const [aiScriptInput, setAiScriptInput] = useState('Apresentamos a nova era da edição de vídeo inteligente e ultra rápida.');
  const [aiIdeaInput, setAiIdeaInput] = useState('Lançamento épico de um aplicativo com visual cyberpunk e alta energia.');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiSuccessMessage, setAiSuccessMessage] = useState<string | null>(null);

  // File Upload Handler (Video, Audio, Image)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    audioEngine.playSFX('pop');

    Array.from(files).forEach((file) => {
      const url = URL.createObjectURL(file);
      const isVideo = file.type.startsWith('video');
      const isAudio = file.type.startsWith('audio');
      const isImage = file.type.startsWith('image');

      const assetType = isVideo ? 'video' : isAudio ? 'audio' : isImage ? 'image' : 'video';

      const newAsset: MediaAsset = {
        id: `user-asset-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        name: file.name,
        type: assetType,
        sourceUrl: url,
        duration: isVideo ? 10 : isAudio ? 15 : 5,
        category: 'Meus Arquivos',
      };

      setUserAssets((prev) => [newAsset, ...prev]);
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Add stock/user asset to timeline
  const handleAddAssetToTimeline = (asset: MediaAsset) => {
    audioEngine.playSFX('pop');

    let targetTrack = project.tracks.find((t) => t.type === asset.type);
    if (!targetTrack) {
      targetTrack = project.tracks[0];
    }

    const newClip: Clip = {
      id: `clip-${Date.now()}`,
      trackId: targetTrack.id,
      name: asset.name,
      type: asset.type,
      startTime: Math.round(currentTime * 10) / 10,
      duration: asset.duration,
      trimStart: 0,
      trimEnd: 0,
      sourceDuration: asset.duration,
      sourceUrl: asset.sourceUrl,
      speed: 1,
      volume: 1,
      fadeIn: 0.3,
      fadeOut: 0.3,
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
      color: asset.type === 'video' ? '#0284c7' : asset.type === 'audio' ? '#10b981' : '#8b5cf6',
    };

    onAddClip(newClip);
  };

  // Add text template to timeline
  const handleAddTextTemplate = (
    templateName: string,
    text: string,
    fontSize: number,
    color: string,
    bgColor: string,
    animation: NonNullable<Clip['textProps']>['animation'],
    yOffset = 0
  ) => {
    audioEngine.playSFX('pop');
    const textTrack = project.tracks.find((t) => t.type === 'text') || project.tracks[0];

    const newClip: Clip = {
      id: `clip-text-${Date.now()}`,
      trackId: textTrack.id,
      name: templateName,
      type: 'text',
      startTime: Math.round(currentTime * 10) / 10,
      duration: 4,
      trimStart: 0,
      trimEnd: 0,
      sourceDuration: 10,
      sourceUrl: '',
      speed: 1,
      volume: 1,
      fadeIn: 0.3,
      fadeOut: 0.3,
      transform: { x: 0, y: yOffset, scale: 1, rotation: 0, opacity: 1 },
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
        text,
        fontFamily: 'Plus Jakarta Sans',
        fontSize,
        color,
        backgroundColor: bgColor,
        align: 'center',
        animation: animation || 'none',
        bold: true,
        shadow: true,
      },
      color: '#8b5cf6',
    };

    onAddClip(newClip);
  };

  // Audio Preview toggle
  const handleToggleAudioPreview = (asset: MediaAsset) => {
    if (playingPreviewId === asset.id) {
      audioEngine.stopAll();
      setPlayingPreviewId(null);
    } else {
      audioEngine.stopAll();
      setPlayingPreviewId(asset.id);
      if (asset.sourceUrl.startsWith('synth:')) {
        const synthType = asset.sourceUrl.replace('synth:', '');
        if (synthType === 'ambient') audioEngine.playProceduralTrack('ambient', 6);
        else if (synthType === 'beat') audioEngine.playProceduralTrack('beat', 6);
        else if (synthType === 'sfx-whoosh') audioEngine.playSFX('whoosh');
        else if (synthType === 'sfx-cut') audioEngine.playSFX('cut');
        else if (synthType === 'sfx-success') audioEngine.playSFX('success');
      }
    }
  };

  // AI: Generate Captions
  const handleGenerateCaptionsAI = async () => {
    setIsAiLoading(true);
    setAiSuccessMessage(null);
    audioEngine.playSFX('click');

    try {
      const res = await fetch('/api/ai/generate-captions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scriptOrPrompt: aiScriptInput,
          totalDuration: project.duration,
        }),
      });

      const data = await res.json();
      if (data.captions && Array.isArray(data.captions)) {
        const textTrack = project.tracks.find((t) => t.type === 'text') || project.tracks[0];

        data.captions.forEach((cap: { text: string; startTime: number; duration: number }, idx: number) => {
          const capClip: Clip = {
            id: `clip-ai-sub-${Date.now()}-${idx}`,
            trackId: textTrack.id,
            name: `Legenda ${idx + 1}`,
            type: 'text',
            startTime: cap.startTime,
            duration: cap.duration,
            trimStart: 0,
            trimEnd: 0,
            sourceDuration: cap.duration,
            sourceUrl: '',
            speed: 1,
            volume: 1,
            fadeIn: 0.2,
            fadeOut: 0.2,
            transform: { x: 0, y: 150, scale: 1, rotation: 0, opacity: 1 },
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
              text: cap.text,
              fontFamily: 'Plus Jakarta Sans',
              fontSize: 22,
              color: '#facc15', // Vibrant TikTok yellow
              backgroundColor: 'rgba(0, 0, 0, 0.75)',
              align: 'center',
              animation: 'zoom',
              bold: true,
              shadow: true,
            },
            color: '#eab308',
          };
          onAddClip(capClip);
        });

        audioEngine.playSFX('success');
        setAiSuccessMessage(`${data.captions.length} legendas sincronizadas adicionadas à timeline!`);
      }
    } catch (err) {
      console.error('Failed to generate AI captions:', err);
    } finally {
      setIsAiLoading(false);
    }
  };

  // AI: Generate Storyboard & Project Concept
  const handleGenerateStoryboardAI = async () => {
    setIsAiLoading(true);
    setAiSuccessMessage(null);
    audioEngine.playSFX('click');

    try {
      const res = await fetch('/api/ai/generate-storyboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ideaPrompt: aiIdeaInput }),
      });

      const data = await res.json();
      if (data) {
        onApplyStoryboard(data);
        audioEngine.playSFX('success');
        setAiSuccessMessage('Novo conceito e timeline cinematográfica gerados pela IA!');
      }
    } catch (err) {
      console.error('Failed to generate storyboard:', err);
    } finally {
      setIsAiLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 border-r border-slate-800 text-xs overflow-hidden">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="video/*,audio/*,image/*"
        onChange={handleFileUpload}
        className="hidden"
      />

      {/* PANEL: MEDIA */}
      {activePanel === 'media' && (
        <div className="flex-1 flex flex-col p-4 overflow-y-auto space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <span className="font-semibold text-white">Biblioteca de Mídia</span>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-500 hover:bg-sky-400 text-white font-medium rounded-lg shadow-sm transition-colors"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Importar Arquivo</span>
            </button>
          </div>

          {/* User Uploaded Assets */}
          {userAssets.length > 0 && (
            <div className="space-y-2">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Meus Arquivos Importados ({userAssets.length})
              </span>
              <div className="grid grid-cols-1 gap-2">
                {userAssets.map((asset) => (
                  <div
                    key={asset.id}
                    className="p-2.5 bg-slate-900 rounded-lg border border-slate-800 flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2 truncate">
                      {asset.type === 'video' ? (
                        <Film className="w-4 h-4 text-sky-400 shrink-0" />
                      ) : (
                        <Music className="w-4 h-4 text-emerald-400 shrink-0" />
                      )}
                      <span className="truncate text-white font-medium">{asset.name}</span>
                    </div>
                    <button
                      onClick={() => handleAddAssetToTimeline(asset)}
                      title="Adicionar na Linha do Tempo"
                      aria-label="Adicionar à linha do tempo"
                      className="p-1 rounded bg-slate-800 hover:bg-sky-500 text-slate-300 hover:text-white transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Stock Footage Videos */}
          <div className="space-y-2">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Vídeos de Exemplo (Prontos)
            </span>
            <div className="grid grid-cols-2 gap-2">
              {sampleLibraryAssets
                .filter((a) => a.type === 'video')
                .map((asset) => (
                  <div
                    key={asset.id}
                    className="group relative p-2 bg-slate-900 rounded-lg border border-slate-800 hover:border-sky-500/50 flex flex-col justify-between h-24 overflow-hidden transition-all"
                  >
                    <div className="flex items-center justify-between text-slate-400">
                      <Film className="w-3.5 h-3.5 text-sky-400" />
                      <span className="text-[10px] font-mono-time">{asset.duration}s</span>
                    </div>

                    <span className="text-white font-medium truncate text-[11px]">{asset.name}</span>

                    <button
                      onClick={() => handleAddAssetToTimeline(asset)}
                      className="w-full py-1 bg-slate-800 group-hover:bg-sky-500 text-slate-300 group-hover:text-white rounded text-[10px] font-semibold flex items-center justify-center gap-1 transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Inserir</span>
                    </button>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* PANEL: TEXT TEMPLATES */}
      {activePanel === 'text' && (
        <div className="flex-1 flex flex-col p-4 overflow-y-auto space-y-4">
          <div className="pb-2 border-b border-slate-800">
            <span className="font-semibold text-white">Modelos de Título & Texto</span>
            <p className="text-slate-400 text-[11px] mt-0.5">
              Clique em um modelo para inserir na posição atual da agulha.
            </p>
          </div>

          <div className="space-y-3">
            {/* Template 1: Bold Neon Title */}
            <div
              onClick={() => handleAddTextTemplate('Título Neon', 'NOVACUT 2026', 48, '#38bdf8', 'transparent', 'zoom', -40)}
              className="p-3 bg-slate-900 rounded-lg border border-slate-800 hover:border-sky-500 cursor-pointer transition-all space-y-1.5"
            >
              <div className="flex justify-between items-center text-slate-400">
                <span className="font-semibold text-white">Título Neon Impactante</span>
                <Plus className="w-4 h-4 text-sky-400" />
              </div>
              <p className="text-sky-400 font-bold text-base tracking-wider">NOVACUT 2026</p>
            </div>

            {/* Template 2: Lower Third News Style */}
            <div
              onClick={() => handleAddTextTemplate('Lower Third', 'EDIÇÃO PROFISSIONAL NA WEB', 20, '#ffffff', 'rgba(15, 23, 42, 0.85)', 'slide-up', 140)}
              className="p-3 bg-slate-900 rounded-lg border border-slate-800 hover:border-indigo-500 cursor-pointer transition-all space-y-1.5"
            >
              <div className="flex justify-between items-center text-slate-400">
                <span className="font-semibold text-white">Lower Third / Tarja</span>
                <Plus className="w-4 h-4 text-indigo-400" />
              </div>
              <div className="bg-slate-950 px-2 py-1 rounded inline-block text-white font-semibold text-xs border border-slate-800">
                EDIÇÃO PROFISSIONAL NA WEB
              </div>
            </div>

            {/* Template 3: TikTok / Reels Yellow Subtitle */}
            <div
              onClick={() => handleAddTextTemplate('Legenda Dinâmica', 'ASSISTA ATÉ O FINAL!', 26, '#facc15', 'rgba(0, 0, 0, 0.8)', 'zoom', 120)}
              className="p-3 bg-slate-900 rounded-lg border border-slate-800 hover:border-amber-500 cursor-pointer transition-all space-y-1.5"
            >
              <div className="flex justify-between items-center text-slate-400">
                <span className="font-semibold text-white">Legenda Viral TikTok/Shorts</span>
                <Plus className="w-4 h-4 text-amber-400" />
              </div>
              <p className="text-amber-400 font-extrabold text-sm tracking-wide">
                ASSISTA ATÉ O FINAL!
              </p>
            </div>

            {/* Template 4: Typewriter Quote */}
            <div
              onClick={() => handleAddTextTemplate('Máquina de Escrever', 'Criatividade sem limites...', 32, '#ffffff', 'transparent', 'typewriter', 0)}
              className="p-3 bg-slate-900 rounded-lg border border-slate-800 hover:border-purple-500 cursor-pointer transition-all space-y-1.5"
            >
              <div className="flex justify-between items-center text-slate-400">
                <span className="font-semibold text-white">Efeito Máquina de Escrever</span>
                <Plus className="w-4 h-4 text-purple-400" />
              </div>
              <p className="text-slate-300 italic text-xs font-mono">
                "Criatividade sem limites..."
              </p>
            </div>
          </div>
        </div>
      )}

      {/* PANEL: AUDIO & SFX */}
      {activePanel === 'audio' && (
        <div className="flex-1 flex flex-col p-4 overflow-y-auto space-y-4">
          <div className="pb-2 border-b border-slate-800">
            <span className="font-semibold text-white">Trilhas Sonoras & SFX</span>
            <p className="text-slate-400 text-[11px] mt-0.5">
              Áudios sintetizados diretamente via Web Audio API com zero latência.
            </p>
          </div>

          <div className="space-y-2">
            {sampleLibraryAssets
              .filter((a) => a.type === 'audio')
              .map((asset) => {
                const isPlaying = playingPreviewId === asset.id;
                return (
                  <div
                    key={asset.id}
                    className="p-2.5 bg-slate-900 rounded-lg border border-slate-800 flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <button
                        onClick={() => handleToggleAudioPreview(asset)}
                        title={isPlaying ? 'Parar Prévia' : 'Ouvir Prévia'}
                        aria-label="Prévia de áudio"
                        className={`p-1.5 rounded-full transition-colors ${
                          isPlaying ? 'bg-emerald-500 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
                      </button>

                      <div className="truncate">
                        <span className="text-white font-medium block truncate">{asset.name}</span>
                        <span className="text-[10px] text-slate-500">{asset.category} · {asset.duration}s</span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleAddAssetToTimeline(asset)}
                      title="Adicionar na Linha do Tempo"
                      aria-label="Inserir na timeline"
                      className="px-2.5 py-1 bg-slate-800 hover:bg-emerald-600 text-slate-300 hover:text-white rounded text-[11px] font-medium flex items-center gap-1 transition-colors shrink-0"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Inserir</span>
                    </button>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* PANEL: FILTERS & LUTS */}
      {activePanel === 'filters' && (
        <div className="flex-1 flex flex-col p-4 overflow-y-auto space-y-4">
          <div className="pb-2 border-b border-slate-800">
            <span className="font-semibold text-white">Filtros Cinematográficos & LUTs</span>
            <p className="text-slate-400 text-[11px] mt-0.5">
              Aplique estilos visuais profissionais instantaneamente ao clipe selecionado.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-2.5">
            {[
              { id: 'teal-orange', title: 'Teal & Orange Hollywood', desc: 'Contraste térmico clássico de cinema', color: 'from-cyan-900 to-amber-700' },
              { id: 'vintage', title: 'Vintage Anos 90', desc: 'Tons quentes nostálgicos com sépia suave', color: 'from-amber-950 to-stone-800' },
              { id: 'noir', title: 'Film Noir Preto e Branco', desc: 'Preto e branco com alto contraste dramático', color: 'from-zinc-950 to-zinc-800' },
              { id: 'cyberpunk', title: 'Cyberpunk Neon', desc: 'Matizes invertidos e cores saturadas futuristas', color: 'from-fuchsia-950 to-cyan-900' },
              { id: 'warm-sunset', title: 'Pôr do Sol Dourado', desc: 'Iluminação de hora dourada natural', color: 'from-orange-950 to-rose-900' },
              { id: 'crisp-clean', title: 'Nítido Pro High-End', desc: 'Clareza cristalina para vídeos de tecnologia', color: 'from-slate-900 to-sky-950' },
            ].map((f) => (
              <div
                key={f.id}
                onClick={() => {
                  audioEngine.playSFX('click');
                  onApplyPresetToSelected(f.id as FilterPreset);
                }}
                className={`p-3 rounded-lg border border-slate-800 hover:border-amber-500/60 cursor-pointer bg-gradient-to-r ${f.color} transition-all`}
              >
                <div className="flex justify-between items-center text-white font-semibold">
                  <span>{f.title}</span>
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                </div>
                <p className="text-slate-300 text-[11px] mt-1 opacity-90">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PANEL: AI MAGIC TOOLS */}
      {activePanel === 'ai' && (
        <div className="flex-1 flex flex-col p-4 overflow-y-auto space-y-4">
          {/* Hero Feature: Full Script to Video Wizard */}
          {onOpenScriptToVideo && (
            <div className="p-3.5 bg-gradient-to-br from-indigo-950/80 via-slate-900 to-pink-950/40 rounded-xl border border-indigo-500/40 shadow-lg space-y-2.5">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-indigo-500 text-white flex items-center justify-center shadow-md">
                  <Wand2 className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-bold text-white text-xs block">Criador de Vídeo por Roteiro</span>
                  <span className="text-[10px] text-indigo-300">Gere vídeo completo com cenas e narração</span>
                </div>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Cole qualquer roteiro (história, comercial ou batalha de stickman) e a IA monta toda a timeline.
              </p>
              <button
                type="button"
                onClick={onOpenScriptToVideo}
                className="w-full py-2 bg-gradient-to-r from-sky-500 via-indigo-600 to-pink-500 hover:from-sky-400 hover:to-pink-400 text-white font-bold rounded-lg shadow-md flex items-center justify-center gap-2 text-xs transition-all active:scale-95"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Abrir Criador de Vídeo</span>
              </button>
            </div>
          )}

          <div className="pb-2 border-b border-indigo-900/40">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span className="font-semibold text-white">Ferramentas Rápidas de IA</span>
            </div>
          </div>

          {/* Success Banner */}
          {aiSuccessMessage && (
            <div className="p-2.5 bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 rounded-lg flex items-center gap-2 text-[11px]">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{aiSuccessMessage}</span>
            </div>
          )}

          {/* TOOL 1: Auto-Captions from Script */}
          <div className="p-3 bg-slate-900/80 rounded-lg border border-slate-800 space-y-3">
            <span className="font-semibold text-white flex items-center gap-1.5">
              <Type className="w-3.5 h-3.5 text-amber-400" />
              <span>Gerador de Legendas por IA</span>
            </span>
            <p className="text-slate-400 text-[11px]">
              Digite o texto ou tema da fala para criar legendas cortadas no tempo exato.
            </p>
            <textarea
              rows={3}
              value={aiScriptInput}
              onChange={(e) => setAiScriptInput(e.target.value)}
              placeholder="Cole seu roteiro ou tema aqui..."
              className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white text-xs outline-none focus:border-indigo-500 resize-none"
            />
            <button
              onClick={handleGenerateCaptionsAI}
              disabled={isAiLoading || !aiScriptInput.trim()}
              className="w-full py-2 bg-gradient-to-r from-amber-500 to-indigo-600 hover:from-amber-400 hover:to-indigo-500 text-white font-semibold rounded-lg shadow-sm flex items-center justify-center gap-2 disabled:opacity-50 transition-all"
            >
              {isAiLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Wand2 className="w-4 h-4" />
              )}
              <span>Sincronizar Legendas na Linha do Tempo</span>
            </button>
          </div>

          {/* TOOL 2: Storyboard & Video Concept Generator */}
          <div className="p-3 bg-slate-900/80 rounded-lg border border-slate-800 space-y-3">
            <span className="font-semibold text-white flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              <span>Criador de Conceito de Vídeo</span>
            </span>
            <p className="text-slate-400 text-[11px]">
              Descreva sua ideia de vídeo para a IA gerar títulos, LUTs e música ideal.
            </p>
            <input
              type="text"
              value={aiIdeaInput}
              onChange={(e) => setAiIdeaInput(e.target.value)}
              placeholder="Ex: Teaser de viagem futurista em Tóquio"
              className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-white text-xs outline-none focus:border-indigo-500"
            />
            <button
              onClick={handleGenerateStoryboardAI}
              disabled={isAiLoading || !aiIdeaInput.trim()}
              className="w-full py-2 bg-gradient-to-r from-indigo-500 to-pink-600 hover:from-indigo-400 hover:to-pink-500 text-white font-semibold rounded-lg shadow-sm flex items-center justify-center gap-2 disabled:opacity-50 transition-all"
            >
              {isAiLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              <span>Gerar Storyboard Completo</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
