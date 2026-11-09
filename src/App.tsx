import React, { useState, useRef, useEffect } from 'react';
import { PRESET_PROJECTS } from './utils/presetScripts';
import { StickmanProject, StickmanScene, SavedProjectSnapshot } from './types/stickman';
import { StickmanTopNav } from './components/StickmanTopNav';
import { StickmanCanvas } from './components/StickmanCanvas';
import { ScriptDirector } from './components/ScriptDirector';
import { ElevenLabsAudioModal } from './components/ElevenLabsAudioModal';
import { ScriptSyncModal } from './components/ScriptSyncModal';
import { ExportVideoModal } from './components/ExportVideoModal';
import { CreativeToolsDrawer } from './components/CreativeToolsDrawer';

export default function App() {
  const [currentPresetKey, setCurrentPresetKey] = useState<string>('zombie_apocalypse_sim');
  const [project, setProject] = useState<StickmanProject>(
    PRESET_PROJECTS.zombie_apocalypse_sim
  );
  const [activeSceneIndex, setActiveSceneIndex] = useState(0);

  // Modals and Drawer state
  const [isCreativeToolsOpen, setIsCreativeToolsOpen] = useState(false);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [audioModalSceneIdx, setAudioModalSceneIdx] = useState<number | null>(
    null
  );

  // Saved Snapshots Library (Experience Repository)
  const [savedSnapshots, setSavedSnapshots] = useState<SavedProjectSnapshot[]>(() => {
    try {
      const stored = localStorage.getItem('stickstory_snapshots');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const handleSaveSnapshot = () => {
    let dur = 0;
    for (const sc of project.scenes) {
      dur += sc.duration || 4.5;
    }
    const newSnap: SavedProjectSnapshot = {
      id: `snap_${Date.now()}`,
      title: `${project.title} (${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })})`,
      savedAt: new Date().toISOString(),
      sceneCount: project.scenes.length,
      totalDuration: Math.round(dur * 10) / 10,
      project: JSON.parse(JSON.stringify(project)),
    };
    const updated = [newSnap, ...savedSnapshots].slice(0, 40);
    setSavedSnapshots(updated);
    try {
      localStorage.setItem('stickstory_snapshots', JSON.stringify(updated));
    } catch (e) {
      console.warn('Snapshot storage error', e);
    }
  };

  const handleRestoreSnapshot = (snapshot: SavedProjectSnapshot) => {
    setProject(snapshot.project);
    setActiveSceneIndex(0);
    setCurrentPresetKey('custom');
  };

  const handleLoad12MinEpic = () => {
    if (PRESET_PROJECTS.epic_12min_documentary) {
      setProject(PRESET_PROJECTS.epic_12min_documentary);
      setCurrentPresetKey('epic_12min_documentary');
      setActiveSceneIndex(0);
      setIsCreativeToolsOpen(false);
    }
  };

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Switch viral preset
  const handleSelectPreset = (presetKey: string) => {
    setCurrentPresetKey(presetKey);
    if (PRESET_PROJECTS[presetKey]) {
      setProject(PRESET_PROJECTS[presetKey]);
      setActiveSceneIndex(0);
    }
  };

  // Update specific scene
  const handleUpdateScene = (idx: number, updated: Partial<StickmanScene>) => {
    setProject((prev) => {
      const newScenes = [...prev.scenes];
      newScenes[idx] = { ...newScenes[idx], ...updated };
      return { ...prev, scenes: newScenes };
    });
  };

  // Add new scene
  const handleAddScene = () => {
    const newScene: StickmanScene = {
      id: `scene_${Date.now()}`,
      title: `Cena ${project.scenes.length + 1}`,
      duration: 4.5,
      narration: 'Nova cena de animação stickman com narração e legendas.',
      character1: {
        name: 'Personagem',
        color: '#0284C7',
        action: 'talk_explaining',
        expression: 'talking',
        prop: 'none',
        position: 'center',
      },
      environment: 'sketch_grid',
      cameraEffect: 'none',
      soundEffect: 'none',
    };

    setProject((prev) => ({
      ...prev,
      scenes: [...prev.scenes, newScene],
    }));
    setActiveSceneIndex(project.scenes.length);
  };

  // Duplicate scene
  const handleDuplicateScene = (idx: number) => {
    const original = project.scenes[idx];
    const duplicated: StickmanScene = {
      ...original,
      id: `scene_${Date.now()}`,
      title: `${original.title} (Cópia)`,
    };

    setProject((prev) => {
      const newScenes = [...prev.scenes];
      newScenes.splice(idx + 1, 0, duplicated);
      return { ...prev, scenes: newScenes };
    });
    setActiveSceneIndex(idx + 1);
  };

  // Delete scene
  const handleDeleteScene = (idx: number) => {
    if (project.scenes.length <= 1) return;
    setProject((prev) => {
      const newScenes = prev.scenes.filter((_, i) => i !== idx);
      return { ...prev, scenes: newScenes };
    });
    setActiveSceneIndex((prev) => Math.max(0, Math.min(prev, project.scenes.length - 2)));
  };

  // Update aspect ratio
  const handleUpdateAspectRatio = (ratio: '16:9' | '9:16') => {
    setProject((prev) => ({ ...prev, aspectRatio: ratio }));
  };

  // Save audio from ElevenLabs modal
  const handleSaveAudio = (
    sceneIndex: number,
    audioUrl?: string,
    fileName?: string,
    durationSec?: number
  ) => {
    setProject((prev) => {
      const newScenes = [...prev.scenes];
      if (newScenes[sceneIndex]) {
        newScenes[sceneIndex] = {
          ...newScenes[sceneIndex],
          customAudioUrl: audioUrl,
          customAudioFileName: fileName,
          customAudioDuration: durationSec,
          duration: durationSec ? Math.max(2, durationSec) : newScenes[sceneIndex].duration,
        };
      }
      return { ...prev, scenes: newScenes };
    });
  };

  const activeAudioScene =
    audioModalSceneIdx !== null && project.scenes[audioModalSceneIdx]
      ? project.scenes[audioModalSceneIdx]
      : null;

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* Top Navbar */}
      <StickmanTopNav
        currentPresetKey={currentPresetKey}
        onSelectPreset={handleSelectPreset}
        onOpenSyncModal={() => setIsSyncModalOpen(true)}
        onOpenExportModal={() => setIsExportModalOpen(true)}
        onOpenCreativeTools={() => setIsCreativeToolsOpen(true)}
        project={project}
      />

      {/* Main Studio Viewport */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-3 p-3 overflow-y-auto lg:overflow-hidden custom-scrollbar">
        {/* Left Column: Script Director (5 cols on large screen) */}
        <div className="order-2 lg:order-1 lg:col-span-5 h-[500px] lg:h-full overflow-hidden">
          <ScriptDirector
            scenes={project.scenes}
            activeSceneIndex={activeSceneIndex}
            wordsPerMinute={project.wordsPerMinute || 155}
            onUpdateWpm={(newWpm) =>
              setProject((prev) => ({ ...prev, wordsPerMinute: newWpm }))
            }
            onSelectScene={setActiveSceneIndex}
            onUpdateScene={handleUpdateScene}
            onAddScene={handleAddScene}
            onDuplicateScene={handleDuplicateScene}
            onDeleteScene={handleDeleteScene}
            onOpenAudioModal={(sceneIdx) => setAudioModalSceneIdx(sceneIdx)}
          />
        </div>

        {/* Right Column: Live Animated Video Player (7 cols on large screen) */}
        <div className="order-1 lg:order-2 lg:col-span-7 h-[420px] lg:h-full overflow-hidden">
          <StickmanCanvas
            project={project}
            activeSceneIndex={activeSceneIndex}
            onSelectScene={setActiveSceneIndex}
            onUpdateAspectRatio={handleUpdateAspectRatio}
            externalCanvasRef={canvasRef}
          />
        </div>
      </main>

      {/* Creative Tools Drawer & Asset Library */}
      <CreativeToolsDrawer
        isOpen={isCreativeToolsOpen}
        onClose={() => setIsCreativeToolsOpen(false)}
        activeScene={project.scenes[activeSceneIndex] || null}
        activeSceneIndex={activeSceneIndex}
        onUpdateScene={handleUpdateScene}
        onSaveSnapshot={handleSaveSnapshot}
        savedSnapshots={savedSnapshots}
        onRestoreSnapshot={handleRestoreSnapshot}
        onLoad12MinEpic={handleLoad12MinEpic}
        project={project}
      />

      {/* ElevenLabs Audio Modal */}
      {audioModalSceneIdx !== null && activeAudioScene && (
        <ElevenLabsAudioModal
          isOpen={true}
          scene={activeAudioScene}
          sceneIndex={audioModalSceneIdx}
          wpm={project.wordsPerMinute || 155}
          onClose={() => setAudioModalSceneIdx(null)}
          onSaveAudio={handleSaveAudio}
        />
      )}

      {/* Script Sync / Chat Exchange Modal */}
      <ScriptSyncModal
        isOpen={isSyncModalOpen}
        project={project}
        onClose={() => setIsSyncModalOpen(false)}
        onLoadProject={(loaded) => {
          setProject(loaded);
          setCurrentPresetKey('custom');
          setActiveSceneIndex(0);
        }}
      />

      {/* Real Video Exporter Modal */}
      <ExportVideoModal
        isOpen={isExportModalOpen}
        project={project}
        canvasRef={canvasRef}
        onClose={() => setIsExportModalOpen(false)}
      />
    </div>
  );
}
