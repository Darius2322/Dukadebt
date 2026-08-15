/* =========================================================
   welcome.js — first-run screen, shown once per device before
   the PIN lock is ever checked. Two paths:
     - "Create New Account": start a fresh, empty local ledger.
     - "Log In": connect the same Google account used before,
       find the existing Drive backup, and restore it.
   Once either path completes, settings.onboardingComplete is
   set and this screen never shows again on this device — daily
   use goes straight to the normal PIN lock (if set) as before.
   ========================================================= */

const Welcome = {
  resolveOnboarded: null,

  // Resolves immediately if onboarding already happened on this
  // device; otherwise shows the screen and resolves once the
  // person picks a path.
  ensureOnboarded() {
    return new Promise((resolve) => {
      if (State.settings.onboardingComplete) { resolve(); return; }
      this.resolveOnboarded = resolve;
      this.show();
    });
  },

  show() {
    document.getElementById('welcomeScreen').style.display = 'flex';
  },

  hide() {
    document.getElementById('welcomeScreen').style.display = 'none';
    if (this.resolveOnboarded) { this.resolveOnboarded(); this.resolveOnboarded = null; }
  },

  async createAccount() {
    State.settings = await DB.saveSettings({ onboardingComplete: true });
    this.hide();
  },

  async login() {
    if (!window.GDrive) { Toast.show('Google login is not available right now.', 'error'); return; }
    if (!GDrive.isConfigured()) {
      Toast.show('Log In with Google isn\'t set up on this app yet. Tap "Create New Account" to continue.', 'error');
      return;
    }
    if (!GDrive.isLibraryLoaded()) {
      Toast.show('Could not reach Google. Check your internet connection and try again.', 'error');
      return;
    }

    const btn = document.getElementById('welcomeLoginBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'Connecting…'; }

    try {
      await GDrive.connect(); // signs in, links an existing backup if one is found, own error toasts
      if (State.settings.googleDriveFileId) {
        await GDrive.restoreFromDrive(); // shows its own confirm dialog; safe to cancel
      } else if (State.settings.googleDriveConnected) {
        Toast.show('No existing backup was found on this Google account. You can start fresh, or try a different account.', 'error');
      }
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = '↺ Log In & Restore My Data'; }
    }

    // Connected (whether or not they went through with restoring) —
    // let them continue into the app. If they skipped restoring,
    // "Restore from Google Drive" remains available in Settings.
    if (State.settings.googleDriveConnected) {
      State.settings = await DB.saveSettings({ onboardingComplete: true });
      this.hide();
    }
  }
};

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('welcomeCreateBtn').addEventListener('click', () => Welcome.createAccount());
  document.getElementById('welcomeLoginBtn').addEventListener('click', () => Welcome.login());
});

window.Welcome = Welcome;
