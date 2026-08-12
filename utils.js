/* =========================================================
   utils.js — formatting, sanitization, toasts, small helpers
   ========================================================= */

const Utils = {
  currencySymbol: 'KSh',

  formatMoney(amount, symbol) {
    const s = symbol || Utils.currencySymbol;
    const n = Number(amount) || 0;
    const abs = Math.abs(n);
    const formatted = abs.toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    return `${s} ${formatted}`;
  },

  formatSignedMoney(amount, type, symbol) {
    const sign = type === 'payment' ? '−' : (Number(amount) < 0 ? '−' : '+');
    return `${sign} ${Utils.formatMoney(Math.abs(amount), symbol)}`;
  },

  formatDate(iso, opts) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d)) return '—';
    return d.toLocaleDateString('en-GB', opts || { day: '2-digit', month: 'short', year: 'numeric' });
  },

  formatDateTimeShort(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d)) return '—';
    const date = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const time = d.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true });
    return `${date} · ${time}`;
  },

  formatDateTime(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d)) return '—';
    return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  },

  todayInputValue() {
    const d = new Date();
    const tz = d.getTimezoneOffset() * 60000;
    return new Date(d - tz).toISOString().slice(0, 10);
  },

  nowTimeValue() {
    const d = new Date();
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  },

  toInputTime(iso) {
    if (!iso) return Utils.nowTimeValue();
    const d = new Date(iso);
    if (isNaN(d)) return Utils.nowTimeValue();
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  },

  combineDateTime(dateStr, timeStr) {
    const date = dateStr || Utils.todayInputValue();
    const time = timeStr || Utils.nowTimeValue();
    return new Date(`${date}T${time}:00`).toISOString();
  },

  toInputDate(iso) {
    if (!iso) return Utils.todayInputValue();
    return new Date(iso).toISOString().slice(0, 10);
  },

  // Escape any user-provided text before it is placed into innerHTML.
  esc(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  },

  initials(name) {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  },

  // Basic input sanitation for free-text fields: trim + strip control chars.
  clean(str, maxLen = 500) {
    if (!str) return '';
    return String(str).replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0, maxLen);
  },

  isValidPhone(phone) {
    if (!phone) return true; // optional
    return /^[0-9+()\-\s]{6,20}$/.test(phone.trim());
  },

  isPositiveNumber(n) {
    const num = Number(n);
    return !isNaN(num) && isFinite(num) && num > 0;
  },

  debounce(fn, ms = 250) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  },

  sortByDateDesc(a, b) {
    return new Date(b.date) - new Date(a.date);
  },

  downloadJSON(obj, filename) {
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
};

// ---------- Toasts ----------
const Toast = {
  wrap: null,
  init() {
    this.wrap = document.getElementById('toastWrap');
  },
  show(message, type = 'default') {
    if (!this.wrap) this.init();
    const el = document.createElement('div');
    el.className = 'toast' + (type === 'success' ? ' success' : '') + (type === 'error' ? ' error' : '');
    el.textContent = message;
    this.wrap.appendChild(el);
    setTimeout(() => {
      el.style.transition = 'opacity .25s ease, transform .25s ease';
      el.style.opacity = '0';
      el.style.transform = 'translateY(-6px)';
      setTimeout(() => el.remove(), 260);
    }, 2200);
  }
};

window.Utils = Utils;
window.Toast = Toast;
