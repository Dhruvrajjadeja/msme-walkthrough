export function setupAmbientAudio(button) {
  let context, master, timer, enabled = false, step = 0, next = 0;
  const notes = [130.81, 196, 261.63, 293.66, 392, 293.66, 261.63, 196];
  function schedule() {
    while (next < context.currentTime + 3) {
      const pitch = notes[step++ % notes.length];
      for (const [frequency, level] of [[pitch, .035], [pitch / 2, .025], [pitch * 1.5, .008]]) {
        const voice = context.createOscillator(), envelope = context.createGain();
        voice.type = 'sine'; voice.frequency.value = frequency;
        envelope.gain.setValueAtTime(0, next);
        envelope.gain.linearRampToValueAtTime(level, next + 1.5);
        envelope.gain.exponentialRampToValueAtTime(.0001, next + 7);
        voice.connect(envelope).connect(master); voice.start(next); voice.stop(next + 7.1);
        voice.onended = () => { voice.disconnect(); envelope.disconnect(); };
      }
      next += 3.5;
    }
  }
  button.onclick = async () => {
    button.disabled = true;
    try {
      if (!context) {
        context = new AudioContext(); master = context.createGain();
        master.gain.value = .65; master.connect(context.destination);
      }
      if (enabled) { clearInterval(timer); await context.suspend(); }
      else {
        await context.resume();
        if (!step) next = context.currentTime + .1;
        schedule(); timer = setInterval(schedule, 1000);
      }
      enabled = !enabled;
      button.setAttribute('aria-pressed', String(enabled));
      button.title = button.ariaLabel = enabled ? 'Mute ambient music' : 'Play ambient music';
    } catch { button.title = button.ariaLabel = 'Audio unavailable; try again'; }
    finally { button.disabled = false; }
  };
  document.addEventListener('visibilitychange', async () => {
    if (!enabled || !context) return;
    if (document.hidden) { clearInterval(timer); await context.suspend(); }
    else { await context.resume(); schedule(); timer = setInterval(schedule, 1000); }
  });
}
