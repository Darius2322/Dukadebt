/* =========================================================
   google-drive.js — optional cloud backup to the user's own
   Google Drive.

   Uses Google Identity Services (loaded async in index.html) for
   sign-in, and the Drive REST API with the narrow `drive.file`
   scope — meaning this app can only ever see or touch the single
   backup file IT creates, never anything else in the person's
   Drive. Local JSON export/import (backup.js) keeps working
   fully offline regardless of whether this is connected.

   REQUIRED SETUP (one-time, done by the app owner, not the end
   user): create an OAuth Client ID in Google Cloud Console and
   paste it into GOOGLE_CLIENT_ID below. Until that's done, the
   "Connect Google Drive" button shows a clear message instead of
   failing silently.
   ========================================================= */

const GOOGLE_CLIENT_ID = 'PASTE_YOUR_GOOGLE_OAUTH_CLIENT_ID_HERE.apps.googleusercontent.com';
const GOOGLE_SCOPES = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email';
const GDRIVE_BACKUP_FILENAME = 'duka-ledger-backup.json';

let gTokenClient = null;
let gAccessToken = null;
let gTokenExpiresAt = 0;

const GDrive = {
  isConfigured() {
    return GOOGLE_CLIENT_ID && !GOOGLE_CLIENT_ID.startsWith('PASTE_');
  },

  isLibraryLoaded() {
    return typeof google !== 'undefined' && google.accounts && google.accounts.oauth2;
  },

  ensureTokenClient() {
    if (gTokenClient) return gTokenClient;
    gTokenClient = google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: GOOGLE_SCOPES,
      callback: () => {} // overridden per-call below
    });
    return gTokenClient;
  },

  // Resolves with a valid access token, silently refreshing if we
  // already have consent, or prompting the user if we don't.
  requestToken(promptMode) {
    return new Promise((resolve, reject) => {
      const client = this.ensureTokenClient();
      client.callback = (resp) => {
        if (resp.error) { reject(new Error(resp.error)); return; }
        gAccessToken = resp.access_token;
        gTokenExpiresAt = Date.now() + ((resp.expires_in || 3500) * 1000);
        resolve(gAccessToken);
      };
      client.requestAccessToken({ prompt: promptMode });
    });
  },

  async getValidToken() {
    if (gAccessToken && Date.now() < gTokenExpiresAt - 30000) return gAccessToken;
    return this.requestToken(''); // '' = silent refresh if already consented
  },

  async connect() {
    if (!this.isConfigured()) {
      Toast.show('Google Drive backup is not set up yet on this app.', 'error');
      return;
    }
    if (!this.isLibraryLoaded()) {
      Toast.show('Could not reach Google. Check your internet connection and try again.', 'error');
      return;
    }
    try {
      await this.requestToken('consent');
      const email = await this.fetchAccountEmail();
      const existing = await this.findExistingBackupFile();

      State.settings = await DB.saveSettings({
        googleDriveConnected: true,
        googleDriveEmail: email || '',
        googleDriveFileId: existing ? existing.id : (State.settings.googleDriveFileId || '')
      });
      this.render();

      if (existing) {
        Toast.show(`Connected. Found a backup from ${Utils.formatDateTimeShort(existing.modifiedTime)} in this Google account — use Restore to bring it onto this device.`, 'success');
      } else {
        Toast.show('Google Drive connected. Tap "Backup Now" to save your data there for the first time.', 'success');
      }
    } catch (err) {
      Toast.show('Could not connect Google Drive. Please try again.', 'error');
    }
  },

  // Looks for a backup file this app previously created in the
  // connected Google account, without needing a locally-stored file
  // ID — this is what makes "restore on a brand-new device" possible.
  async findExistingBackupFile() {
    try {
      const token = await this.getValidToken();
      const q = encodeURIComponent(`name='${GDRIVE_BACKUP_FILENAME}' and trashed=false`);
      const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,modifiedTime)&orderBy=modifiedTime desc&pageSize=1`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) return null;
      const data = await res.json();
      return (data.files && data.files[0]) || null;
    } catch (err) {
      return null;
    }
  },

  async fetchAccountEmail() {
    try {
      const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${gAccessToken}` }
      });
      const data = await res.json();
      return data.email || '';
    } catch (e) { return ''; }
  },

  async disconnect() {
    const ok = await confirmDialog({
      title: 'Disconnect Google Drive?',
      message: 'Duka Ledger will stop backing up to Google Drive. The backup file already saved in your Drive will not be deleted, and your local data is unaffected.',
      confirmLabel: 'Disconnect',
      danger: true,
      glyph: '⚠'
    });
    if (!ok) return;

    if (gAccessToken && this.isLibraryLoaded()) {
      google.accounts.oauth2.revoke(gAccessToken, () => {});
    }
    gAccessToken = null;
    gTokenExpiresAt = 0;
    gTokenClient = null;
    State.settings = await DB.saveSettings({
      googleDriveConnected: false,
      googleDriveEmail: '',
      googleDriveFileId: '',
      lastGoogleBackupAt: ''
    });
    this.render();
    Toast.show('Google Drive disconnected', 'success');
  },

  async backupNow() {
    if (!navigator.onLine) { Toast.show('You need an internet connection to back up to Google Drive.', 'error'); return; }
    if (!this.isConfigured() || !this.isLibraryLoaded()) { Toast.show('Google Drive is not available right now.', 'error'); return; }

    const btn = document.getElementById('gdriveBackupNowBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'Backing up…'; }

    try {
      const token = await this.getValidToken();
      const payload = await DB.exportAll();
      const body = JSON.stringify(payload, null, 2);
      const existingFileId = State.settings.googleDriveFileId;

      let fileId = existingFileId;
      if (existingFileId) {
        const res = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=media`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body
        });
        if (!res.ok) throw new Error('update_failed');
      } else {
        const boundary = 'dukaledgerboundary';
        const metadata = { name: GDRIVE_BACKUP_FILENAME, mimeType: 'application/json' };
        const multipartBody =
          `--${boundary}\r\nContent-Type: application/json\r\n\r\n${JSON.stringify(metadata)}\r\n` +
          `--${boundary}\r\nContent-Type: application/json\r\n\r\n${body}\r\n--${boundary}--`;
        const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': `multipart/related; boundary=${boundary}` },
          body: multipartBody
        });
        if (!res.ok) throw new Error('create_failed');
        const data = await res.json();
        fileId = data.id;
      }

      State.settings = await DB.saveSettings({
        googleDriveFileId: fileId,
        lastGoogleBackupAt: new Date().toISOString()
      });
      this.render();
      Toast.show('Backed up to Google Drive', 'success');
      await Sound.announce('gdrive_backup', 'Google Drive backup complete', `${payload.data.customers.length} customers backed up to Google Drive`);
    } catch (err) {
      Toast.show('Google Drive backup failed. Please try again.', 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = '☁️ Backup Now'; }
    }
  },

  async restoreFromDrive() {
    if (!navigator.onLine) { Toast.show('You need an internet connection to restore from Google Drive.', 'error'); return; }
    if (!this.isConfigured() || !this.isLibraryLoaded()) { Toast.show('Google Drive is not available right now.', 'error'); return; }

    const btn = document.getElementById('gdriveRestoreBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'Checking Drive…'; }

    try {
      const token = await this.getValidToken();
      let fileId = State.settings.googleDriveFileId;

      if (!fileId) {
        const existing = await this.findExistingBackupFile();
        if (!existing) {
          Toast.show('No Duka Ledger backup was found in this Google account yet.', 'error');
          return;
        }
        fileId = existing.id;
      }

      const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('download_failed');
      const payload = await res.json();

      if (btn) { btn.disabled = false; btn.textContent = '⭳ Restore from Google Drive'; }

      const ok = await confirmDialog({
        title: 'Restore from Google Drive?',
        message: `This will replace all customers, transactions, and settings currently on this device with the backup found in Google Drive (${payload.exportedAt ? Utils.formatDateTimeShort(payload.exportedAt) : 'unknown date'}). This cannot be undone.`,
        confirmLabel: 'Restore & Replace',
        danger: true,
        glyph: '⚠'
      });
      if (!ok) return;

      await DB.restoreAll(payload);
      State.settings = await DB.saveSettings({ googleDriveFileId: fileId });
      Utils.currencySymbol = State.settings.currency || 'KSh';
      applyTheme(State.settings.theme || 'system');
      Settings.render();
      await afterDataChange();
      switchView('dashboard');
      Toast.show('Restored from Google Drive', 'success');
      await Sound.announce('gdrive_restored', 'Google Drive restore complete', 'All data was replaced from your Google Drive backup');
    } catch (err) {
      Toast.show(err.message === 'download_failed' ? 'Could not download the backup from Google Drive.' : 'This backup file could not be read.', 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = '⭳ Restore from Google Drive'; }
    }
  },

  render() {
    const s = State.settings || {};
    const disconnectedEl = document.getElementById('gdriveDisconnectedState');
    const connectedEl = document.getElementById('gdriveConnectedState');
    if (!disconnectedEl || !connectedEl) return;

    if (s.googleDriveConnected) {
      disconnectedEl.style.display = 'none';
      connectedEl.style.display = 'block';
      document.getElementById('gdriveEmailText').textContent = s.googleDriveEmail || 'your Google account';
      const lastText = s.lastGoogleBackupAt ? Utils.formatDateTimeShort(s.lastGoogleBackupAt) : 'Never backed up yet';
      document.getElementById('gdriveLastBackupText').textContent = `Last backup: ${lastText}`;
    } else {
      disconnectedEl.style.display = 'block';
      connectedEl.style.display = 'none';
    }
  }
};

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('gdriveConnectBtn').addEventListener('click', () => GDrive.connect());
  document.getElementById('gdriveBackupNowBtn').addEventListener('click', () => GDrive.backupNow());
  document.getElementById('gdriveRestoreBtn').addEventListener('click', () => GDrive.restoreFromDrive());
  document.getElementById('gdriveDisconnectBtn').addEventListener('click', () => GDrive.disconnect());
});

window.GDrive = GDrive;
