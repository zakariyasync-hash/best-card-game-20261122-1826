// Sound, made, not fetched: a few WebAudio tones, so the game needs no audio files
// and no network. Everything starts from a user gesture (the first click or key),
// which is also what browsers require before any sound plays.
export function createSound() {
  let context = null;
  let muted = false;

  function ensure() {
    if (!context) {
      try {
        context = new (window.AudioContext || window.webkitAudioContext)();
      } catch {
        context = null;
      }
    }
    if (context && context.state === 'suspended') void context.resume();
    return context;
  }

  function tone(freq, dur, type, gain, when = 0, slideTo = 0) {
    if (muted) return;
    const ctx = ensure();
    if (!ctx) return;
    const start = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, start + dur);
    amp.gain.setValueAtTime(0.0001, start);
    amp.gain.exponentialRampToValueAtTime(gain, start + 0.012);
    amp.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(amp);
    amp.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + dur + 0.05);
  }

  return {
    unlock() {
      ensure();
    },
    toggleMute() {
      muted = !muted;
      return muted;
    },
    isMuted() {
      return muted;
    },
    draw() {
      tone(520, 0.07, 'triangle', 0.08);
    },
    play() {
      tone(240, 0.1, 'square', 0.06, 0, 180);
    },
    hit() {
      tone(150, 0.18, 'sawtooth', 0.1, 0, 70);
      tone(90, 0.22, 'square', 0.07, 0.02, 55);
    },
    shield() {
      tone(660, 0.12, 'sine', 0.07, 0, 880);
    },
    heal() {
      tone(440, 0.1, 'sine', 0.07);
      tone(660, 0.14, 'sine', 0.07, 0.09);
    },
    turn() {
      tone(392, 0.09, 'triangle', 0.07);
      tone(523, 0.12, 'triangle', 0.07, 0.08);
    },
    win() {
      [523, 659, 784, 1047].forEach((freq, i) => tone(freq, 0.22, 'triangle', 0.09, i * 0.13));
    },
    lose() {
      [392, 330, 262, 196].forEach((freq, i) => tone(freq, 0.25, 'triangle', 0.08, i * 0.15));
    },
  };
}
