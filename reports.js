/* =========================================================
   reports.js — reports page with date-range filtering
   ========================================================= */

const Reports = {
  range: 'all', // today | week | month | custom | all
  customFrom: '',
  customTo: '',

  getRangeBounds() {
    const now = new Date();
    let from = null, to = null;
    if (this.range === 'today') {
      from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    } else if (this.range === 'week') {
      const day = now.getDay();
      const diff = (day === 0 ? 6 : day - 1); // week starts Monday
      from = new Date(now); from.setDate(now.getDate() - diff); from.setHours(0, 0, 0, 0);
      to = new Date(now); to.setHours(23, 59, 59, 999);
    } else if (this.range === 'month') {
      from = new Date(now.getFullYear(), now.getMonth(), 1);
      to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    } else if (this.range === 'custom') {
      from = this.customFrom ? new Date(this.customFrom + 'T00:00:00') : null;
      to = this.customTo ? new Date(this.customTo + 'T23:59:59') : null;
    }
    return { from, to };
  },

  filteredTransactions() {
    const { from, to } = this.getRangeBounds();
    return State.transactions.filter(t => {
      const d = new Date(t.date);
      if (from && d < from) return false;
      if (to && d > to) return false;
      return true;
    });
  },

  render() {
    const wrap = document.getElementById('reportsContent');
    const txns = this.filteredTransactions();

    let debtIssued = 0, paymentsReceived = 0;
    for (const t of txns) {
      if (t.type === 'debt') debtIssued += t.amount;
      else if (t.type === 'payment') paymentsReceived += t.amount;
    }

    const totals = computeTotals();
    const topDebtors = [...State.customers]
      .filter(c => (c.balance || 0) > 0)
      .sort((a, b) => (b.balance || 0) - (a.balance || 0))
      .slice(0, 5);

    const recent = [...txns].sort(Utils.sortByDateDesc).slice(0, 8);

    wrap.innerHTML = `
      <div class="chip-row" id="reportRangeChips">
        <div class="chip ${this.range === 'today' ? 'active' : ''}" data-range="today">Today</div>
        <div class="chip ${this.range === 'week' ? 'active' : ''}" data-range="week">This Week</div>
        <div class="chip ${this.range === 'month' ? 'active' : ''}" data-range="month">This Month</div>
        <div class="chip ${this.range === 'all' ? 'active' : ''}" data-range="all">All Time</div>
        <div class="chip ${this.range === 'custom' ? 'active' : ''}" data-range="custom">Custom</div>
      </div>

      ${this.range === 'custom' ? `
        <div class="btn-row" style="margin-bottom:14px;">
          <div class="field" style="margin:0; flex:1;"><label>From</label><input type="date" id="reportFrom" value="${this.customFrom}"></div>
          <div class="field" style="margin:0; flex:1;"><label>To</label><input type="date" id="reportTo" value="${this.customTo}"></div>
        </div>
      ` : ''}

      <div class="stat-grid">
        <div class="stat-card owed"><div class="label">Debt Issued</div><div class="value num">${Utils.esc(Utils.formatMoney(debtIssued))}</div></div>
        <div class="stat-card paid"><div class="label">Payments Received</div><div class="value num">${Utils.esc(Utils.formatMoney(paymentsReceived))}</div></div>
        <div class="stat-card owed"><div class="label">Total Outstanding</div><div class="value num">${Utils.esc(Utils.formatMoney(totals.totalOwed))}</div></div>
        <div class="stat-card count"><div class="label">Number of Debtors</div><div class="value num">${totals.customersOwing}</div></div>
      </div>

      <div class="section-title"><h2>Top Customers by Debt</h2></div>
      ${topDebtors.length ? `<div class="list">${topDebtors.map(c => `
        <div class="row-card" data-id="${c.id}">
          <div class="avatar">${Utils.esc(Utils.initials(c.name))}</div>
          <div class="row-main"><div class="title">${Utils.esc(c.name)}</div><div class="subtitle">${Utils.esc(c.phone || '')}</div></div>
          <div class="row-end"><div class="amt num owed">${Utils.esc(Utils.formatMoney(c.balance))}</div></div>
        </div>`).join('')}</div>` : `<div class="empty" style="padding:24px 10px;"><p>No outstanding debts right now.</p></div>`}

      <div class="section-title"><h2>Recent Transactions</h2></div>
      ${renderMiniTxnList(recent, 'No transactions in this period.')}
    `;

    wrap.querySelectorAll('#reportRangeChips .chip').forEach(chip => {
      chip.addEventListener('click', () => {
        this.range = chip.dataset.range;
        this.render();
      });
    });
    wrap.querySelectorAll('.row-card[data-id]').forEach(el => {
      el.addEventListener('click', () => openCustomerProfile(el.dataset.id));
    });
    const fromInput = document.getElementById('reportFrom');
    const toInput = document.getElementById('reportTo');
    if (fromInput) fromInput.addEventListener('change', (e) => { this.customFrom = e.target.value; this.render(); });
    if (toInput) toInput.addEventListener('change', (e) => { this.customTo = e.target.value; this.render(); });
  }
};

window.Reports = Reports;
