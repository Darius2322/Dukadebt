/* =========================================================
   statement.js — printable customer statement / receipt
   ========================================================= */

const Statement = {
  currentCustomerId: null,

  open(customerId) {
    this.currentCustomerId = customerId;
    this.render();
    const customer = State.customers.find(c => c.id === customerId);
    document.getElementById('statementSendToNumber').value = (customer && customer.phone) || '';
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
                <td>${Utils.esc(Utils.formatDate(r.date))}<br><span style="color:var(--ink-faint); font-size:10px;">${Utils.esc(Utils.toInputTime(r.date))}</span></td>
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

        ${(() => {
          const lines = Utils.getPaymentMethodLines(settings);
          if (!lines.length) return '';
          return `<div style="margin-top:14px; padding-top:12px; border-top:1px dashed var(--rule);">
            <div class="muted" style="text-transform:uppercase; letter-spacing:.06em; font-size:11px; font-weight:700; margin-bottom:6px;">Pay Via</div>
            ${lines.map(l => `<div style="color:var(--brand); font-weight:600; font-size:13px; margin-bottom:3px;">${Utils.esc(l)}</div>`).join('')}
          </div>`;
        })()}

        ${settings.receiptFooter ? `<div class="muted" style="text-align:center; margin-top:16px;">${Utils.esc(settings.receiptFooter)}</div>` : ''}
      </div>
    `;
  },

  wrapCanvasText(ctx, text, maxWidth) {
    const words = text.split(' ');
    const lines = [];
    let current = '';
    for (const word of words) {
      const test = current ? current + ' ' + word : word;
      if (ctx.measureText(test).width > maxWidth && current) {
        lines.push(current);
        current = word;
      } else {
        current = test;
      }
    }
    if (current) lines.push(current);
    return lines;
  },

  print() {
    window.print();
  },

  // ---------- Canvas receipt rendering (shareable image) ----------
  buildCanvas() {
    const customer = State.customers.find(c => c.id === this.currentCustomerId);
    const settings = State.settings;
    if (!customer) return null;

    const txns = State.transactions
      .filter(t => t.customerId === customer.id)
      .sort((a, b) => new Date(a.date) - new Date(b.date));
    let running = 0;
    const rows = txns.map(t => {
      if (t.type === 'payment') running -= t.amount; else running += t.amount;
      return { ...t, running };
    });

    const scale = 2; // crisp on phone screens
    const W = 720;
    const padX = 36;
    const rowH = 46;
    const headerH = 165;
    const totalsH = 116;
    const paymentInfoLines = Utils.getPaymentMethodLines(settings);
    const measureCtx = document.createElement('canvas').getContext('2d');
    measureCtx.font = '13px -apple-system, Roboto, sans-serif';
    const wrappedPaymentLines = paymentInfoLines.flatMap(line => this.wrapCanvasText(measureCtx, line, W - padX * 2));
    const paymentInfoH = wrappedPaymentLines.length ? (34 + wrappedPaymentLines.length * 22) : 0;
    const footerH = settings.receiptFooter ? 50 : 20;
    const tableHeaderH = 36;
    const H = headerH + tableHeaderH + Math.max(rows.length, 1) * rowH + totalsH + paymentInfoH + footerH + 30;

    const canvas = document.createElement('canvas');
    canvas.width = W * scale;
    canvas.height = H * scale;
    const ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);

    const INK = '#16261F';
    const INK_FAINT = '#8B9790';
    const BRAND = '#2F6B4F';
    const OWED = '#B5471B';
    const RULE = '#E4DCC5';
    const PAPER = '#FFFDF8';

    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, W, H);

    let y = 34;
    ctx.textAlign = 'center';
    ctx.fillStyle = INK;
    ctx.font = '700 24px Georgia, serif';
    ctx.fillText(settings.businessName || 'My Shop', W / 2, y);
    y += 24;
    ctx.font = '13px -apple-system, Roboto, sans-serif';
    ctx.fillStyle = INK_FAINT;
    const bizMeta = [settings.businessPhone, settings.businessLocation].filter(Boolean).join('   ·   ');
    if (bizMeta) { ctx.fillText(bizMeta, W / 2, y); y += 20; }
    ctx.fillText(`Statement generated ${Utils.formatDateTimeShort(new Date().toISOString())}`, W / 2, y);
    y += 22;

    ctx.strokeStyle = RULE;
    ctx.setLineDash([4, 3]);
    ctx.beginPath(); ctx.moveTo(padX, y); ctx.lineTo(W - padX, y); ctx.stroke();
    ctx.setLineDash([]);
    y += 30;

    ctx.textAlign = 'left';
    ctx.fillStyle = INK;
    ctx.font = '700 17px -apple-system, Roboto, sans-serif';
    ctx.fillText(customer.name, padX, y);
    y += 20;
    ctx.font = '13px -apple-system, Roboto, sans-serif';
    ctx.fillStyle = INK_FAINT;
    ctx.fillText(customer.phone || '', padX, y);
    y = headerH;

    // table header
    const col = { date: padX, desc: padX + 150, debt: W - padX - 220, payment: W - padX - 130, balance: W - padX };
    ctx.font = '700 11px -apple-system, Roboto, sans-serif';
    ctx.fillStyle = INK_FAINT;
    ctx.fillText('DATE', col.date, y);
    ctx.fillText('DESCRIPTION', col.desc, y);
    ctx.textAlign = 'right';
    ctx.fillText('DEBT', col.debt, y);
    ctx.fillText('PAYMENT', col.payment, y);
    ctx.fillText('BALANCE', col.balance, y);
    ctx.textAlign = 'left';
    y += 12;
    ctx.strokeStyle = RULE;
    ctx.beginPath(); ctx.moveTo(padX, y); ctx.lineTo(W - padX, y); ctx.stroke();
    y += 26;

    if (!rows.length) {
      ctx.fillStyle = INK_FAINT;
      ctx.font = '13px -apple-system, Roboto, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('No transactions recorded', W / 2, y);
      ctx.textAlign = 'left';
      y += rowH;
    } else {
      for (const r of rows) {
        ctx.font = '12px -apple-system, Roboto, sans-serif';
        ctx.fillStyle = INK;
        ctx.fillText(Utils.formatDate(r.date), col.date, y);
        ctx.fillStyle = INK_FAINT;
        ctx.font = '10.5px -apple-system, Roboto, sans-serif';
        ctx.fillText(Utils.toInputTime(r.date), col.date, y + 14);

        ctx.fillStyle = INK;
        ctx.font = '12.5px -apple-system, Roboto, sans-serif';
        let desc = r.description || (r.type === 'payment' ? (r.paymentMethod || 'Payment') : 'Debt');
        if (desc.length > 26) desc = desc.slice(0, 24) + '…';
        ctx.fillText(desc, col.desc, y);

        ctx.font = '600 12.5px -apple-system, Roboto, sans-serif';
        ctx.textAlign = 'right';
        if (r.type === 'debt' || r.type === 'adjustment') {
          ctx.fillStyle = OWED;
          ctx.fillText(Utils.formatMoney(r.amount), col.debt, y);
        }
        if (r.type === 'payment') {
          ctx.fillStyle = BRAND;
          ctx.fillText(Utils.formatMoney(r.amount), col.payment, y);
        }
        ctx.fillStyle = INK;
        ctx.font = '12.5px -apple-system, Roboto, sans-serif';
        ctx.fillText(Utils.formatMoney(r.running), col.balance, y);
        ctx.textAlign = 'left';
        y += rowH;
      }
    }

    y -= 14;
    ctx.strokeStyle = RULE;
    ctx.setLineDash([4, 3]);
    ctx.beginPath(); ctx.moveTo(padX, y); ctx.lineTo(W - padX, y); ctx.stroke();
    ctx.setLineDash([]);
    y += 30;

    const totalsRow = (label, value, color, bold) => {
      ctx.textAlign = 'left';
      ctx.font = (bold ? '700 15px' : '13px') + ' -apple-system, Roboto, sans-serif';
      ctx.fillStyle = color || INK;
      ctx.fillText(label, padX, y);
      ctx.textAlign = 'right';
      ctx.fillText(value, W - padX, y);
      ctx.textAlign = 'left';
      y += bold ? 26 : 22;
    };
    totalsRow('Total Debt', Utils.formatMoney(customer.totalBorrowed || 0), INK);
    totalsRow('Total Paid', Utils.formatMoney(customer.totalPaid || 0), INK);
    ctx.strokeStyle = RULE;
    ctx.beginPath(); ctx.moveTo(padX, y - 8); ctx.lineTo(W - padX, y - 8); ctx.stroke();
    totalsRow('Outstanding Balance', Utils.formatMoney(customer.balance || 0), OWED, true);

    if (wrappedPaymentLines.length) {
      y += 8;
      ctx.textAlign = 'left';
      ctx.font = '700 12px -apple-system, Roboto, sans-serif';
      ctx.fillStyle = INK;
      ctx.fillText('PAY VIA', padX, y);
      y += 20;
      ctx.font = '13px -apple-system, Roboto, sans-serif';
      ctx.fillStyle = BRAND;
      for (const line of wrappedPaymentLines) { ctx.fillText(line, padX, y); y += 22; }
    }

    if (settings.receiptFooter) {
      y += 14;
      ctx.textAlign = 'center';
      ctx.font = 'italic 12px -apple-system, Roboto, sans-serif';
      ctx.fillStyle = INK_FAINT;
      ctx.fillText(settings.receiptFooter, W / 2, y);
    }

    return canvas;
  },

  canvasToBlob(canvas) {
    return new Promise((resolve) => canvas.toBlob(resolve, 'image/png', 0.95));
  },

  async download() {
    const customer = State.customers.find(c => c.id === this.currentCustomerId);
    if (!customer) return;
    const canvas = this.buildCanvas();
    if (!canvas) return;
    const blob = await this.canvasToBlob(canvas);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `receipt-${customer.name.replace(/\s+/g, '-').toLowerCase()}-${Utils.todayInputValue()}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
    Toast.show('Receipt downloaded', 'success');
  },

  async shareWhatsApp() {
    const customer = State.customers.find(c => c.id === this.currentCustomerId);
    if (!customer) return;

    if (!navigator.onLine) {
      Toast.show('Sharing needs an internet connection. The receipt is still saved offline.', 'error');
      return;
    }

    const canvas = this.buildCanvas();
    if (!canvas) return;
    const blob = await this.canvasToBlob(canvas);
    const filename = `receipt-${customer.name.replace(/\s+/g, '-').toLowerCase()}.png`;
    const file = new File([blob], filename, { type: 'image/png' });
    const summary = `${State.settings.businessName || 'My Shop'} — Statement for ${customer.name}\nOutstanding balance: ${Utils.formatMoney(customer.balance || 0)}`;

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: 'Statement', text: summary });
        return;
      } catch (err) {
        if (err && err.name === 'AbortError') return; // user cancelled
        // fall through to fallback below
      }
    }

    // Fallback path: the browser can't hand a file directly to a specific
    // WhatsApp chat via a URL — that's a WhatsApp/browser restriction, not
    // something this app can bypass. The closest we can get automatically:
    // download the receipt image, open WhatsApp with the right chat and a
    // pre-filled message already loaded, and clearly tell the person to
    // attach the image we just saved (one tap on the paperclip).
    const ok = await confirmDialog({
      title: 'Almost there',
      message: 'The receipt image will download, then WhatsApp will open with the chat and message ready. Tap the 📎 attach icon in WhatsApp and choose the image to finish sending.',
      confirmLabel: 'Continue',
      danger: false,
      glyph: '💬'
    });
    if (!ok) return;

    await this.download();
    const chosenNumber = document.getElementById('statementSendToNumber').value || customer.phone || '';
    const phone = chosenNumber.replace(/[^0-9+]/g, '');
    const waUrl = phone
      ? `https://wa.me/${phone.replace(/^0/, '254').replace('+', '')}?text=${encodeURIComponent(summary)}`
      : `https://wa.me/?text=${encodeURIComponent(summary)}`;
    window.open(waUrl, '_blank');
    Toast.show('Receipt downloaded — attach it using the 📎 icon in WhatsApp', 'success');
  }
};

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('statementPrintBtn').addEventListener('click', () => Statement.print());
  document.getElementById('statementDownloadBtn').addEventListener('click', () => Statement.download());
  document.getElementById('statementShareBtn').addEventListener('click', () => Statement.shareWhatsApp());
});

window.Statement = Statement;
