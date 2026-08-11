/* =========================================================
   statement.js — printable customer statement / receipt
   ========================================================= */

const Statement = {
  currentCustomerId: null,

  open(customerId) {
    this.currentCustomerId = customerId;
    this.render();
    openSheet('statementSheet');
  },

  render() {
    const customer = State.customers.find(c => c.id === this.currentCustomerId);
    const wrap = document.getElementById('statementContent');
    if (!customer) { wrap.innerHTML = '<p>Customer not found.</p>'; return; }

    const settings = State.settings;
    const txns = State.transactions
      .filter(t => t.customerId === customer.id)
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    let running = 0;
    const rows = txns.map(t => {
      if (t.type === 'payment') running -= t.amount; else running += t.amount;
      return { ...t, running };
    });

    wrap.innerHTML = `
      <div class="statement" id="statementPrintArea">
        <div class="statement-head">
          <div class="biz">${Utils.esc(settings.businessName || 'My Shop')}</div>
          <div class="meta">
            ${settings.businessPhone ? Utils.esc(settings.businessPhone) + ' · ' : ''}${settings.businessLocation ? Utils.esc(settings.businessLocation) : ''}
          </div>
          <div class="meta">Statement generated ${Utils.esc(Utils.formatDateTime(new Date().toISOString()))}</div>
        </div>

        <div style="margin-bottom:12px;">
          <div style="font-weight:700; font-size:15px;">${Utils.esc(customer.name)}</div>
          <div class="muted">${Utils.esc(customer.phone || '')}</div>
        </div>

        <table class="stmt-table">
          <thead><tr><th>Date</th><th>Description</th><th class="num">Debt</th><th class="num">Payment</th><th class="num">Balance</th></tr></thead>
          <tbody>
            ${rows.length ? rows.map(r => `
              <tr>
                <td>${Utils.esc(Utils.formatDate(r.date))}</td>
                <td>${Utils.esc(r.description || (r.type === 'payment' ? (r.paymentMethod || 'Payment') : 'Debt'))}</td>
                <td class="num">${r.type === 'debt' || r.type === 'adjustment' ? Utils.esc(Utils.formatMoney(r.amount)) : ''}</td>
                <td class="num">${r.type === 'payment' ? Utils.esc(Utils.formatMoney(r.amount)) : ''}</td>
                <td class="num">${Utils.esc(Utils.formatMoney(r.running))}</td>
              </tr>
            `).join('') : `<tr><td colspan="5" style="text-align:center; color:var(--ink-faint);">No transactions recorded</td></tr>`}
          </tbody>
        </table>

        <div class="statement-totals">
          <div class="row"><span>Total Debt</span><span class="num">${Utils.esc(Utils.formatMoney(customer.totalBorrowed || 0))}</span></div>
          <div class="row"><span>Total Paid</span><span class="num">${Utils.esc(Utils.formatMoney(customer.totalPaid || 0))}</span></div>
          <div class="row final"><span>Outstanding Balance</span><span class="num">${Utils.esc(Utils.formatMoney(customer.balance || 0))}</span></div>
        </div>

        ${settings.receiptFooter ? `<div class="muted" style="text-align:center; margin-top:16px;">${Utils.esc(settings.receiptFooter)}</div>` : ''}
      </div>
    `;
  },

  print() {
    window.print();
  },

  download() {
    const customer = State.customers.find(c => c.id === this.currentCustomerId);
    if (!customer) return;
    const area = document.getElementById('statementPrintArea');
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Statement - ${Utils.esc(customer.name)}</title>
      <style>
        body{ font-family:-apple-system,Segoe UI,Roboto,sans-serif; padding:24px; color:#16261F; }
        table{ width:100%; border-collapse:collapse; font-size:13px; }
        th,td{ padding:8px 6px; border-bottom:1px solid #ddd; text-align:left; }
        th.num,td.num{ text-align:right; }
        .head{ text-align:center; border-bottom:2px solid #16261F; padding-bottom:12px; margin-bottom:16px; }
        .totals{ margin-top:16px; max-width:320px; margin-left:auto; }
        .totals div{ display:flex; justify-content:space-between; padding:4px 0; }
        .final{ font-weight:700; border-top:1px solid #333; padding-top:8px; }
      </style></head><body>${area.innerHTML}</body></html>`;
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `statement-${customer.name.replace(/\s+/g, '-').toLowerCase()}-${Utils.todayInputValue()}.html`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    Toast.show('Statement downloaded', 'success');
  }
};

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('statementPrintBtn').addEventListener('click', () => Statement.print());
  document.getElementById('statementDownloadBtn').addEventListener('click', () => Statement.download());
});

window.Statement = Statement;
