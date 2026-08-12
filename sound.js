/* =========================================================
   sound.js — notification sound + optional OS notifications

   The chime is generated with the Web Audio API so it works
   fully offline with no external audio file. When the person
   enables push notifications, real OS notifications are also
   fired for key events — those use the device's own default
   notification sound, set by the phone, not by this app.
   ========================================================= */

const Sound = {
  ctx: null,

  getContext() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    return this.ctx;
  },

  // A short, pleasant two-note chime — not a system sound file, but a
  // synthesized cue so the app has audible feedback fully offline.
  chime() {
    if (!State.settings || !State.settings.soundEnabled) return;
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      [[880, now, 0.11], [1318.5, now + 0.09, 0.16]].forEach(([freq, start, dur]) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(0.16, start + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
        osc.connect(gain).connect(ctx.destination);
        osc.start(start);
        osc.stop(start + dur + 0.02);
      });
    } catch (e) { /* ignore audio failures silently */ }
  },

  async requestPushPermission() {
    if (!('Notification' in window)) return 'unsupported';
    if (Notification.permission === 'granted') return 'granted';
    if (Notification.permission === 'denied') return 'denied';
    try { return await Notification.requestPermission(); }
    catch (e) { return 'denied'; }
  },

  // Fires a real OS notification (uses the device's own default sound)
  // in addition to the in-app chime + toast.
  notify(title, body) {
    if (!State.settings || !State.settings.pushEnabled) return;
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    try {
      const reg = navigator.serviceWorker && navigator.serviceWorker.controller ? null : null;
      if (navigator.serviceWorker && navigator.serviceWorker.ready) {
        navigator.serviceWorker.ready.then(r => r.showNotification(title, { body, icon: './icon-192.png', badge: './icon-72.png' })).catch(() => {
          new Notification(title, { body, icon: './icon-192.png' });
        });
      } else {
        new Notification(title, { body, icon: './icon-192.png' });
      }
    } catch (e) { /* ignore */ }
  },

  // Convenience: play the chime + fire an OS notification + log to history.
  async announce(type, title, body, opts = {}) {
    this.chime();
    this.notify(title, body);
    await DB.logActivity(type, body, opts);
    if (window.Notifications) Notifications.refreshBadge();
  }
};

window.Sound = Sound;
