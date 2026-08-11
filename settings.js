/* =========================================================
   settings.js — business settings, theme, currency, privacy
   ========================================================= */

const Settings = {
  render() {
    const s = State.settings;
    document.getElementById('settingsBusinessName').value = s.businessName || '';
    document.getElementById('settingsBusinessPhone').value = s.businessPhone || '';
    document.getElementById('settingsBusinessLocation').value = s.businessLocation || '';
    document.getElementById('settingsCurrency').value = s.currency || 'KSh';
    document.getElementById('settingsReceiptFooter').value = s.receiptFooter || '';
    document.getElementById('settingsAllowOverpayment').checked = !!s.allowOverpayment;
    document.querySelectorAll('#themeSeg button').forEach(b => b.classList.toggle('active', b.dataset.theme === (s.theme || 'system')));
  },

  async save() {
    const businessName = Utils.clean(document.getElementById('settingsBusinessName').value, 100) || 'My Shop';
    const businessPhone = Utils.clean(document.getElementById('settingsBusinessPhone').value, 40);
    const businessLocation = Utils.clean(document.getElementById('settingsBusinessLocation').value, 150);
    const currency = Utils.clean(document.getElementById('settingsCurrency').value, 8) || 'KSh';
    const receiptFooter = Utils.clean(document.getElementById('settingsReceiptFooter').value, 200);
    const allowOverpayment = document.getElementById('settingsAllowOverpayment').checked;

    State.settings = await DB.saveSettings({ businessName, businessPhone, businessLocation, currency, receiptFooter, allowOverpayment });
    Utils.currencySymbol = currency;
    Toast.show('Settings saved', 'success');
    await afterDataChange();
  },

  async setTheme(theme) {
    State.settings = await DB.saveSettings({ theme });
    applyTheme(theme);
    document.querySelectorAll('#themeSeg button').forEach(b => b.classList.toggle('active', b.dataset.theme === theme));
  }
};

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('settingsSaveBtn').addEventListener('click', () => Settings.save());
  document.querySelectorAll('#themeSeg button').forEach(btn => {
    btn.addEventListener('click', () => Settings.setTheme(btn.dataset.theme));
  });
});

window.Settings = Settings;
