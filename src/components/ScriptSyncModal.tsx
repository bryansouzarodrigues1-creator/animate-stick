import React, { useState, useRef } from 'react';
import {
  X,
  Copy,
  Download,
  Upload,
  Sparkles,
  Check,
  FileText,
  Bot,
  Loader2,
} from 'lucide-react';
import { StickmanProject } from '../types/stickman';
import {
  buildContextualDirectorFallback,
  validateAndNormalizeDirectorResponse,
} from '../utils/cinematicDirector';

interface ScriptSyncModalProps {
  isOpen: boolean;
  project: StickmanProject;
  onClose: () => void;
  onLoadProject: (project: StickmanProject) => void;
}

export const ScriptSyncModal: React.FC<ScriptSyncModalProps> = ({
  isOpen,
  project,
  onClose,
  onLoadProject,
}) => {
  const [activeTab, setActiveTab] = useState<'export' | 'import' | 'ai'>('export');
  const [copied, setCopied] = useState(false);
  const [importJsonText, setImportJsonText] = useState('');
  const [importError, setImportError] = useState<string | null>(null);

  // AI Prompt State
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const projectJsonString = JSON.stringify(project, null, 2);

  const handleCopyChatPrompt = () => {
    const formatted = `Aqui está meu roteiro no formato StickStory para animação:\n\`\`\`json\n${projectJsonString}\n\`\`\``;
    navigator.clipboard.writeText(formatted);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleDownloadFile = () => {
    const blob = new Blob([projectJsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(project.title || 'roteiro').toLowerCase().replace(/\s+/g, '_')}.stickman.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed.scenes && Array.isArray(parsed.scenes)) {
          const normalized = validateAndNormalizeDirectorResponse(
            parsed,
            parsed.title || '',
            project.aspectRatio
          );
          onLoadProject({
            ...project,
            ...parsed,
            title: normalized.title || parsed.title || project.title,
            scenes: normalized.scenes,
          });
          onClose();
        } else {
          setImportError('O arquivo JSON não contém um array de "scenes" válido.');
        }
      } catch (err) {
        setImportError('Falha ao processar arquivo JSON: ' + String(err));
      }
    };
    reader.readAsText(file);
  };

  const handleApplyPastedJson = () => {
    setImportError(null);
    try {
      let clean = importJsonText.trim();
      if (clean.startsWith('```json')) {
        clean = clean.replace(/^```json/, '').replace(/```$/, '').trim();
      } else if (clean.startsWith('```')) {
        clean = clean.replace(/^```/, '').replace(/```$/, '').trim();
      }

      const parsed = JSON.parse(clean);
      if ((parsed.scenes && Array.isArray(parsed.scenes)) || Array.isArray(parsed)) {
        const normalized = validateAndNormalizeDirectorResponse(
          parsed,
          parsed.title || '',
          project.aspectRatio
        );
        onLoadProject({
          ...project,
          ...(Array.isArray(parsed) ? {} : parsed),
          title: normalized.title || project.title,
          scenes: normalized.scenes,
        });
        onClose();
      } else {
        setImportError('Estrutura inválida. O JSON deve ter um campo "scenes".');
      }
    } catch {
      setImportError('JSON inválido. Verifique se copiou todo o bloco de código do chat.');
    }
  };

  // Generate with Gemini 3.8 Flash Cinematic Director
  const handleGenerateAi = async () => {
    if (!aiPrompt.trim()) return;
    setIsGeneratingAi(true);
    setAiError(null);

    try {
      const res = await fetch('/api/ai/script-to-full-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          script: aiPrompt,
          style: 'stickman',
          aspectRatio: project.aspectRatio,
        }),
      });

      if (!res.ok) throw new Error('Falha na resposta do servidor');
      const data = await res.json();

      const directed = validateAndNormalizeDirectorResponse(
        data,
        aiPrompt,
        project.aspectRatio
      );

      onLoadProject({
        ...project,
        title: directed.title || 'Animação Stickman Gerada',
        scenes: directed.scenes,
      });
      onClose();
    } catch (err) {
      console.error(err);
      const fallback = buildContextualDirectorFallback(aiPrompt, project.aspectRatio);
      onLoadProject({
        ...project,
        title: fallback.title,
        scenes: fallback.scenes,
      });
      onClose();
    } finally {
      setIsGeneratingAi(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-950 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-400" />
            <h3 className="text-base font-bold text-slate-100">
              Sincronizar Roteiro com o Chat / IA
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
        <div className="flex border-b border-slate-800 bg-slate-950/60 px-6">
          <button
            onClick={() => setActiveTab('export')}
            className={`py-3 px-4 font-semibold text-xs border-b-2 transition ${
              activeTab === 'export'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            📤 Exportar para o Chat / Baixar
          </button>
          <button
            onClick={() => setActiveTab('import')}
            className={`py-3 px-4 font-semibold text-xs border-b-2 transition ${
              activeTab === 'import'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            📥 Importar do Chat / Carregar Arquivo
          </button>
          <button
            onClick={() => setActiveTab('ai')}
            className={`py-3 px-4 font-semibold text-xs border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'ai'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Bot className="w-3.5 h-3.5 text-amber-400" />
            ✨ Criar com IA (Gemini 3.8)
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          {activeTab === 'export' && (
            <div className="space-y-4">
              <p className="text-xs text-slate-300 leading-relaxed">
                Você pode copiar o roteiro abaixo e colar diretamente nesta conversa do chat para que eu leia, ajuste cenas ou crie novas ideias, ou pode salvar como arquivo no seu computador.
              </p>

              <div className="flex items-center gap-3">
                <button
                  onClick={handleCopyChatPrompt}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition shadow-lg shadow-blue-600/30"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-300" />
                      Copiado para a área de transferência!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copiar Roteiro para o Chat
                    </>
                  )}
                </button>

                <button
                  onClick={handleDownloadFile}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition border border-slate-700"
                >
                  <Download className="w-4 h-4" />
                  Baixar Arquivo .stickman.json
                </button>
              </div>

              {/* JSON Code Preview */}
              <div className="relative rounded-xl bg-slate-950 border border-slate-800 p-3 overflow-hidden">
                <pre className="text-[11px] font-mono text-slate-300 max-h-60 overflow-y-auto custom-scrollbar">
                  {projectJsonString}
                </pre>
              </div>
            </div>
          )}

          {activeTab === 'import' && (
            <div className="space-y-4">
              <p className="text-xs text-slate-300 leading-relaxed">
                Cole aqui o roteiro que eu te fornecer no chat ou carregue um arquivo <code>.stickman.json</code>.
              </p>

              {/* File Upload Button */}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept=".json"
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-3 px-4 border border-dashed border-slate-700 hover:border-blue-500 rounded-xl bg-slate-950/60 hover:bg-slate-950 text-slate-300 text-xs font-semibold flex items-center justify-center gap-2 transition"
              >
                <Upload className="w-4 h-4 text-blue-400" />
                Carregar Arquivo .stickman.json do seu computador
              </button>

              <div className="relative">
                <textarea
                  rows={8}
                  value={importJsonText}
                  onChange={(e) => setImportJsonText(e.target.value)}
                  placeholder="Cole aqui o bloco JSON do roteiro gerado no chat..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs font-mono text-slate-200 focus:outline-none focus:border-blue-500 custom-scrollbar"
                />
              </div>

              {importError && (
                <div className="p-3 rounded-lg bg-red-950/50 border border-red-500/40 text-red-300 text-xs">
                  {importError}
                </div>
              )}

              <button
                onClick={handleApplyPastedJson}
                disabled={!importJsonText.trim()}
                className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold transition shadow-lg shadow-blue-600/30"
              >
                Aplicar Roteiro ao Vídeo
              </button>
            </div>
          )}

          {activeTab === 'ai' && (
            <div className="space-y-4">
              <p className="text-xs text-slate-300 leading-relaxed">
                Digite qualquer ideia, tema ou história. O Gemini 3.8 Flash cria as cenas, falas, poses dos bonecos stickman, efeitos de câmera e sonoros automaticamente.
              </p>

              <textarea
                rows={4}
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="Exemplo: Um stickman que descobre que seu amigo era um guerreiro lendário e eles travam uma batalha épica de espadas de luz no dojo..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-blue-500 leading-relaxed"
              />

              {aiError && (
                <div className="p-3 rounded-lg bg-red-950/50 border border-red-500/40 text-red-300 text-xs">
                  {aiError}
                </div>
              )}

              <button
                onClick={handleGenerateAi}
                disabled={isGeneratingAi || !aiPrompt.trim()}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white text-xs font-bold transition flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30"
              >
                {isGeneratingAi ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Gerando animação com IA...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-amber-300" />
                    Gerar Animação Stickman Completa
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
