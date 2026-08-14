/* =========================================================
   referral.js — Refer a Friend: prefill a WhatsApp message to
   Darius with the friend's name and contact, sent from the
   referrer's own WhatsApp. Fully client-side, no server involved.
   ========================================================= */

const DEVELOPER_WHATSAPP = '254110554040'; // 0110554040, international format for wa.me

const Referral = {
  open() {
    document.getElementById('referFriendName').value = '';
    document.getElementById('referFriendPhone').value = '';
    document.getElementById('referFormError').textContent = '';
    const importBtn = document.getElementById('referImportContactBtn');
    importBtn.style.display = Customers.contactPickerSupported() ? 'block' : 'none';
    openSheet('referSheet');
    setTimeout(() => document.getElementById('referFriendName').focus(), 200);
  },

  async importFromContacts() {
    try {
      const contacts = await navigator.contacts.select(['name', 'tel'], { multiple: false });
      if (!contacts || !contacts.length) return;
      const c = contacts[0];
      if (c.name && c.name.length) document.getElementById('referFriendName').value = c.name[0];
      if (c.tel && c.tel.length) document.getElementById('referFriendPhone').value = c.tel[0];
    } catch (err) {
      if (err && err.name !== 'AbortError') Toast.show('Could not import from contacts', 'error');
    }
  },

  async send() {
    const name = Utils.clean(document.getElementById('referFriendName').value, 100);
    const phone = Utils.clean(document.getElementById('referFriendPhone').value, 40);
    const errEl = document.getElementById('referFormError');

    if (!name) { errEl.textContent = "Please enter your friend's name."; return; }
    if (!Utils.isValidPhone(phone) || !phone) { errEl.textContent = "Please enter a valid phone number."; return; }

    const referrerShop = (State.settings && State.settings.businessName) || 'a shopkeeper';
    const message = `Hi Darius, I'd like to refer someone to Duka Ledger:\n\nName: ${name}\nPhone: ${phone}\n\nReferred by: ${referrerShop}`;
    const waUrl = `https://wa.me/${DEVELOPER_WHATSAPP}?text=${encodeURIComponent(message)}`;

    try {
      await DB.logActivity('referral_sent', `Referred ${name} (${phone}) to Duka Ledger`, { notify: false });
    } catch (e) { /* non-critical */ }

    window.open(waUrl, '_blank');
    closeSheet('referSheet');
    Toast.show('Opening WhatsApp — just hit send', 'success');
  }
};

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('referMenuBtn').addEventListener('click', () => Referral.open());
  document.getElementById('referImportContactBtn').addEventListener('click', () => Referral.importFromContacts());
  document.getElementById('referSendBtn').addEventListener('click', () => Referral.send());
});

window.Referral = Referral;
