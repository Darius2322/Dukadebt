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

    document.getElementById('methodTillEnabled').checked = !!s.methodTillEnabled;
    document.getElementById('methodTillNumber').value = s.methodTillNumber || '';
    document.getElementById('methodTillName').value = s.methodTillName || '';
    document.getElementById('methodPochiEnabled').checked = !!s.methodPochiEnabled;
    document.getElementById('methodPochiNumber').value = s.methodPochiNumber || '';
    document.getElementById('methodPochiName').value = s.methodPochiName || '';
    document.getElementById('methodSendEnabled').checked = !!s.methodSendEnabled;
    document.getElementById('methodSendNumber').value = s.methodSendNumber || '';
    document.getElementById('methodSendName').value = s.methodSendName || '';
    document.getElementById('methodPaybillEnabled').checked = !!s.methodPaybillEnabled;
    document.getElementById('methodPaybillNumber').value = s.methodPaybillNumber || '';
    document.getElementById('methodPaybillAccount').value = s.methodPaybillAccount || '';
    document.getElementById('methodPaybillName').value = s.methodPaybillName || '';
    document.getElementById('methodOtherEnabled').checked = !!s.methodOtherEnabled;
    document.getElementById('methodOtherDetails').value = s.methodOtherDetails || '';
    this.syncMethodFieldVisibility();

    document.getElementById('settingsSupportPhone').value = s.supportPhone || '';
    document.getElementById('settingsSupportEmail').value = s.supportEmail || '';
    document.getElementById('settingsSoundEnabled').checked = s.soundEnabled !== false;
    document.getElementById('settingsPushEnabled').checked = !!s.pushEnabled;
    document.querySelectorAll('#themeSeg button').forEach(b => b.classList.toggle('active', b.dataset.theme === (s.theme || 'system')));
    this.renderSecurity();
    if (window.GDrive) GDrive.render();
  },

  syncMethodFieldVisibility() {
    const map = {
      methodTillEnabled: 'methodTillFields',
      methodPochiEnabled: 'methodPochiFields',
      methodSendEnabled: 'methodSendFields',
      methodPaybillEnabled: 'methodPaybillFields',
      methodOtherEnabled: 'methodOtherFields'
    };
    Object.entries(map).forEach(([checkboxId, fieldsId]) => {
      const checked = document.getElementById(checkboxId).checked;
      document.getElementById(fieldsId).classList.toggle('open', checked);
    });
    document.getElementById('methodPaybillNameFields').classList.toggle('open', document.getElementById('methodPaybillEnabled').checked);
  },

  async save() {
    const businessName = Utils.clean(document.getElementById('settingsBusinessName').value, 100) || 'My Shop';
    const businessPhone = Utils.clean(document.getElementById('settingsBusinessPhone').value, 40);
    const businessLocation = Utils.clean(document.getElementById('settingsBusinessLocation').value, 150);
    const currency = Utils.clean(document.getElementById('settingsCurrency').value, 8) || 'KSh';
    const receiptFooter = Utils.clean(document.getElementById('settingsReceiptFooter').value, 200);
    const allowOverpayment = document.getElementById('settingsAllowOverpayment').checked;

    const methodTillEnabled = document.getElementById('methodTillEnabled').checked;
    const methodTillNumber = Utils.clean(document.getElementById('methodTillNumber').value, 20);
    const methodTillName = Utils.clean(document.getElementById('methodTillName').value, 60);
    const methodPochiEnabled = document.getElementById('methodPochiEnabled').checked;
    const methodPochiNumber = Utils.clean(document.getElementById('methodPochiNumber').value, 20);
    const methodPochiName = Utils.clean(document.getElementById('methodPochiName').value, 60);
    const methodSendEnabled = document.getElementById('methodSendEnabled').checked;
    const methodSendNumber = Utils.clean(document.getElementById('methodSendNumber').value, 20);
    const methodSendName = Utils.clean(document.getElementById('methodSendName').value, 60);
    const methodPaybillEnabled = document.getElementById('methodPaybillEnabled').checked;
    const methodPaybillNumber = Utils.clean(document.getElementById('methodPaybillNumber').value, 20);
    const methodPaybillAccount = Utils.clean(document.getElementById('methodPaybillAccount').value, 40);
    const methodPaybillName = Utils.clean(document.getElementById('methodPaybillName').value, 60);
    const methodOtherEnabled = document.getElementById('methodOtherEnabled').checked;
    const methodOtherDetails = Utils.clean(document.getElementById('methodOtherDetails').value, 100);

    const supportPhone = Utils.clean(document.getElementById('settingsSupportPhone').value, 40);
    const supportEmail = Utils.clean(document.getElementById('settingsSupportEmail').value, 100);
    const soundEnabled = document.getElementById('settingsSoundEnabled').checked;

    State.settings = await DB.saveSettings({
      businessName, businessPhone, businessLocation, currency, receiptFooter, allowOverpayment,
      methodTillEnabled, methodTillNumber, methodTillName,
      methodPochiEnabled, methodPochiNumber, methodPochiName,
      methodSendEnabled, methodSendNumber, methodSendName,
      methodPaybillEnabled, methodPaybillNumber, methodPaybillAccount, methodPaybillName,
      methodOtherEnabled, methodOtherDetails,
      supportPhone, supportEmail, soundEnabled
    });
    Utils.currencySymbol = currency;
    Toast.show('Settings saved', 'success');
    await DB.logActivity('settings_saved', 'Business settings were updated', { notify: false });
    await afterDataChange();
  },

  async setTheme(theme) {
    State.settings = await DB.saveSettings({ theme });
    applyTheme(theme);
    document.querySelectorAll('#themeSeg button').forEach(b => b.classList.toggle('active', b.dataset.theme === theme));
  },

  async renderSecurity() {
    const s = State.settings;
    const hasPin = !!s.pinHash;
    document.getElementById('securityStatusText').textContent = hasPin
      ? 'A PIN is protecting this app. You\u2019ll need it every time you open Duka Ledger.'
      : 'No PIN set — anyone who opens this app can see your records.';
    document.getElementById('setPinBtn').textContent = hasPin ? 'Change PIN' : 'Set PIN Lock';
    document.getElementById('removePinBtn').style.display = hasPin ? 'block' : 'none';

    const bioRow = document.getElementById('biometricRow');
    const bioCheckbox = document.getElementById('settingsBiometric');
    const available = await Lock.biometricAvailable();
    bioRow.style.display = (hasPin && available) ? 'flex' : 'none';
    bioCheckbox.checked = !!s.biometricEnabled;
  },

  openPinSheet() {
    document.getElementById('setPinTitle').textContent = State.settings.pinHash ? 'Change PIN' : 'Set PIN Lock';
    document.getElementById('newPinInput').value = '';
    document.getElementById('confirmPinInput').value = '';
    document.getElementById('setPinError').textContent = '';
    openSheet('setPinSheet');
    setTimeout(() => document.getElementById('newPinInput').focus(), 200);
  },

  async savePin() {
    const pin = document.getElementById('newPinInput').value.trim();
    const confirm = document.getElementById('confirmPinInput').value.trim();
    const errEl = document.getElementById('setPinError');
    if (!/^[0-9]{4,6}$/.test(pin)) { errEl.textContent = 'PIN must be 4 to 6 digits.'; return; }
    if (pin !== confirm) { errEl.textContent = 'PINs do not match.'; return; }

    const salt = Lock.randomSalt();
    const hash = await Lock.hashPin(pin, salt);
    State.settings = await DB.saveSettings({ pinHash: hash, pinSalt: salt });
    closeSheet('setPinSheet');
    Toast.show('PIN saved', 'success');
    await Sound.announce('security_pin_set', 'PIN lock enabled', 'A PIN was set to protect this app');
    await Settings.renderSecurity();
  },

  async removePin() {
    const ok = await confirmDialog({
      title: 'Remove PIN lock?',
      message: 'Duka Ledger will open without asking for a PIN or fingerprint.',
      confirmLabel: 'Remove PIN',
      danger: true,
      glyph: '⚠'
    });
    if (!ok) return;
    State.settings = await DB.saveSettings({ pinHash: '', pinSalt: '', biometricEnabled: false, biometricCredentialId: '' });
    Toast.show('PIN lock removed', 'success');
    await Sound.announce('security_pin_removed', 'PIN lock removed', 'This app can now be opened without a PIN', { notify: true });
    await Settings.renderSecurity();
  },

  async toggleBiometric(enable) {
    if (enable) {
      const ok = await Lock.registerBiometric();
      if (!ok) {
        Toast.show('Could not set up fingerprint unlock on this device', 'error');
        document.getElementById('settingsBiometric').checked = false;
        return;
      }
      Toast.show('Fingerprint unlock enabled', 'success');
    } else {
      State.settings = await DB.saveSettings({ biometricEnabled: false, biometricCredentialId: '' });
      Toast.show('Fingerprint unlock disabled', 'success');
    }
    await Settings.renderSecurity();
  }
};

