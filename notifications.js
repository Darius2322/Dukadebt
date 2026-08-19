/* =========================================================
   notifications.js — notification bell + panel
   ========================================================= */

const ICONS = {
  customer_added: 'user', customer_updated: 'pencil', customer_deleted: 'trash-2',
  debt_added: 'plus', debt_updated: 'pencil', payment_added: 'banknote', payment_updated: 'pencil',
  transaction_deleted: 'trash-2', backup_exported: 'download', backup_restored: 'upload',
  settings_saved: 'settings', security_pin_set: 'lock', security_pin_removed: 'lock-open',
  app_updated: 'sparkles', referral_sent: 'users', gdrive_backup: 'cloud', gdrive_restored: 'download'
};

const Notifications = {
  async refreshBadge() {
    const count = await DB.getUnreadNotificationCount();
    const badge = document.getElementById('notifBadge');
    if (badge) badge.style.display = count > 0 ? 'block' : 'none';
  },

  async open() {
    await this.render();
    openSheet('notifSheet');
    await DB.markAllNotificationsRead();
    await this.refreshBadge();
  },

  async render() {
    const wrap = document.getElementById('notifList');
    const all = await DB.getActivity(200);
    const items = all.filter(a => a.notify);
    if (!items.length) {
      wrap.innerHTML = `<div class="empty" style="padding:30px 10px;"><div class="glyph">${Icon('bell', { size: 26 })}</div><h3>No Notifications Yet</h3><p>You'll see updates here when debts, payments, and other events happen.</p></div>`;
      return;
    }
    wrap.innerHTML = items.map(item => `
      <div class="list-row ${!item.read ? 'unread' : ''}">
        <div class="ic">${ICONS[item.type] ? Icon(ICONS[item.type]) : '•'}</div>
        <div class="body">
          <div class="t">${Utils.esc(item.message)}</div>
          <div class="s">${Utils.esc(Utils.formatDateTimeShort(item.timestamp))}</div>
        </div>
      </div>
    `).join('');
  }
};

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('notifBtn').addEventListener('click', () => Notifications.open());
  document.getElementById('notifMarkReadBtn').addEventListener('click', async () => {
    await DB.markAllNotificationsRead();
    await Notifications.render();
    await Notifications.refreshBadge();
  });
});

window.Notifications = Notifications;
