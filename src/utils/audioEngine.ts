/**
 * Web Audio Engine for real-time timeline playback, VU meter visualization,
 * procedural synth tracks (lofi beats, ambient cinematic pads), SFX, and user audio buffers.
 */

class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private activeNodes: { stop: () => void }[] = [];
  private isMuted = false;
  private masterVolume = 0.8;

  private initContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.masterVolume;

      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 64;
      this.analyser.smoothingTimeConstant = 0.8;

      this.masterGain.connect(this.analyser);
      this.analyser.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public setVolume(vol: number) {
    this.masterVolume = Math.max(0, Math.min(2, vol));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : this.masterVolume, this.ctx.currentTime);
    }
  }

  public setMute(muted: boolean) {
    this.isMuted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : this.masterVolume, this.ctx.currentTime);
    }
  }

  public stopAll() {
    this.activeNodes.forEach(node => {
      try {
        node.stop();
      } catch {
        // ignore already stopped
      }
    });
    this.activeNodes = [];
  }

  /**
   * Generates procedural beat or ambient chords for sample tracks in the video editor
   */
  public playProceduralTrack(trackType: 'ambient' | 'beat' | 'synth', duration: number, volume = 0.5) {
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    const ctx = this.ctx;
    const now = ctx.currentTime;
    const trackGain = ctx.createGain();
    trackGain.gain.setValueAtTime(volume * 0.4, now);
    trackGain.connect(this.masterGain);

    const oscillators: OscillatorNode[] = [];

    if (trackType === 'ambient') {
      // Gentle cinematic chord progression (Cmaj7 -> Am9 -> Fmaj7 -> G)
      const baseFreqs = [130.81, 164.81, 196.00, 246.94]; // C3, E3, G3, B3
      baseFreqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const oscGain = ctx.createGain();
        osc.type = idx % 2 === 0 ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(freq, now);
        // Subtle chorus vibrato
        const lfo = ctx.createOscillator();
        lfo.frequency.setValueAtTime(0.2 + idx * 0.1, now);
        const lfoGain = ctx.createGain();
        lfoGain.gain.setValueAtTime(2, now);
        lfo.connect(osc.frequency);
        lfo.start(now);
        lfo.stop(now + duration);

        oscGain.gain.setValueAtTime(0.01, now);
        oscGain.gain.exponentialRampToValueAtTime(0.15, now + 1.5);
        oscGain.gain.setValueAtTime(0.15, now + Math.max(0, duration - 1.5));
        oscGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

        osc.connect(oscGain);
        oscGain.connect(trackGain);
        osc.start(now);
        osc.stop(now + duration);
        oscillators.push(osc, lfo);
      });
    } else {
      // Rhythm beat pulse
      const bpm = 110;
      const beatInterval = 60 / bpm;
      const totalBeats = Math.floor(duration / beatInterval);

      for (let i = 0; i < totalBeats; i++) {
        const beatTime = now + i * beatInterval;
        // Kick on 1 & 3
        if (i % 2 === 0) {
          const kick = ctx.createOscillator();
          const kickGain = ctx.createGain();
          kick.frequency.setValueAtTime(120, beatTime);
          kick.frequency.exponentialRampToValueAtTime(30, beatTime + 0.15);
          kickGain.gain.setValueAtTime(0.4, beatTime);
          kickGain.gain.exponentialRampToValueAtTime(0.001, beatTime + 0.18);
          kick.connect(kickGain);
          kickGain.connect(trackGain);
          kick.start(beatTime);
          kick.stop(beatTime + 0.2);
          oscillators.push(kick);
        } else {
          // Snare / Hi-hat on 2 & 4
          const hat = ctx.createOscillator();
          const hatGain = ctx.createGain();
          hat.type = 'triangle';
          hat.frequency.setValueAtTime(800, beatTime);
          hatGain.gain.setValueAtTime(0.15, beatTime);
          hatGain.gain.exponentialRampToValueAtTime(0.001, beatTime + 0.08);
          hat.connect(hatGain);
          hatGain.connect(trackGain);
          hat.start(beatTime);
          hat.stop(beatTime + 0.1);
          oscillators.push(hat);
        }
      }
    }

    const nodeRef = {
      stop: () => {
        oscillators.forEach(o => {
          try {
            o.stop();
          } catch {
            // ignore
          }
        });
        trackGain.disconnect();
      },
    };

    this.activeNodes.push(nodeRef);
  }

  /**
   * Sound effect trigger (click, transition whoosh, cut, pop)
   */
  public playSFX(type: 'click' | 'whoosh' | 'pop' | 'cut' | 'success') {
    this.initContext();
    if (!this.ctx || !this.masterGain) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(this.masterGain);

    if (type === 'click') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1200, now);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
      osc.start(now);
      osc.stop(now + 0.05);
    } else if (type === 'whoosh') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(200, now);
      osc.frequency.exponentialRampToValueAtTime(800, now + 0.15);
      osc.frequency.exponentialRampToValueAtTime(150, now + 0.3);
      gain.gain.setValueAtTime(0.01, now);
      gain.gain.linearRampToValueAtTime(0.15, now + 0.15);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.start(now);
      osc.stop(now + 0.36);
    } else if (type === 'cut') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.exponentialRampToValueAtTime(120, now + 0.08);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      osc.start(now);
      osc.stop(now + 0.09);
    } else if (type === 'pop') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(450, now);
      osc.frequency.exponentialRampToValueAtTime(900, now + 0.06);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
      osc.start(now);
      osc.stop(now + 0.08);
    } else if (type === 'success') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.setValueAtTime(659.25, now + 0.08); // E5
      osc.frequency.setValueAtTime(783.99, now + 0.16); // G5
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.start(now);
      osc.stop(now + 0.36);
    }
  }

  /**
   * Returns current audio meter level (0 to 1) for UI VU meter visualization
   */
  public getMeterLevel(): number {
    if (!this.analyser) return 0;
    const data = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(data);
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      sum += data[i];
    }
    const avg = sum / (data.length * 255);
    return Math.min(1, avg * 1.8);
  }
}

export const audioEngine = new AudioEngine();
