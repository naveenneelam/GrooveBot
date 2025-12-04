
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
}

export const DEFAULT_MAPPING: MotionMapping = {
  bounce: 'bass',
  spineTwist: 'mid',
  armWiggle: 'energy',
  headNod: 'spectralFlux',
  scale: 'rms',
  colorShift: 'spectralCentroid'
};

export type AudioSourceType = 'mic' | 'file' | 'none';

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
