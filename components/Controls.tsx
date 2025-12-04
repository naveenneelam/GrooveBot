import React, { useState, useEffect } from 'react';
import { Mic, Upload, Settings, ChevronDown, ChevronUp, Music, Play, Plus, Save, Trash2, Activity } from 'lucide-react';
import { AudioFeatures, AudioSourceType, MotionMapping, AudioFeatureKey, DancePose, DanceSequence, DEFAULT_POSE } from '../types';

const NOTE_LABELS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

interface ControlsProps {
  onStartMic: () => void;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  features: AudioFeatures;
  sourceType: AudioSourceType;
  mapping: MotionMapping;
  onUpdateMapping: (key: keyof MotionMapping, value: AudioFeatureKey) => void;
  damping: number;
  onDampingChange: (val: number) => void;
  
  // Sequencer Props
  customSequences: DanceSequence[];
  onSaveSequence: (sequence: DanceSequence) => void;
  onSelectSequence: (id: string | null) => void;
  activeSequenceId: string | null;
  onEditorPoseChange: (pose: DancePose | null) => void; // If null, stop editing
}

const ControlPanel: React.FC<ControlsProps> = ({ 
  onStartMic, 
  onFileSelect, 
  features, 
  sourceType,
  mapping,
  onUpdateMapping,
  damping,
  onDampingChange,
  customSequences,
  onSaveSequence,
  onSelectSequence,
  activeSequenceId,
  onEditorPoseChange
}) => {
  const [showConfig, setShowConfig] = useState(false);
  const [activeTab, setActiveTab] = useState<'analysis' | 'sequencer'>('analysis');
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // --- Sequencer State ---
  const [editorPose, setEditorPose] = useState<DancePose>(DEFAULT_POSE);
  const [sequenceFrames, setSequenceFrames] = useState<DancePose[]>([]);
  const [sequenceName, setSequenceName] = useState("My Cool Dance");
  const [selectedJoint, setSelectedJoint] = useState<keyof DancePose>('lArm');

  // Report editor state to parent
  useEffect(() => {
    if (showConfig && activeTab === 'sequencer') {
      onEditorPoseChange(editorPose);
    } else {
      onEditorPoseChange(null);
    }
  }, [showConfig, activeTab, editorPose, onEditorPoseChange]);

  // Helper to render bar
  const MetricBar = ({ label, value, color }: { label: string, value: number, color: string }) => (
    <div className="flex flex-col gap-1 w-full">
      <div className="flex justify-between text-[10px] uppercase text-gray-400 font-bold tracking-wider">
        <span>{label}</span>
        <span>{value.toFixed(2)}</span>
      </div>
      <div className="h-2 w-full bg-gray-800 rounded-full overflow-hidden">
        <div 
          className={`h-full transition-all duration-75 ${color}`} 
          style={{ width: `${Math.min(value * 100, 100)}%` }} 
        />
      </div>
    </div>
  );

  const MappingSelect = ({ label, settingKey }: { label: string, settingKey: keyof MotionMapping }) => (
    <div className="flex justify-between items-center text-xs">
      <span className="text-gray-400">{label}</span>
      <select 
        value={mapping[settingKey]}
        onChange={(e) => onUpdateMapping(settingKey, e.target.value as AudioFeatureKey)}
        className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white focus:outline-none focus:border-cyan-500"
      >
        <option value="bass">Bass</option>
        <option value="mid">Mid</option>
        <option value="treble">Treble</option>
        <option value="energy">Energy</option>
        <option value="rms">RMS (Loudness)</option>
        <option value="spectralCentroid">Centroid (Bright)</option>
        <option value="spectralFlux">Flux (Onset)</option>
        <option value="pitch">Pitch</option>
      </select>
    </div>
  );

  // Sequencer Helpers
  const updatePose = (axis: 0 | 1 | 2, val: number) => {
    const newPose = { ...editorPose };
    const newJoint = [...newPose[selectedJoint]] as [number, number, number];
    newJoint[axis] = val;
    newPose[selectedJoint] = newJoint;
    setEditorPose(newPose);
  };

  const addFrame = () => {
    setSequenceFrames([...sequenceFrames, { ...editorPose }]);
  };

  const saveSequence = () => {
    if (sequenceFrames.length === 0) return;
    const newSeq: DanceSequence = {
      id: Date.now().toString(),
      name: sequenceName,
      poses: sequenceFrames
    };
    onSaveSequence(newSeq);
    setSequenceFrames([]);
    alert("Sequence Saved!");
  };

  const jointLabels: Record<keyof DancePose, string> = {
    head: "Head", spine: "Spine",
    lArm: "Left Arm", rArm: "Right Arm",
    lLeg: "Left Leg", rLeg: "Right Leg"
  };

  return (
    <div className="absolute bottom-0 left-0 right-0 p-4 z-20 flex flex-col gap-4 pointer-events-none">
      
      {/* Config Drawer */}
      <div className={`mx-auto bg-black/90 backdrop-blur-xl border border-white/10 rounded-xl w-full max-w-3xl transition-all duration-300 pointer-events-auto overflow-hidden shadow-2xl ${showConfig ? 'max-h-[600px] opacity-100 mb-4' : 'max-h-0 opacity-0'}`}>
        
        {/* Tab Header */}
        <div className="flex border-b border-white/10">
          <button 
            onClick={() => setActiveTab('analysis')}
            className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors ${activeTab === 'analysis' ? 'bg-cyan-900/20 text-cyan-400 border-b-2 border-cyan-400' : 'text-gray-500 hover:text-white'}`}
          >
            <div className="flex items-center justify-center gap-2">
              <Activity size={14} /> Analysis & Mapping
            </div>
          </button>
          <button 
            onClick={() => setActiveTab('sequencer')}
            className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors ${activeTab === 'sequencer' ? 'bg-purple-900/20 text-purple-400 border-b-2 border-purple-400' : 'text-gray-500 hover:text-white'}`}
          >
             <div className="flex items-center justify-center gap-2">
              <Music size={14} /> Dance Sequencer
            </div>
          </button>
        </div>

        <div className="p-6">
          {activeTab === 'analysis' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Analysis Column */}
              <div className="space-y-4">
                <h3 className="text-cyan-400 text-xs font-bold uppercase tracking-widest border-b border-white/10 pb-2">Audio Analytics</h3>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                  <MetricBar label="Bass" value={features.bass} color="bg-blue-500" />
                  <MetricBar label="Mid" value={features.mid} color="bg-green-500" />
                  <MetricBar label="Treble" value={features.treble} color="bg-yellow-500" />
                  <MetricBar label="Energy" value={features.energy} color="bg-orange-500" />
                  <MetricBar label="RMS" value={features.rms} color="bg-purple-500" />
                  <MetricBar label="Flux" value={features.spectralFlux} color="bg-red-500" />
                  <MetricBar label="Centroid" value={features.spectralCentroid} color="bg-cyan-500" />
                </div>
                
                {/* Enhanced Pitch & Chroma */}
                <div className="flex flex-col gap-3 bg-gray-900/50 p-3 rounded border border-white/5">
                  <div className="flex justify-between items-end border-b border-gray-800 pb-2">
                    <div>
                        <div className="text-[10px] text-gray-500 uppercase">Dominant Pitch</div>
                        <div className="text-2xl font-mono text-white leading-none mt-1">
                           {features.pitch > 0 ? features.pitch.toFixed(0) : '--'} <span className="text-sm text-gray-600">Hz</span>
                        </div>
                    </div>
                     <div className="flex flex-col items-end">
                         <div className="text-[10px] text-gray-500 uppercase">Status</div>
                        <div className={`text-xs font-bold ${features.isBeat ? 'text-red-500 animate-pulse' : 'text-gray-700'}`}>
                           {features.isBeat ? '● BEAT' : '○ IDLE'}
                        </div>
                     </div>
                  </div>

                  <div>
                    <div className="text-[10px] text-gray-500 uppercase mb-2">Chroma (Pitch Class)</div>
                    <div className="flex items-end h-16 gap-1">
                        {features.chroma.map((v, i) => (
                          <div key={i} className="flex-1 flex flex-col justify-end items-center gap-1 h-full group">
                              <div className="relative w-full h-full flex items-end bg-gray-800/30 rounded-sm overflow-hidden">
                                  <div 
                                      className={`w-full transition-all duration-100 ${v > 0.6 ? 'bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.4)]' : 'bg-cyan-600/40'}`} 
                                      style={{ height: `${Math.min(v * 120, 100)}%` }} 
                                  />
                              </div>
                              <span className={`text-[8px] font-mono ${v > 0.6 ? 'text-cyan-300 font-bold' : 'text-gray-600'}`}>
                                {NOTE_LABELS[i]}
                              </span>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Mapping Column */}
              <div className="space-y-4">
                <h3 className="text-purple-400 text-xs font-bold uppercase tracking-widest border-b border-white/10 pb-2">Motion Mapping</h3>
                <div className="space-y-2">
                  <MappingSelect label="Hip Bounce" settingKey="bounce" />
                  <MappingSelect label="Spine Twist" settingKey="spineTwist" />
                  <MappingSelect label="Arm Wiggle" settingKey="armWiggle" />
                  <MappingSelect label="Head Nod" settingKey="headNod" />
                  <MappingSelect label="Body Pulse" settingKey="scale" />
                  <MappingSelect label="Color Shift" settingKey="colorShift" />
                </div>
                
                {/* Physics Control */}
                <div className="pt-4 border-t border-white/10">
                   <h3 className="text-blue-400 text-xs font-bold uppercase tracking-widest mb-2">Physics Settings</h3>
                   <div className="bg-gray-900/50 p-3 rounded">
                      <div className="flex justify-between text-xs text-gray-400 mb-1">
                        <span>Joint Damping (Stiffness)</span>
                        <span>{damping}</span>
                      </div>
                      <input 
                        type="range" min="1" max="20" step="1"
                        value={damping}
                        onChange={(e) => onDampingChange(parseInt(e.target.value))}
                        className="w-full accent-blue-500 h-1 bg-gray-700 rounded appearance-none cursor-pointer"
                      />
                      <div className="flex justify-between text-[10px] text-gray-600 mt-1">
                        <span>Loose / Bouncy</span>
                        <span>Tight / Rigid</span>
                      </div>
                   </div>
                </div>
              </div>
            </div>
          ) : (
            // --- SEQUENCER UI ---
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 h-full">
              
              {/* Pose Editor */}
              <div className="space-y-4">
                <div className="flex justify-between items-center border-b border-white/10 pb-2">
                  <h3 className="text-purple-400 text-xs font-bold uppercase tracking-widest">Pose Editor</h3>
                  <div className="text-[10px] text-gray-500">Live Preview Active</div>
                </div>

                {/* Joint Selector */}
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(jointLabels) as Array<keyof DancePose>).map((key) => (
                    <button
                      key={key}
                      onClick={() => setSelectedJoint(key)}
                      className={`px-3 py-1 text-xs rounded border transition-colors ${selectedJoint === key ? 'bg-purple-600 border-purple-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700'}`}
                    >
                      {jointLabels[key]}
                    </button>
                  ))}
                </div>

                {/* Sliders */}
                <div className="bg-gray-900/50 p-4 rounded-lg space-y-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-gray-400 uppercase flex justify-between">
                      <span>Rotation X (Pitch)</span>
                      <span>{(editorPose[selectedJoint][0] * 57.29).toFixed(0)}°</span>
                    </label>
                    <input 
                      type="range" min="-3.14" max="3.14" step="0.01" 
                      value={editorPose[selectedJoint][0]}
                      onChange={(e) => updatePose(0, parseFloat(e.target.value))}
                      className="w-full accent-purple-500 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-gray-400 uppercase flex justify-between">
                       <span>Rotation Y (Yaw)</span>
                       <span>{(editorPose[selectedJoint][1] * 57.29).toFixed(0)}°</span>
                    </label>
                    <input 
                      type="range" min="-3.14" max="3.14" step="0.01" 
                      value={editorPose[selectedJoint][1]}
                      onChange={(e) => updatePose(1, parseFloat(e.target.value))}
                      className="w-full accent-purple-500 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-gray-400 uppercase flex justify-between">
                       <span>Rotation Z (Roll)</span>
                       <span>{(editorPose[selectedJoint][2] * 57.29).toFixed(0)}°</span>
                    </label>
                    <input 
                      type="range" min="-3.14" max="3.14" step="0.01" 
                      value={editorPose[selectedJoint][2]}
                      onChange={(e) => updatePose(2, parseFloat(e.target.value))}
                      className="w-full accent-purple-500 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>
                  
                  <button 
                    onClick={addFrame}
                    className="w-full py-2 bg-purple-600 hover:bg-purple-500 text-white rounded text-xs font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-2"
                  >
                    <Plus size={14} /> Add Keyframe
                  </button>
                </div>
              </div>

              {/* Timeline & Library */}
              <div className="space-y-4 flex flex-col h-full">
                <div className="flex justify-between items-center border-b border-white/10 pb-2">
                   <h3 className="text-cyan-400 text-xs font-bold uppercase tracking-widest">Sequence Timeline</h3>
                   <span className="text-[10px] text-gray-400">{sequenceFrames.length} Frames</span>
                </div>

                {/* Frames Visualization */}
                <div className="flex gap-1 overflow-x-auto pb-2 h-16 items-center bg-gray-900/30 p-2 rounded border border-white/5">
                  {sequenceFrames.length === 0 ? (
                    <div className="w-full text-center text-xs text-gray-600 italic">No frames added yet. Add pose to start.</div>
                  ) : (
                    sequenceFrames.map((_, idx) => (
                      <div key={idx} className="min-w-[20px] h-full bg-purple-500/50 border border-purple-400/30 rounded flex items-center justify-center text-[8px] text-white">
                        {idx + 1}
                      </div>
                    ))
                  )}
                </div>

                {/* Save Controls */}
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={sequenceName}
                    onChange={(e) => setSequenceName(e.target.value)}
                    className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 text-xs text-white"
                    placeholder="Sequence Name"
                  />
                  <button onClick={saveSequence} className="px-4 py-2 bg-green-600 hover:bg-green-500 rounded text-white text-xs font-bold uppercase"><Save size={14}/></button>
                  <button onClick={() => setSequenceFrames([])} className="px-4 py-2 bg-red-900/50 hover:bg-red-900 rounded text-white text-xs"><Trash2 size={14}/></button>
                </div>

                <div className="border-t border-white/10 pt-4 mt-2 flex-1 flex flex-col min-h-0">
                  <h3 className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-2">Saved Sequences</h3>
                  <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                    {customSequences.length === 0 && <div className="text-xs text-gray-600">No custom sequences saved.</div>}
                    {customSequences.map(seq => (
                      <button 
                        key={seq.id}
                        onClick={() => onSelectSequence(activeSequenceId === seq.id ? null : seq.id)}
                        className={`w-full flex justify-between items-center p-2 rounded text-xs transition-colors border ${activeSequenceId === seq.id ? 'bg-cyan-900/40 border-cyan-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700'}`}
                      >
                         <span>{seq.name}</span>
                         {activeSequenceId === seq.id && <div className="flex items-center gap-1 text-cyan-400"><Play size={10} className="fill-current"/> Playing</div>}
                      </button>
                    ))}
                    <button 
                        onClick={() => onSelectSequence(null)}
                        className={`w-full text-left p-2 rounded text-xs transition-colors border ${activeSequenceId === null ? 'bg-cyan-900/40 border-cyan-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700'}`}
                      >
                         <span>Default Procedural Dance</span>
                         {activeSequenceId === null && <span className="float-right text-cyan-400 text-[10px]">Active</span>}
                      </button>
                  </div>
                </div>
              </div>

            </div>
          )}
        </div>
      </div>

      {/* Main Bar */}
      <div className="mx-auto flex items-center justify-between gap-4 bg-black/60 backdrop-blur-md border border-white/10 p-3 rounded-full pointer-events-auto">
        
        {/* Source Controls */}
        <div className="flex gap-2">
          <button
            onClick={onStartMic}
            className={`p-3 rounded-full transition-all ${sourceType === 'mic' ? 'bg-red-500 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
            title="Use Microphone"
          >
            <Mic size={20} />
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className={`p-3 rounded-full transition-all ${sourceType === 'file' ? 'bg-indigo-500 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
            title="Upload Audio"
          >
            <Upload size={20} />
          </button>
          <input type="file" ref={fileInputRef} accept="audio/*" className="hidden" onChange={onFileSelect} />
        </div>

        {/* Mini Visualizer */}
        <div className="flex items-center gap-4 px-4 h-10 border-l border-r border-white/10 min-w-[200px]">
          <div className="flex flex-col justify-center gap-1 w-full">
            <div className="flex justify-between text-[10px] text-gray-400 font-mono">
               <span>{features.isBeat ? ">> BEAT <<" : "DETECTING"}</span>
               <span>{features.pitch > 0 ? `${features.pitch.toFixed(0)}Hz` : "--"}</span>
            </div>
            {/* Frequency Canvas Simulation (CSS bars) */}
            <div className="flex items-end h-4 gap-[2px]">
               {[...Array(20)].map((_, i) => {
                  // Resample 1024 bins to 20 bars roughly
                  const idx = Math.floor(i * (features.frequencyData.length / 20));
                  const val = features.frequencyData[idx] || 0;
                  return (
                    <div key={i} className="flex-1 bg-white/80 rounded-t-[1px]" style={{ height: `${(val / 255) * 100}%` }} />
                  );
               })}
            </div>
          </div>
        </div>

        {/* Config Toggle */}
        <button 
          onClick={() => setShowConfig(!showConfig)}
          className={`p-3 rounded-full transition-all flex items-center gap-2 ${showConfig ? 'bg-cyan-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
        >
          <Settings size={20} />
          {showConfig ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
        </button>

      </div>
    </div>
  );
};

export default ControlPanel;