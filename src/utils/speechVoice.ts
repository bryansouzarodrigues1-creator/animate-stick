/**
 * Web Speech Synthesis engine for natural AI Voiceover / Narration.
 * Synchronizes spoken lines to timeline timestamps.
 */

class VoiceNarrationEngine {
  private synth: SpeechSynthesis | null = null;
  private isSpeaking = false;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private voiceEnabled = true;

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.synth = window.speechSynthesis;
    }
  }

  public setVoiceEnabled(enabled: boolean) {
    this.voiceEnabled = enabled;
    if (!enabled) {
      this.stop();
    }
  }

  public isEnabled(): boolean {
    return this.voiceEnabled;
  }

  public stop() {
    if (this.synth) {
      this.synth.cancel();
      this.isSpeaking = false;
    }
  }

  public speak(text: string, lang = 'pt-BR', rate = 1.0, pitch = 1.0) {
    if (!this.synth || !this.voiceEnabled || !text.trim()) return;

    this.stop();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = rate;
    utterance.pitch = pitch;

    // Pick best natural voice if available
    const voices = this.synth.getVoices();
    const ptVoice = voices.find((v) => v.lang.startsWith('pt') || v.lang.includes('BR'));
    if (ptVoice) {
      utterance.voice = ptVoice;
    }

    utterance.onend = () => {
      this.isSpeaking = false;
    };

    utterance.onerror = () => {
      this.isSpeaking = false;
    };

    this.isSpeaking = true;
    this.currentUtterance = utterance;
    this.synth.speak(utterance);
  }
}

export const voiceNarration = new VoiceNarrationEngine();
