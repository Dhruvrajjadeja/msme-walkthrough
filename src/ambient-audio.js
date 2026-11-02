// Recording is loaded only after an explicit music-button click.
export function setupAmbientAudio(button) {
  const audio = new Audio();
  audio.preload = 'none';
  audio.loop = true;
  audio.volume = .16;
  let enabled = false;
  let revision = 0;
  const update = (message) => {
    button.setAttribute('aria-pressed', String(enabled));
    button.title = button.ariaLabel = message || (enabled
      ? 'Pause calm music — Meditation Impromptu 01 by Kevin MacLeod'
      : 'Play calm music — Meditation Impromptu 01 by Kevin MacLeod');
  };
  async function reconcile() {
    const current = ++revision;
    if (!enabled || document.hidden) { audio.pause(); return; }
    try {
      await audio.play();
      if (!enabled || document.hidden) audio.pause();
    } catch {
      if (current !== revision) return;
      enabled = false;
      update('Music unavailable; tap to retry');
    }
  }
  button.onclick = () => {
    if (!audio.src) audio.src = import.meta.env.BASE_URL + 'audio/meditation.mp3';
    enabled = !enabled;
    update();
    void reconcile();
  };
  audio.addEventListener('error', () => {
    enabled = false;
    update('Music could not load; tap to retry');
    audio.removeAttribute('src');
    audio.load();
  });
  document.addEventListener('visibilitychange', reconcile);
  window.addEventListener('pagehide', () => { ++revision; audio.pause(); });
  window.addEventListener('pageshow', reconcile);
  update();
}
