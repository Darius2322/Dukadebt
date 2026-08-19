/* =========================================================
   about.js — About Duka Ledger sheet (founder + support info)
   ========================================================= */

const About = {
  render() {
    const s = State.settings;
    const wrap = document.getElementById('aboutSupportRows');
    const rows = [];

    if (s.supportPhone) {
      const digits = s.supportPhone.replace(/[^0-9+]/g, '').replace(/^0/, '254').replace('+', '');
      rows.push(`
        <div class="action-row" data-wa="${Utils.esc(digits)}" style="cursor:pointer;">
          <div class="ic payment">${Icon('message-circle')}</div>
          <div><div class="t">${Utils.esc(s.supportPhone)}</div><div class="s">Message on WhatsApp</div></div>
        </div>`);
    }
    if (s.supportEmail) {
      rows.push(`
        <div class="action-row" data-mail="${Utils.esc(s.supportEmail)}" style="cursor:pointer;">
          <div class="ic">${Icon('mail')}</div>
          <div><div class="t">${Utils.esc(s.supportEmail)}</div><div class="s">Send an email</div></div>
        </div>`);
    }
    if (!rows.length) {
      wrap.innerHTML = `<div class="muted">Add a support phone or email in Settings to show contact options here.</div>`;
    } else {
      wrap.innerHTML = rows.join('');
    }

    wrap.querySelectorAll('[data-wa]').forEach(el => {
      el.addEventListener('click', () => window.open(`https://wa.me/${el.dataset.wa}`, '_blank'));
    });
    wrap.querySelectorAll('[data-mail]').forEach(el => {
      el.addEventListener('click', () => { window.location.href = `mailto:${el.dataset.mail}`; });
    });
  },

  open() {
    this.render();
    Stats.render();
    Stats.ping();
    openSheet('aboutSheet');
  }
};

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('aboutMenuBtn').addEventListener('click', () => About.open());
});

window.About = About;
