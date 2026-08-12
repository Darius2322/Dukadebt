/* =========================================================
   backup.js — export/import full JSON backup with validation
   ========================================================= */

const Backup = {
  async exportBackup() {
    try {
      const payload = await DB.exportAll();
      const filename = `debt-book-backup-${Utils.todayInputValue()}.json`;
      Utils.downloadJSON(payload, filename);
      Toast.show('Backup downloaded', 'success');
      await Sound.announce('backup_exported', 'Backup completed', `A backup of ${payload.data.customers.length} customers was exported`);
    } catch (err) {
      Toast.show(err.message || 'Backup failed', 'error');
    }
  },

  pendingFile: null,

  handleFileSelect(file) {
    if (!file) return;
    if (!file.name.endsWith('.json')) {
      Toast.show('Please select a .json backup file', 'error');
      return;
    }
    this.pendingFile = file;
    document.getElementById('restoreFileName').textContent = file.name;
    document.getElementById('restoreConfirmBtn').disabled = false;
  },

  async confirmRestore() {
    if (!this.pendingFile) return;
    const ok = await confirmDialog({
      title: 'Restore from backup?',
      message: 'This will replace all customers, transactions, and settings currently on this device with the contents of the backup file. This cannot be undone.',
      confirmLabel: 'Restore & Replace',
      danger: true,
      glyph: '⚠'
    });
    if (!ok) return;

    try {
      const text = await this.pendingFile.text();
      let payload;
      try {
        payload = JSON.parse(text);
      } catch (e) {
        throw new Error('This file is not valid JSON and cannot be read.');
      }
      await DB.restoreAll(payload);
      Toast.show('Backup restored', 'success');
      await Sound.announce('backup_restored', 'Backup restored', 'All data was replaced from a backup file');
      this.pendingFile = null;
      document.getElementById('restoreFileName').textContent = 'No file selected';
      document.getElementById('restoreConfirmBtn').disabled = true;
      document.getElementById('restoreFileInput').value = '';
      State.settings = await DB.getSettings();
      Utils.currencySymbol = State.settings.currency || 'KSh';
      applyTheme(State.settings.theme || 'system');
      Settings.render();
      await afterDataChange();
      switchView('dashboard');
    } catch (err) {
      Toast.show(err.message || 'Restore failed. The backup was not applied.', 'error');
    }
  }
};

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('exportBackupBtn').addEventListener('click', () => Backup.exportBackup());
  document.getElementById('restoreFileInput').addEventListener('change', (e) => {
    Backup.handleFileSelect(e.target.files[0]);
  });
  document.getElementById('restoreConfirmBtn').addEventListener('click', () => Backup.confirmRestore());
});

window.Backup = Backup;
