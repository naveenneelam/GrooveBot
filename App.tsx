
import React, { useState, useEffect, useRef, useCallback } from 'react';
import Scene from './components/Scene';
import Controls from './components/Controls';
import { audioService } from './services/audioService';
import { AudioFeatures, AudioSourceType, MotionMapping, DEFAULT_MAPPING, AudioFeatureKey, DanceSequence, DancePose, PlaybackStatus, SolverMode } from './types';

function App() {
  const [sourceType, setSourceType] = useState<AudioSourceType>('none');
  const [playbackStatus, setPlaybackStatus] = useState<PlaybackStatus>('none');
  const [mapping, setMapping] = useState<MotionMapping>(DEFAULT_MAPPING);
  const [features, setFeatures] = useState<AudioFeatures>(audioService.getEmptyFeatures());
  const [damping, setDamping] = useState<number>(6);
  const [solverMode, setSolverMode] = useState<SolverMode>('physics');
  
  // Sequencer State
  const [customSequences, setCustomSequences] = useState<DanceSequence[]>([]);
  const [activeSequenceId, setActiveSequenceId] = useState<string | null>(null);
  const [editorPose, setEditorPose] = useState<DancePose | null>(null);

  const rafRef = useRef<number>(0);
  const fileAudioElementRef = useRef<HTMLAudioElement | null>(null);

  const updateFeatures = useCallback(() => {
    const data = audioService.getFeatures();
    setFeatures(data);
    rafRef.current = requestAnimationFrame(updateFeatures);
  }, []);

  useEffect(() => {
    if (sourceType !== 'none') {
      rafRef.current = requestAnimationFrame(updateFeatures);
    }
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [sourceType, updateFeatures]);

  const handleMicStart = async () => {
    try {
      await audioService.initializeMic();
      setSourceType('mic');
      setPlaybackStatus('playing');
      if (fileAudioElementRef.current) {
        fileAudioElementRef.current.pause();
        fileAudioElementRef.current = null;
      }
    } catch (e) {
      console.error("Mic Error:", e);
      alert("Could not access microphone. Please allow permissions.");
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    const audio = new Audio(url);
    fileAudioElementRef.current = audio;
    
    // Playback listeners
    audio.onplay = () => setPlaybackStatus('playing');
    audio.onpause = () => setPlaybackStatus('paused');
    audio.onended = () => {
      setPlaybackStatus('stopped');
      // We do NOT set sourceType to 'none' here so the user can replay
    };
    
    try {
      await audio.play(); 
      await audioService.initializeFile(audio);
      setSourceType('file');
    } catch (err) {
      console.error("File Playback Error", err);
    }
  };

  // Playback Controls
  const handleTogglePlay = () => {
    if (!fileAudioElementRef.current) return;
    if (fileAudioElementRef.current.paused) {
      fileAudioElementRef.current.play();
    } else {
      fileAudioElementRef.current.pause();
    }
  };

  const handleStop = () => {
    if (!fileAudioElementRef.current) return;
    fileAudioElementRef.current.pause();
    fileAudioElementRef.current.currentTime = 0;
    setPlaybackStatus('stopped');
  };

  const handleReplay = () => {
    if (!fileAudioElementRef.current) return;
    fileAudioElementRef.current.currentTime = 0;
    fileAudioElementRef.current.play();
  };

  const handleUpdateMapping = (key: keyof MotionMapping, value: AudioFeatureKey) => {
    setMapping(prev => ({ ...prev, [key]: value }));
  };

  // Sequencer Handlers
  const handleSaveSequence = (seq: DanceSequence) => {
    setCustomSequences(prev => [...prev, seq]);
  };

  const activeSequence = customSequences.find(s => s.id === activeSequenceId) || null;

  return (
    <div className="relative w-full h-full bg-black overflow-hidden">
      {/* 3D Scene */}
      <div className="absolute inset-0 z-0">
        <Scene 
          features={features} 
          mapping={mapping} 
          editorPose={editorPose}
          activeSequence={activeSequence}
          damping={damping}
        />
      </div>

      {/* Overlay Title */}
      <div className="absolute top-8 left-8 z-10 pointer-events-none">
        <h1 className="text-5xl font-black text-white tracking-tighter drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]">
          GROOVE<span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-500">BOT</span>
        </h1>
        <p className="text-gray-400 mt-2 font-mono text-xs max-w-xs">
          Advanced Audio Kinematics<br/>
          RMS • Flux • Pitch • Chroma
        </p>
      </div>

      {/* Control Bar */}
      <Controls 
        onStartMic={handleMicStart}
        onFileSelect={handleFileSelect}
        features={features}
        sourceType={sourceType}
        playbackStatus={playbackStatus}
        onTogglePlay={handleTogglePlay}
        onStop={handleStop}
        onReplay={handleReplay}
        mapping={mapping}
        onUpdateMapping={handleUpdateMapping}
        damping={damping}
        onDampingChange={setDamping}
        solverMode={solverMode}
        onSolverModeChange={setSolverMode}
        
        // Sequencer props
        customSequences={customSequences}
        onSaveSequence={handleSaveSequence}
        onSelectSequence={setActiveSequenceId}
        activeSequenceId={activeSequenceId}
        onEditorPoseChange={setEditorPose}
      />
    </div>
  );
}

export default App;