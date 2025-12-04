
import { AudioFeatures } from '../types';

class AudioService {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private source: MediaStreamAudioSourceNode | MediaElementAudioSourceNode | null = null;
  
  private dataArray: Uint8Array | null = null;      // Frequency data
  private timeArray: Uint8Array | null = null;      // Time domain data
  private previousSpectrum: Float32Array | null = null; // For Flux calc
  private bufferLength: number = 0;
  
  // Beat detection state
  private lastBeatTime: number = 0;
  private beatThreshold: number = 0.6;
  private beatDecay: number = 0.98;
  private beatMinInterval: number = 300; 

  async initializeMic(): Promise<void> {
    await this.cleanup();
    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.source = this.audioContext.createMediaStreamSource(stream);
    this.setupAnalyser();
  }

  async initializeFile(element: HTMLAudioElement): Promise<void> {
    await this.cleanup();
    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    this.source = this.audioContext.createMediaElementSource(element);
    this.setupAnalyser();
    this.source.connect(this.audioContext.destination);
  }

  private setupAnalyser() {
    if (!this.audioContext || !this.source) return;
    
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 2048;
    // Lowered from 0.8 to 0.6 for snappier, real-time feel
    this.analyser.smoothingTimeConstant = 0.6; 
    
    this.source.connect(this.analyser);
    
    this.bufferLength = this.analyser.frequencyBinCount;
    this.dataArray = new Uint8Array(this.bufferLength);
    this.timeArray = new Uint8Array(this.bufferLength); // For RMS/Pitch
    this.previousSpectrum = new Float32Array(this.bufferLength);
  }

  getFeatures(): AudioFeatures {
    if (!this.analyser || !this.dataArray || !this.timeArray) {
      return this.getEmptyFeatures();
    }

    this.analyser.getByteFrequencyData(this.dataArray);
    this.analyser.getByteTimeDomainData(this.timeArray);

    // --- 1. Basic Bands ---
    const getAvg = (start: number, end: number) => {
      let sum = 0;
      for (let i = start; i < end; i++) sum += this.dataArray![i];
      return sum / (end - start);
    };
    
    // Ranges approx for 44.1kHz: Bass 20-250Hz, Mid 250-4k, Treble 4k+
    const bass = getAvg(1, 12) / 255;
    const mid = getAvg(12, 185) / 255;
    const treble = getAvg(185, 1024) / 255;
    const energy = (bass + mid + treble) / 3;

    // --- 2. RMS (Loudness) ---
    let rmsSum = 0;
    for (let i = 0; i < this.bufferLength; i++) {
      const val = (this.timeArray[i] - 128) / 128; // Normalize -1 to 1
      rmsSum += val * val;
    }
    const rms = Math.sqrt(rmsSum / this.bufferLength);

    // --- 3. Spectral Centroid & Flux ---
    let numerator = 0;
    let denominator = 0;
    let fluxSum = 0;

    for (let i = 0; i < this.bufferLength; i++) {
      const val = this.dataArray[i] / 255;
      numerator += i * val;
      denominator += val;

      // Flux: Difference from last frame (normalized)
      const prev = this.previousSpectrum ? this.previousSpectrum[i] : 0;
      const diff = val - prev;
      if (diff > 0) fluxSum += diff; // Only positive changes (onsets)
      
      if (this.previousSpectrum) this.previousSpectrum[i] = val;
    }
    
    const spectralCentroid = denominator === 0 ? 0 : (numerator / denominator) / this.bufferLength;
    const spectralFlux = Math.min(1, fluxSum / 100); // Normalize roughly

    // --- 4. Beat Detection ---
    const now = performance.now();
    let isBeat = false;
    if (bass > this.beatThreshold && (now - this.lastBeatTime > this.beatMinInterval)) {
      isBeat = true;
      this.lastBeatTime = now;
      this.beatThreshold = 1.0; 
    } else {
      this.beatThreshold *= this.beatDecay;
      if (this.beatThreshold < 0.35) this.beatThreshold = 0.35;
    }

    // --- 5. Approximate Pitch (Zero Crossing + Max Bin) ---
    // Simple approach: Find bin with max magnitude for dominant frequency
    let maxVal = 0;
    let maxIndex = 0;
    for (let i = 1; i < this.bufferLength; i++) { // Skip DC offset
       if (this.dataArray[i] > maxVal) {
         maxVal = this.dataArray[i];
         maxIndex = i;
       }
    }
    const nyquist = this.audioContext!.sampleRate / 2;
    const pitch = maxVal > 100 ? (maxIndex / this.bufferLength) * nyquist : 0;

    // --- 6. Chroma (Pitch Class Profile) ---
    // Map bins to 12 semitones (C, C#, D...)
    const chroma = new Array(12).fill(0);
    if (pitch > 0) {
       for (let i = 1; i < this.bufferLength; i++) {
          if (this.dataArray[i] < 50) continue; // Noise gate
          
          const freq = (i / this.bufferLength) * nyquist;
          // Midi note number = 69 + 12 * log2(freq/440)
          if (freq > 0) {
             const midi = 69 + 12 * Math.log2(freq / 440);
             const semitone = Math.round(midi) % 12;
             const idx = (semitone + 12) % 12; // Handle negatives safely
             chroma[idx] += this.dataArray[i] / 255;
          }
       }
       // Normalize chroma
       const maxChroma = Math.max(...chroma, 0.001);
       for(let c=0; c<12; c++) chroma[c] /= maxChroma;
    }

    return {
      bass, mid, treble, energy, rms,
      spectralCentroid, spectralFlux, pitch,
      isBeat,
      chroma,
      frequencyData: new Uint8Array(this.dataArray),
      timeData: new Uint8Array(this.timeArray)
    };
  }

  getEmptyFeatures(): AudioFeatures {
    return {
      bass: 0, mid: 0, treble: 0, energy: 0, rms: 0,
      spectralCentroid: 0, spectralFlux: 0, pitch: 0,
      isBeat: false, chroma: new Array(12).fill(0),
      frequencyData: new Uint8Array(0),
      timeData: new Uint8Array(0)
    };
  }

  async cleanup() {
    if (this.source) {
      this.source.disconnect();
    }
    if (this.audioContext && this.audioContext.state !== 'closed') {
      await this.audioContext.close();
    }
    this.source = null;
    this.analyser = null;
    this.audioContext = null;
  }
}

export const audioService = new AudioService();
