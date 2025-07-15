import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface AudioContextType {
  isEnabled: boolean;
  setEnabled: (enabled: boolean) => void;
  playSound: (type: SoundType) => void;
}

export type SoundType = 'click' | 'correct' | 'incorrect' | 'complete' | 'navigate' | 'error';

const AudioContext = createContext<AudioContextType | undefined>(undefined);

const AUDIO_STORAGE_KEY = 'nlj_audio_enabled';

// Sound configuration for different types
const SOUND_CONFIG: Record<SoundType, {
  frequency: number;
  duration: number;
  type: OscillatorType;
  volume: number;
  envelope?: {
    attack: number;
    decay: number;
    sustain: number;
    release: number;
  };
}> = {
  click: {
    frequency: 800,
    duration: 100,
    type: 'sine',
    volume: 0.3,
    envelope: { attack: 0.01, decay: 0.1, sustain: 0.3, release: 0.1 }
  },
  correct: {
    frequency: 523.25, // C5
    duration: 300,
    type: 'sine',
    volume: 0.4,
    envelope: { attack: 0.02, decay: 0.1, sustain: 0.7, release: 0.2 }
  },
  incorrect: {
    frequency: 220, // A3
    duration: 400,
    type: 'sawtooth',
    volume: 0.3,
    envelope: { attack: 0.01, decay: 0.3, sustain: 0.1, release: 0.2 }
  },
  complete: {
    frequency: 659.25, // E5
    duration: 600,
    type: 'sine',
    volume: 0.5,
    envelope: { attack: 0.05, decay: 0.2, sustain: 0.8, release: 0.3 }
  },
  navigate: {
    frequency: 440, // A4
    duration: 150,
    type: 'triangle',
    volume: 0.25,
    envelope: { attack: 0.01, decay: 0.05, sustain: 0.5, release: 0.1 }
  },
  error: {
    frequency: 150,
    duration: 500,
    type: 'square',
    volume: 0.2,
    envelope: { attack: 0.01, decay: 0.4, sustain: 0.1, release: 0.1 }
  }
};

class AudioManager {
  private audioContext: AudioContext | null = null;
  private masterGain: GainNode | null = null;

  constructor() {
    this.initializeAudio();
  }

  private initializeAudio() {
    try {
      // Create AudioContext on first user interaction
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.masterGain = this.audioContext.createGain();
      this.masterGain.connect(this.audioContext.destination);
      this.masterGain.gain.value = 0.5; // Master volume
    } catch (error) {
      console.warn('Web Audio API not supported:', error);
    }
  }

  private async ensureAudioContext() {
    if (!this.audioContext) return false;
    
    if (this.audioContext.state === 'suspended') {
      try {
        await this.audioContext.resume();
      } catch (error) {
        console.warn('Failed to resume audio context:', error);
        return false;
      }
    }
    return true;
  }

  async playSound(type: SoundType) {
    if (!this.audioContext || !this.masterGain) return;
    
    const canPlay = await this.ensureAudioContext();
    if (!canPlay) return;

    const config = SOUND_CONFIG[type];
    const currentTime = this.audioContext.currentTime;
    
    // Create oscillator
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    // Connect nodes
    oscillator.connect(gainNode);
    gainNode.connect(this.masterGain);
    
    // Configure oscillator
    oscillator.type = config.type;
    oscillator.frequency.value = config.frequency;
    
    // Configure envelope
    const envelope = config.envelope;
    if (envelope) {
      const attackTime = currentTime + envelope.attack;
      const decayTime = attackTime + envelope.decay;
      const releaseTime = currentTime + (config.duration / 1000) - envelope.release;
      const endTime = releaseTime + envelope.release;
      
      // Attack
      gainNode.gain.setValueAtTime(0, currentTime);
      gainNode.gain.linearRampToValueAtTime(config.volume, attackTime);
      
      // Decay
      gainNode.gain.linearRampToValueAtTime(config.volume * envelope.sustain, decayTime);
      
      // Sustain (hold current value)
      gainNode.gain.setValueAtTime(config.volume * envelope.sustain, releaseTime);
      
      // Release
      gainNode.gain.linearRampToValueAtTime(0, endTime);
    } else {
      // Simple volume envelope
      gainNode.gain.setValueAtTime(config.volume, currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, currentTime + (config.duration / 1000));
    }
    
    // Start and stop oscillator
    oscillator.start(currentTime);
    oscillator.stop(currentTime + (config.duration / 1000));
  }

  // Add some musical sequences for special events
  async playSequence(type: 'success' | 'failure') {
    if (!this.audioContext) return;

    const sequences = {
      success: [
        { frequency: 523.25, duration: 200 }, // C5
        { frequency: 659.25, duration: 200 }, // E5
        { frequency: 783.99, duration: 300 }, // G5
      ],
      failure: [
        { frequency: 220, duration: 300 }, // A3
        { frequency: 196, duration: 300 }, // G3
        { frequency: 174.61, duration: 400 }, // F3
      ]
    };

    const sequence = sequences[type];
    for (let i = 0; i < sequence.length; i++) {
      setTimeout(() => {
        this.playTone(sequence[i].frequency, sequence[i].duration, 'sine', 0.3);
      }, i * 250);
    }
  }

  private async playTone(frequency: number, duration: number, type: OscillatorType, volume: number) {
    if (!this.audioContext || !this.masterGain) return;
    
    const canPlay = await this.ensureAudioContext();
    if (!canPlay) return;

    const currentTime = this.audioContext.currentTime;
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(this.masterGain);
    
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    
    gainNode.gain.setValueAtTime(volume, currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, currentTime + (duration / 1000));
    
    oscillator.start(currentTime);
    oscillator.stop(currentTime + (duration / 1000));
  }
}

export const AudioProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isEnabled, setIsEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem(AUDIO_STORAGE_KEY);
    return saved ? JSON.parse(saved) : false; // Default to disabled
  });

  const [audioManager] = useState(() => new AudioManager());

  const setEnabled = (enabled: boolean) => {
    setIsEnabled(enabled);
    localStorage.setItem(AUDIO_STORAGE_KEY, JSON.stringify(enabled));
  };

  const playSound = (type: SoundType) => {
    if (isEnabled) {
      audioManager.playSound(type);
    }
  };

  return (
    <AudioContext.Provider value={{ isEnabled, setEnabled, playSound }}>
      {children}
    </AudioContext.Provider>
  );
};

export const useAudio = () => {
  const context = useContext(AudioContext);
  if (context === undefined) {
    throw new Error('useAudio must be used within an AudioProvider');
  }
  return context;
};