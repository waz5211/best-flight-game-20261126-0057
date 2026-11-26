// Synthesised sound only — no audio files. A low engine drone whose pitch follows the
// throttle, wind noise that grows with airspeed, and short chimes for rings and landings.
export function createAudio() {
  let ctx = null;
  let engineOsc = null;
  let engineOsc2 = null;
  let engineGain = null;
  let windGain = null;
  let windFilter = null;
  let muted = false;
  let started = false;

  function start() {
    if (started) return;
    started = true;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineOsc2 = ctx.createOscillator();
      engineOsc2.type = 'square';
      engineOsc2.frequency.value = 110;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      const engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 420;
      engineOsc.connect(engineFilter);
      engineOsc2.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(ctx.destination);
      engineOsc.start();
      engineOsc2.start();

      // Looping filtered noise for the wind.
      const len = ctx.sampleRate * 2;
      const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      noise.loop = true;
      windFilter = ctx.createBiquadFilter();
      windFilter.type = 'bandpass';
      windFilter.frequency.value = 700;
      windFilter.Q.value = 0.6;
      windGain = ctx.createGain();
      windGain.gain.value = 0;
      noise.connect(windFilter);
      windFilter.connect(windGain);
      windGain.connect(ctx.destination);
      noise.start();
    } catch {
      ctx = null;
    }
  }

  function update(throttle, speed, airborne) {
    if (!ctx || muted) return;
    const t = ctx.currentTime;
    engineOsc.frequency.setTargetAtTime(48 + throttle * 75, t, 0.1);
    engineOsc2.frequency.setTargetAtTime(96 + throttle * 150, t, 0.1);
    engineGain.gain.setTargetAtTime(0.05 + throttle * 0.075, t, 0.15);
    windGain.gain.setTargetAtTime(airborne ? Math.min(0.16, speed * 0.0018) : 0, t, 0.2);
    windFilter.frequency.setTargetAtTime(500 + speed * 9, t, 0.2);
  }

  function blip(freq, dur, vol, when = 0) {
    if (!ctx || muted) return;
    const t = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(vol, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  return {
    start,
    update,
    ring() { blip(880, 0.35, 0.22); blip(1318, 0.5, 0.18, 0.09); },
    touchdown() { blip(180, 0.25, 0.25); blip(120, 0.3, 0.2, 0.05); },
    crash() { blip(90, 0.7, 0.3); blip(55, 0.9, 0.25, 0.1); },
    win() { [523, 659, 784, 1046].forEach((f, i) => blip(f, 0.5, 0.2, i * 0.13)); },
    toggleMute() {
      muted = !muted;
      if (ctx) {
        engineGain.gain.value = muted ? 0 : 0.05;
        windGain.gain.value = 0;
      }
      return muted;
    },
  };
}
