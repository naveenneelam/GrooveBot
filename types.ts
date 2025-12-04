
export type AudioFeatureKey = 
  | 'bass' 
  | 'mid' 
  | 'treble' 
  | 'energy' 
  | 'rms' 
  | 'spectralCentroid' 
  | 'spectralFlux' 
  | 'pitch';

export interface AudioFeatures {
  // Frequency Bands (Normalized 0-1)
  bass: number;
  mid: number;
  treble: number;
  
  // Time/Energy Domain
  energy: number;    // Smoothed amplitude
  rms: number;       // Root Mean Square (Loudness)
  
  // Spectral Domain
  spectralCentroid: number; // Brightness (0-1)
  spectralFlux: number;     // Rate of change (0-1)
  chroma: number[];         // 12-bin pitch class profile
  pitch: number;            // Dominant frequency in Hz
  
  // Events
  isBeat: boolean;
  
  // Raw for visualization
  frequencyData: Uint8Array;
  timeData: Uint8Array;
}

export interface MotionMapping {
  bounce: AudioFeatureKey;    // Hips Y
  spineTwist: AudioFeatureKey;// Spine Rotation
  armWiggle: AudioFeatureKey; // Arm wave intensity
  headNod: AudioFeatureKey;   // Head pitch
  scale: AudioFeatureKey;     // Overall size pulse
  colorShift: AudioFeatureKey;// Material color
  legKick: AudioFeatureKey;
  elbowFlex: AudioFeatureKey;
}

export const FEATURE_COLORS: Record<AudioFeatureKey, string> = {
  bass: '#3b82f6',             // Blue-500
  mid: '#22c55e',              // Green-500
  treble: '#eab308',           // Yellow-500
  energy: '#ef4444',           // Red-500
  rms: '#a855f7',              // Purple-500
  spectralCentroid: '#06b6d4', // Cyan-500
  spectralFlux: '#ec4899',     // Pink-500
  pitch: '#f97316'             // Orange-500
};

export const DEFAULT_MAPPING: MotionMapping = {
  bounce: 'bass',
  spineTwist: 'mid',
  armWiggle: 'energy',
  headNod: 'spectralFlux',
  scale: 'energy',
  colorShift: 'spectralCentroid',
  legKick: 'bass',
  elbowFlex: 'treble'
};

export type AudioSourceType = 'mic' | 'file' | 'none';
export type PlaybackStatus = 'playing' | 'paused' | 'stopped' | 'none';
export type SolverMode = 'physics' | 'ik';

// --- Sequencer Types ---

export type Vector3Tuple = [number, number, number];

export interface DancePose {
  head: Vector3Tuple;
  spine: Vector3Tuple;
  lArm: Vector3Tuple;
  rArm: Vector3Tuple;
  lLeg: Vector3Tuple;
  rLeg: Vector3Tuple;
}

export interface DanceSequence {
  id: string;
  name: string;
  poses: DancePose[];
}

export const DEFAULT_POSE: DancePose = {
  head: [0, 0, 0],
  spine: [0, 0, 0],
  lArm: [0, 0, 0.3],
  rArm: [0, 0, -0.3],
  lLeg: [0, 0, 0],
  rLeg: [0, 0, 0]
};