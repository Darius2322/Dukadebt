/* =========================================================
   profile.js — single customer profile + transaction timeline
   ========================================================= */

const Profile = {
  render(customerId) {
    const customer = State.customers.find(c => c.id === customerId);
    const wrap = document.getElementById('profileContent');
    if (!customer) {
      wrap.innerHTML = `<div class="empty"><div class="glyph">?</div><h3>Customer not found</h3><p>This customer may have been deleted.</p></div>`;
      return;
    }

    const balance = customer.balance || 0;
    const settled = balance <= 0;
    const txns = State.transactions
      .filter(t => t.customerId === customerId)
      .sort((a, b) => new Date(a.date) - new Date(b.date)); // chronological, running balance forward

    let running = 0;
    const withRunning = txns.map(t => {
      if (t.type === 'payment') running -= t.amount; else running += t.amount;
      return { ...t, running };
    }).reverse(); // newest first for display

    wrap.innerHTML = `
      <div class="profile-head">
        <div class="avatar">${Utils.esc(Utils.initials(customer.name))}</div>
        <h2>${Utils.esc(customer.name)}</h2>
        <div class="phone">${Utils.esc(customer.phone || 'No phone number')}</div>
      </div>

      <div class="balance-banner ${settled ? 'settled' : ''}">
        <div class="amt num">${Utils.esc(Utils.formatMoney(Math.abs(balance)))}</div>
        <div class="lbl">${settled ? (balance < 0 ? 'Overpaid' : 'Settled — No Debt') : 'Currently Owed'}</div>
      </div>

      <div class="mini-stats">
        <div class="c"><div class="v num">${Utils.esc(Utils.formatMoney(customer.totalBorrowed || 0))}</div><div class="l">Total Debt</div></div>
        <div class="c"><div class="v num">${Utils.esc(Utils.formatMoney(customer.totalPaid || 0))}</div><div class="l">Total Paid</div></div>
        <div class="c"><div class="v num">${customer.transactionCount || 0}</div><div class="l">Transactions</div></div>
      </div>

      <div class="btn-row" style="margin:14px 0;">
        <button class="btn btn-outline btn-sm" id="profileDebtBtn">+ Record Debt</button>
        <button class="btn btn-outline btn-sm" id="profilePaymentBtn">+ Record Payment</button>
      </div>
      <div class="btn-row" style="margin-bottom:6px;">
        <button class="btn btn-ghost btn-sm" id="profileStatementBtn">📄 Statement</button>
        <button class="btn btn-ghost btn-sm" id="profileEditBtn">✎ Edit</button>
        <button class="btn btn-ghost btn-sm" id="profileDeleteBtn" style="color:var(--danger)">🗑 Delete</button>
      </div>

      ${customer.address ? `<div class="muted" style="margin-top:8px;">📍 ${Utils.esc(customer.address)}</div>` : ''}
      ${customer.notes ? `<div class="muted" style="margin-top:4px;">📝 ${Utils.esc(customer.notes)}</div>` : ''}

      <div class="section-title"><h2>Transaction History</h2></div>
      ${this.renderTimeline(withRunning, customer)}
    `;

    document.getElementById('profileDebtBtn').addEventListener('click', () => Transactions.openDebtForm(customer.id));
    document.getElementById('profilePaymentBtn').addEventListener('click', () => Transactions.openPaymentForm(customer.id));
    document.getElementById('profileStatementBtn').addEventListener('click', () => Statement.open(customer.id));
    document.getElementById('profileEditBtn').addEventListener('click', () => Customers.openForm(customer));
    document.getElementById('profileDeleteBtn').addEventListener('click', () => Customers.confirmDelete(customer.id));

    wrap.querySelectorAll('[data-edit-txn]').forEach(btn => {
      btn.addEventListener('click', () => Transactions.openEditForm(btn.dataset.editTxn));
    });
    wrap.querySelectorAll('[data-delete-txn]').forEach(btn => {
      btn.addEventListener('click', () => Transactions.confirmDeleteTransaction(btn.dataset.deleteTxn));
    });
  },

  renderTimeline(items, customer) {
    if (!items.length) {
      return `<div class="empty" style="padding:30px 10px;">
        <div class="glyph">✓</div>
        <h3>No Transactions Yet</h3>
        <p>Record a debt or payment for ${Utils.esc(customer.name)} to see history here.</p>
      </div>`;
    }
    return `<div class="timeline">${items.map(t => `
      <div class="tl-item ${t.type}">
        <div class="tl-date">${Utils.esc(Utils.formatDate(t.date))}</div>
        <div class="tl-card">
          <div class="tl-top">
            <div>
              <span class="badge ${t.type}">${t.type}</span>
              <div class="tl-desc">${Utils.esc(t.description || (t.type === 'payment' ? (t.paymentMethod || 'Payment') : 'Debt'))}</div>
            </div>
            <div class="tl-amt ${t.type === 'payment' ? 'payment' : 'debt'} num">${Utils.esc(Utils.formatSignedMoney(t.amount, t.type))}</div>
          </div>
          ${t.notes ? `<div class="muted" style="margin-top:5px;">${Utils.esc(t.notes)}</div>` : ''}
          <div class="tl-run num">Running balance: ${Utils.esc(Utils.formatMoney(t.running))}</div>
          <div class="tl-actions">
            <button data-edit-txn="${t.id}">Edit</button>
            <button data-delete-txn="${t.id}">Delete</button>
          </div>
        </div>
      </div>
    `).join('')}</div>`;
  }
};

window.Profile = Profile;
