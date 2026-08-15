/* =========================================================
   stats.js — anonymous install/active-user counter (client side)

   Generates a random device ID (no personal data) once per
   device and stores it locally. When online, pings /api/track
   which records this device as "seen" and returns the current
   total device count (Downloads) and count seen in the last 30
   days (Active Users). Results are cached locally so the numbers
   still display (as "last known") when offline.
   ========================================================= */

const Stats = {
  async getDeviceId() {
    if (State.settings.deviceId) return State.settings.deviceId;
    const id = (crypto.randomUUID ? crypto.randomUUID() : `dev-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    State.settings = await DB.saveSettings({ deviceId: id });
    return id;
  },

  async ping() {
    if (!navigator.onLine) { this.render(); return; }
    try {
      const deviceId = await this.getDeviceId();
      const res = await fetch(`/api/track?deviceId=${encodeURIComponent(deviceId)}`);
      const data = await res.json();
      if (data && data.ok) {
        State.settings = await DB.saveSettings({
          lastKnownTotalDownloads: data.totalDownloads,
          lastKnownActiveUsers: data.activeUsers,
          statsUpdatedAt: new Date().toISOString()
        });
      }
    } catch (err) {
      // Offline or endpoint unreachable — fine, we just show cached numbers.
    }
    this.render();
  },

  render() {
    const totalEl = document.getElementById('statTotalDownloads');
    const activeEl = document.getElementById('statActiveUsers');
    if (!totalEl || !activeEl) return;
    const s = State.settings || {};
    totalEl.textContent = (typeof s.lastKnownTotalDownloads === 'number') ? s.lastKnownTotalDownloads.toLocaleString() : '—';
    activeEl.textContent = (typeof s.lastKnownActiveUsers === 'number') ? s.lastKnownActiveUsers.toLocaleString() : '—';
  }
};

window.Stats = Stats;
