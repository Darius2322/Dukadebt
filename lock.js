/* =========================================================
   lock.js — PIN lock screen and optional biometric unlock.

   PINs are never stored in plain text: a random salt is
   generated once and the PIN is hashed with SHA-256 before
   being saved to IndexedDB.

   Fingerprint/face unlock uses the device's own platform
   authenticator (WebAuthn). Because this app has no backend,
   there is no server to verify the cryptographic signature
   against — unlocking relies on the authenticator only
   returning a successful result after the device's own
   biometric check passes. The PIN remains the ultimate
   fallback and source of truth.
   ========================================================= */

const Lock = {
  enteredPin: '',
  resolveUnlock: null,

  async sha256Hex(text) {
    const enc = new TextEncoder().encode(text);
    const buf = await crypto.subtle.digest('SHA-256', enc);
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  },

  randomSalt() {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  },

  async hashPin(pin, salt) {
    return this.sha256Hex(salt + ':' + pin);
  },

  // Returns a promise that resolves once the app is unlocked (or immediately if no PIN is set).
  ensureUnlocked() {
    return new Promise((resolve) => {
      if (!State.settings.pinHash) { resolve(); return; }
      this.resolveUnlock = resolve;
      this.show();
    });
  },

  show() {
    document.getElementById('lockScreen').style.display = 'flex';
    document.getElementById('app').style.display = 'none';
    this.enteredPin = '';
    this.renderDots();
    document.getElementById('lockError').textContent = '\u00A0';
    document.getElementById('pinBioBtn').style.visibility = State.settings.biometricEnabled ? 'visible' : 'hidden';
    if (State.settings.biometricEnabled) {
      setTimeout(() => this.tryBiometric(), 350);
    }
  },

  hide() {
    document.getElementById('lockScreen').style.display = 'none';
    document.getElementById('app').style.display = '';
    if (this.resolveUnlock) { this.resolveUnlock(); this.resolveUnlock = null; }
  },

  renderDots() {
    const dots = document.querySelectorAll('#pinDots .pin-dot');
    dots.forEach((d, i) => d.classList.toggle('filled', i < this.enteredPin.length));
  },

  async handleKey(key) {
    if (key === 'bio') { this.tryBiometric(); return; }
    if (key === 'back') { this.enteredPin = this.enteredPin.slice(0, -1); this.renderDots(); return; }
    if (this.enteredPin.length >= 6) return;
    this.enteredPin += key;
    this.renderDots();

    if (this.enteredPin.length < 4) return;

    const hash = await this.hashPin(this.enteredPin, State.settings.pinSalt);
    if (hash === State.settings.pinHash) { this.hide(); return; }

    if (this.enteredPin.length === 6) { this.showError(); return; }

    // At 4 or 5 digits: give the person a brief moment to keep typing
    // a longer PIN before treating this as a wrong attempt.
    const snapshot = this.enteredPin;
    setTimeout(async () => {
      if (this.enteredPin !== snapshot) return; // they kept typing
      const h2 = await this.hashPin(this.enteredPin, State.settings.pinSalt);
      if (h2 !== State.settings.pinHash) this.showError();
    }, 400);
  },

  showError() {
    document.getElementById('lockError').textContent = 'Incorrect PIN. Try again.';
    const dots = document.getElementById('pinDots');
    dots.classList.add('shake');
    setTimeout(() => { dots.classList.remove('shake'); }, 300);
    this.enteredPin = '';
    this.renderDots();
  },

  async biometricAvailable() {
    if (!window.PublicKeyCredential || !PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable) return false;
    try { return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable(); }
    catch (e) { return false; }
  },

  async registerBiometric() {
    try {
      const challenge = crypto.getRandomValues(new Uint8Array(32));
      const userId = crypto.getRandomValues(new Uint8Array(16));
      const cred = await navigator.credentials.create({
        publicKey: {
          challenge,
          rp: { name: 'Duka Ledger' },
          user: { id: userId, name: 'duka-ledger-owner', displayName: 'Duka Ledger Owner' },
          pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
          authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required' },
          timeout: 60000
        }
      });
      if (!cred) return false;
      const idB64 = btoa(String.fromCharCode(...new Uint8Array(cred.rawId)));
      await DB.saveSettings({ biometricEnabled: true, biometricCredentialId: idB64 });
      State.settings = await DB.getSettings();
      return true;
    } catch (err) {
      console.warn('Biometric registration failed', err);
      return false;
    }
  },

  async tryBiometric() {
    if (!State.settings.biometricEnabled || !State.settings.biometricCredentialId) return;
    try {
      const challenge = crypto.getRandomValues(new Uint8Array(32));
      const rawId = Uint8Array.from(atob(State.settings.biometricCredentialId), c => c.charCodeAt(0));
      const assertion = await navigator.credentials.get({
        publicKey: {
          challenge,
          allowCredentials: [{ id: rawId, type: 'public-key' }],
          userVerification: 'required',
          timeout: 60000
        }
      });
      if (assertion) this.hide();
    } catch (err) {
      // Silently ignore — user can still use the PIN pad.
      console.warn('Biometric unlock cancelled or failed', err);
    }
  }
};

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('pinPad').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-key]');
    if (btn) Lock.handleKey(btn.dataset.key);
  });
});

window.Lock = Lock;
