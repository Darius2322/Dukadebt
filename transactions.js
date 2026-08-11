/* =========================================================
   transactions.js — record debt/payment, edit, delete,
   customer picker, and the full filterable history view
   ========================================================= */

const Transactions = {
  editingId: null,
  activeCustomerId: null,
  activeType: 'debt',

  // history view state
  filterCustomerId: '',
  filterType: 'all',
  searchTerm: '',
  sortMode: 'newest',
  dateFrom: '',
  dateTo: '',

  // ---------- Entry points ----------
  openPickerThen(type) {
    State.pendingAction = type;
    this.renderPicker('');
    openSheet('customerPickerSheet');
    const input = document.getElementById('pickerSearchInput');
    input.value = '';
    setTimeout(() => input.focus(), 150);
  },

  renderPicker(term) {
    const list = document.getElementById('pickerList');
    const t = term.trim().toLowerCase();
    let items = State.customers;
    if (t) items = items.filter(c => c.name.toLowerCase().includes(t) || (c.phone || '').toLowerCase().includes(t));

    if (!State.customers.length) {
      list.innerHTML = `<div class="empty" style="padding:26px 10px;"><p>Add a customer first before recording a transaction.</p></div>`;
      return;
    }
    if (!items.length) {
      list.innerHTML = `<div class="empty" style="padding:26px 10px;"><p>No customers match "${Utils.esc(term)}".</p></div>`;
      return;
    }
    list.innerHTML = items.map(c => `
      <div class="row-card" data-id="${c.id}">
        <div class="avatar">${Utils.esc(Utils.initials(c.name))}</div>
        <div class="row-main">
          <div class="title">${Utils.esc(c.name)}</div>
          <div class="subtitle">${Utils.esc(c.phone || 'No phone number')}</div>
        </div>
        <div class="row-end">
          <div class="amt num ${c.balance > 0 ? 'owed' : 'paid'}">${Utils.esc(Utils.formatMoney(Math.abs(c.balance || 0)))}</div>
        </div>
      </div>
    `).join('');
    list.querySelectorAll('.row-card').forEach(el => {
      el.addEventListener('click', () => {
        closeSheet('customerPickerSheet');
        const custId = el.dataset.id;
        if (State.pendingAction === 'debt') Transactions.openDebtForm(custId);
        else if (State.pendingAction === 'payment') Transactions.openPaymentForm(custId);
      });
    });
  },

  // ---------- Debt form ----------
  openDebtForm(customerId) {
    this.editingId = null;
    this.activeCustomerId = customerId;
    this.activeType = 'debt';
    const c = State.customers.find(x => x.id === customerId);
    document.getElementById('debtFormTitle').textContent = 'Record Debt';
    document.getElementById('debtCustomerName').textContent = c ? c.name : 'Unknown';
    document.getElementById('debtAmount').value = '';
    document.getElementById('debtDescription').value = '';
    document.getElementById('debtDate').value = Utils.todayInputValue();
    document.getElementById('debtNotes').value = '';
    document.getElementById('debtFormError').textContent = '';
    document.getElementById('debtDeleteBtn').style.display = 'none';
    openSheet('debtFormSheet');
    setTimeout(() => document.getElementById('debtAmount').focus(), 200);
  },

  async submitDebtForm() {
    const amount = document.getElementById('debtAmount').value;
    const description = Utils.clean(document.getElementById('debtDescription').value, 200);
    const date = document.getElementById('debtDate').value || Utils.todayInputValue();
    const notes = Utils.clean(document.getElementById('debtNotes').value, 500);
    const errEl = document.getElementById('debtFormError');

    if (!Utils.isPositiveNumber(amount)) { errEl.textContent = 'Enter an amount greater than zero.'; return; }

    try {
      const isoDate = new Date(date + 'T12:00:00').toISOString();
      if (this.editingId) {
        await DB.updateTransaction(this.editingId, { amount: Number(amount), description, date: isoDate, notes });
        Toast.show('Transaction updated', 'success');
      } else {
        await DB.addTransaction({ customerId: this.activeCustomerId, type: 'debt', amount: Number(amount), description, date: isoDate, notes });
        Toast.show('Debt recorded', 'success');
      }
      closeSheet('debtFormSheet');
      await afterDataChange();
    } catch (err) {
      errEl.textContent = err.message || 'Could not save this debt.';
    }
  },

  // ---------- Payment form ----------
  openPaymentForm(customerId) {
    this.editingId = null;
    this.activeCustomerId = customerId;
    this.activeType = 'payment';
    const c = State.customers.find(x => x.id === customerId);
    document.getElementById('paymentFormTitle').textContent = 'Record Payment';
    document.getElementById('paymentCustomerName').textContent = c ? c.name : 'Unknown';
    document.getElementById('paymentOutstanding').textContent = c ? Utils.formatMoney(Math.max(c.balance || 0, 0)) : Utils.formatMoney(0);
    document.getElementById('paymentAmount').value = '';
    document.getElementById('paymentDate').value = Utils.todayInputValue();
    document.getElementById('paymentNotes').value = '';
    document.getElementById('paymentFormError').textContent = '';
    document.getElementById('paymentDeleteBtn').style.display = 'none';
    document.querySelectorAll('#paymentMethodSeg button').forEach(b => b.classList.toggle('active', b.dataset.method === 'Cash'));
    openSheet('paymentFormSheet');
    setTimeout(() => document.getElementById('paymentAmount').focus(), 200);
  },

  async submitPaymentForm() {
    const amount = document.getElementById('paymentAmount').value;
    const date = document.getElementById('paymentDate').value || Utils.todayInputValue();
    const notes = Utils.clean(document.getElementById('paymentNotes').value, 500);
    const method = document.querySelector('#paymentMethodSeg button.active')?.dataset.method || 'Cash';
    const errEl = document.getElementById('paymentFormError');

    if (!Utils.isPositiveNumber(amount)) { errEl.textContent = 'Enter an amount greater than zero.'; return; }

    const customer = State.customers.find(c => c.id === this.activeCustomerId);
    const outstanding = customer ? Math.max(customer.balance || 0, 0) : 0;
    // When editing, add back the original amount before checking against outstanding.
    let effectiveOutstanding = outstanding;
    if (this.editingId) {
      const original = State.transactions.find(t => t.id === this.editingId);
      if (original) effectiveOutstanding += original.amount;
    }

    if (Number(amount) > effectiveOutstanding && !State.settings.allowOverpayment) {
      const ok = await confirmDialog({
        title: 'Amount exceeds balance',
        message: `This payment of ${Utils.formatMoney(amount)} is more than the outstanding balance of ${Utils.formatMoney(effectiveOutstanding)}. Record it anyway as an overpayment?`,
        confirmLabel: 'Record Anyway',
        danger: false,
        glyph: '?'
      });
      if (!ok) return;
    }

    try {
      const isoDate = new Date(date + 'T12:00:00').toISOString();
      if (this.editingId) {
        await DB.updateTransaction(this.editingId, { amount: Number(amount), date: isoDate, notes, paymentMethod: method });
        Toast.show('Transaction updated', 'success');
      } else {
        await DB.addTransaction({ customerId: this.activeCustomerId, type: 'payment', amount: Number(amount), date: isoDate, notes, paymentMethod: method, description: 'Payment' });
        Toast.show('Payment recorded', 'success');
      }
      closeSheet('paymentFormSheet');
      await afterDataChange();
    } catch (err) {
      errEl.textContent = err.message || 'Could not save this payment.';
    }
  },

  // ---------- Edit / delete existing ----------
  openEditForm(transactionId) {
    const t = State.transactions.find(x => x.id === transactionId);
    if (!t) return;
    this.editingId = transactionId;
    this.activeCustomerId = t.customerId;
    const c = State.customers.find(x => x.id === t.customerId);

    if (t.type === 'debt' || t.type === 'adjustment') {
      document.getElementById('debtFormTitle').textContent = 'Edit ' + (t.type === 'debt' ? 'Debt' : 'Adjustment');
      document.getElementById('debtCustomerName').textContent = c ? c.name : 'Unknown';
      document.getElementById('debtAmount').value = t.amount;
      document.getElementById('debtDescription').value = t.description || '';
      document.getElementById('debtDate').value = Utils.toInputDate(t.date);
      document.getElementById('debtNotes').value = t.notes || '';
      document.getElementById('debtFormError').textContent = '';
      document.getElementById('debtDeleteBtn').style.display = 'block';
      openSheet('debtFormSheet');
    } else {
      document.getElementById('paymentFormTitle').textContent = 'Edit Payment';
      document.getElementById('paymentCustomerName').textContent = c ? c.name : 'Unknown';
      document.getElementById('paymentOutstanding').textContent = c ? Utils.formatMoney(Math.max(c.balance || 0, 0)) : Utils.formatMoney(0);
      document.getElementById('paymentAmount').value = t.amount;
      document.getElementById('paymentDate').value = Utils.toInputDate(t.date);
      document.getElementById('paymentNotes').value = t.notes || '';
      document.getElementById('paymentFormError').textContent = '';
      document.getElementById('paymentDeleteBtn').style.display = 'block';
      document.querySelectorAll('#paymentMethodSeg button').forEach(b => b.classList.toggle('active', b.dataset.method === (t.paymentMethod || 'Cash')));
      openSheet('paymentFormSheet');
    }
  },

  async confirmDeleteTransaction(transactionId) {
    const t = State.transactions.find(x => x.id === transactionId);
    if (!t) return;
    const ok = await confirmDialog({
      title: 'Delete this transaction?',
      message: `This will remove this ${t.type} of ${Utils.formatMoney(t.amount)} and recalculate the customer's balance. This cannot be undone.`,
      confirmLabel: 'Delete',
      danger: true,
      glyph: '⚠'
    });
    if (!ok) return;
    try {
      await DB.deleteTransaction(transactionId);
      Toast.show('Transaction deleted', 'success');
      closeSheet('debtFormSheet');
      closeSheet('paymentFormSheet');
      await afterDataChange();
    } catch (err) {
      Toast.show(err.message || 'Could not delete transaction', 'error');
    }
  },

  // ---------- Full history view ----------
  render() {
    const wrap = document.getElementById('transactionsList');
    let items = [...State.transactions];

    if (this.filterCustomerId) items = items.filter(t => t.customerId === this.filterCustomerId);
    if (this.filterType !== 'all') items = items.filter(t => t.type === this.filterType);
    if (this.dateFrom) items = items.filter(t => new Date(t.date) >= new Date(this.dateFrom + 'T00:00:00'));
    if (this.dateTo) items = items.filter(t => new Date(t.date) <= new Date(this.dateTo + 'T23:59:59'));

    const term = this.searchTerm.trim().toLowerCase();
    if (term) {
      items = items.filter(t => {
        const c = State.customers.find(x => x.id === t.customerId);
        return (c && c.name.toLowerCase().includes(term)) ||
               (t.description || '').toLowerCase().includes(term) ||
               t.type.includes(term);
      });
    }

    switch (this.sortMode) {
      case 'oldest': items.sort((a, b) => new Date(a.date) - new Date(b.date)); break;
      case 'highest': items.sort((a, b) => b.amount - a.amount); break;
      case 'lowest': items.sort((a, b) => a.amount - b.amount); break;
      default: items.sort((a, b) => new Date(b.date) - new Date(a.date));
    }

    if (!State.transactions.length) {
      wrap.innerHTML = `<div class="empty"><div class="glyph">✓</div><h3>No Transactions Yet</h3><p>Record a debt or payment to see it appear here.</p></div>`;
      return;
    }
    if (!items.length) {
      wrap.innerHTML = `<div class="empty"><div class="glyph">?</div><h3>No matches</h3><p>Try adjusting your filters or search.</p></div>`;
      return;
    }

    wrap.innerHTML = `<div class="list">${items.map(t => {
      const c = State.customers.find(x => x.id === t.customerId);
      return `
      <div class="row-card" data-id="${t.id}">
        <div class="avatar">${Utils.esc(Utils.initials(c ? c.name : '?'))}</div>
        <div class="row-main">
          <div class="title">${Utils.esc(c ? c.name : 'Unknown customer')}</div>
          <div class="subtitle"><span class="badge ${t.type}">${t.type}</span> ${Utils.esc(t.description || t.paymentMethod || '')}</div>
        </div>
        <div class="row-end">
          <div class="amt num ${t.type === 'payment' ? 'paid' : 'owed'}">${Utils.esc(Utils.formatSignedMoney(t.amount, t.type))}</div>
          <div class="meta">${Utils.esc(Utils.formatDate(t.date))}</div>
        </div>
      </div>`;
    }).join('')}</div>`;

    wrap.querySelectorAll('.row-card').forEach(el => {
      el.addEventListener('click', () => Transactions.openEditForm(el.dataset.id));
    });
  },

  wireFilters() {
    document.getElementById('txnSearchInput').addEventListener('input', Utils.debounce((e) => {
      this.searchTerm = e.target.value; this.render();
    }, 150));

    document.querySelectorAll('#txnTypeChips .chip').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('#txnTypeChips .chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        this.filterType = chip.dataset.type;
        this.render();
      });
    });

    document.getElementById('txnSortSelect').addEventListener('change', (e) => {
      this.sortMode = e.target.value; this.render();
    });

    document.getElementById('txnCustomerFilter').addEventListener('change', (e) => {
      this.filterCustomerId = e.target.value; this.render();
    });

    document.getElementById('txnDateFrom').addEventListener('change', (e) => { this.dateFrom = e.target.value; this.render(); });
    document.getElementById('txnDateTo').addEventListener('change', (e) => { this.dateTo = e.target.value; this.render(); });
    document.getElementById('txnClearFilters').addEventListener('click', () => {
      this.filterCustomerId = ''; this.filterType = 'all'; this.searchTerm = '';
      this.sortMode = 'newest'; this.dateFrom = ''; this.dateTo = '';
      document.getElementById('txnSearchInput').value = '';
      document.getElementById('txnCustomerFilter').value = '';
      document.getElementById('txnSortSelect').value = 'newest';
      document.getElementById('txnDateFrom').value = '';
      document.getElementById('txnDateTo').value = '';
      document.querySelectorAll('#txnTypeChips .chip').forEach(c => c.classList.toggle('active', c.dataset.type === 'all'));
      this.render();
    });
  },

  populateCustomerFilter() {
    const sel = document.getElementById('txnCustomerFilter');
    const current = sel.value;
    sel.innerHTML = `<option value="">All Customers</option>` + State.customers.map(c => `<option value="${c.id}">${Utils.esc(c.name)}</option>`).join('');
    sel.value = current;
  }
};

document.addEventListener('DOMContentLoaded', () => {
  Transactions.wireFilters();

  document.getElementById('pickerSearchInput').addEventListener('input', Utils.debounce((e) => {
    Transactions.renderPicker(e.target.value);
  }, 120));

  document.getElementById('debtFormSave').addEventListener('click', () => Transactions.submitDebtForm());
  document.getElementById('paymentFormSave').addEventListener('click', () => Transactions.submitPaymentForm());
  document.getElementById('debtDeleteBtn').addEventListener('click', () => Transactions.confirmDeleteTransaction(Transactions.editingId));
  document.getElementById('paymentDeleteBtn').addEventListener('click', () => Transactions.confirmDeleteTransaction(Transactions.editingId));

  document.querySelectorAll('#paymentMethodSeg button').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#paymentMethodSeg button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });
});

const _origRefresh = afterDataChange;
window.afterDataChange = async function patchedAfterDataChange() {
  await _origRefresh();
  Transactions.populateCustomerFilter();
};

window.Transactions = Transactions;