document.addEventListener('DOMContentLoaded', () => {
  ['methodTillEnabled', 'methodPochiEnabled', 'methodSendEnabled', 'methodPaybillEnabled', 'methodOtherEnabled'].forEach(id => {
    document.getElementById(id).addEventListener('change', () => Settings.syncMethodFieldVisibility());
  });
  document.getElementById('settingsSaveBtn').addEventListener('click', () => Settings.save());
  document.querySelectorAll('#themeSeg button').forEach(btn => {
    btn.addEventListener('click', () => Settings.setTheme(btn.dataset.theme));
  });
  document.getElementById('setPinBtn').addEventListener('click', () => Settings.openPinSheet());
  document.getElementById('setPinSaveBtn').addEventListener('click', () => Settings.savePin());
  document.getElementById('removePinBtn').addEventListener('click', () => Settings.removePin());
  document.getElementById('settingsBiometric').addEventListener('change', (e) => Settings.toggleBiometric(e.target.checked));

  document.getElementById('settingsPushEnabled').addEventListener('change', async (e) => {
    if (e.target.checked) {
      const result = await Sound.requestPushPermission();
      if (result !== 'granted') {
        e.target.checked = false;
        Toast.show(result === 'unsupported' ? 'Device notifications are not supported on this browser' : 'Notification permission was not granted', 'error');
        return;
      }
      await DB.saveSettings({ pushEnabled: true });
      State.settings.pushEnabled = true;
      Toast.show('Device notifications enabled', 'success');
    } else {
      await DB.saveSettings({ pushEnabled: false });
      State.settings.pushEnabled = false;
    }
  });

  document.getElementById('historyMenuBtn').addEventListener('click', () => History.open());
  document.getElementById('guideMenuBtn').addEventListener('click', () => openSheet('guideSheet'));
  document.getElementById('termsMenuBtn').addEventListener('click', () => openSheet('termsSheet'));
  document.getElementById('privacyMenuBtn').addEventListener('click', () => openSheet('privacySheet'));
  document.getElementById('checkUpdatesBtn').addEventListener('click', () => checkForUpdatesNow());

  document.getElementById('buySodaBtn').addEventListener('click', () => openSheet('sodaSheet'));
  document.getElementById('sodaCloseBtn').addEventListener('click', () => closeSheet('sodaSheet'));
  document.getElementById('copySodaNumberBtn').addEventListener('click', async () => {
    const number = '0110554040';
    try {
      await navigator.clipboard.writeText(number);
      Toast.show('Number copied', 'success');
    } catch (e) {
      Toast.show('Could not copy — the number is 0110 554 040', 'error');
    }
  });
  document.getElementById('sodaWhatsappBtn').addEventListener('click', () => {
    const text = encodeURIComponent("Hey Darius, buying you a soda for Duka Ledger! 🥤");
    window.open(`https://wa.me/254110554040?text=${text}`, '_blank');
    closeSheet('sodaSheet');
  });
});

window.Settings = Settings;
