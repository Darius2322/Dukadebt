/* =========================================================
   customers.js — customer list, search, add/edit/delete
   ========================================================= */

const Customers = {
  searchTerm: '',
  editingId: null,

  render() {
    const list = document.getElementById('customersList');
    const term = this.searchTerm.trim().toLowerCase();
    let items = State.customers;
    if (term) {
      items = items.filter(c =>
        c.name.toLowerCase().includes(term) ||
        (c.phone || '').toLowerCase().includes(term)
      );
    }

    if (!State.customers.length) {
      list.innerHTML = `
        <div class="empty">
          <div class="glyph">+</div>
          <h3>No Customers Yet</h3>
          <p>Add your first customer to start tracking credit.</p>
          <button class="btn btn-primary" style="width:auto; padding-left:22px; padding-right:22px;" id="emptyAddCustomerBtn">+ Add Customer</button>
        </div>`;
      document.getElementById('emptyAddCustomerBtn').addEventListener('click', () => Customers.openForm());
      return;
    }

    if (!items.length) {
      list.innerHTML = `<div class="empty"><div class="glyph">?</div><h3>No matches</h3><p>No customers match "${Utils.esc(this.searchTerm)}".</p></div>`;
      return;
    }

    list.innerHTML = `<div class="list">${items.map(c => `
      <div class="row-card" data-id="${c.id}">
        <div class="avatar">${Utils.esc(Utils.initials(c.name))}</div>
        <div class="row-main">
          <div class="title">${Utils.esc(c.name)}</div>
          <div class="subtitle">${Utils.esc(c.phone || 'No phone number')}</div>
        </div>
        <div class="row-end">
          <div class="amt num ${c.balance > 0 ? 'owed' : 'paid'}">${Utils.esc(Utils.formatMoney(Math.abs(c.balance || 0)))}</div>
          <div class="meta">${c.balance > 0 ? 'owed' : 'settled'}</div>
        </div>
      </div>
    `).join('')}</div>`;

    list.querySelectorAll('.row-card').forEach(el => {
      el.addEventListener('click', () => openCustomerProfile(el.dataset.id));
    });
  },

  wireSearch() {
    const input = document.getElementById('customerSearchInput');
    if (!input) return;
    input.addEventListener('input', Utils.debounce(() => {
      this.searchTerm = input.value;
      this.render();
    }, 150));
  },

  openForm(customer = null) {
    this.editingId = customer ? customer.id : null;
    document.getElementById('customerFormTitle').textContent = customer ? 'Edit Customer' : 'Add Customer';
    document.getElementById('custName').value = customer ? customer.name : '';
    document.getElementById('custPhone').value = customer ? customer.phone : '';
    document.getElementById('custAddress').value = customer ? customer.address : '';
    document.getElementById('custNotes').value = customer ? customer.notes : '';
    document.getElementById('custFormError').textContent = '';
    const importBtn = document.getElementById('importContactBtn');
    importBtn.style.display = (!customer && this.contactPickerSupported()) ? 'block' : 'none';
    openSheet('customerFormSheet');
    setTimeout(() => document.getElementById('custName').focus(), 200);
  },

  contactPickerSupported() {
    return !!(navigator.contacts && navigator.contacts.select && window.ContactsManager);
  },

  async importFromContacts() {
    try {
      const contacts = await navigator.contacts.select(['name', 'tel'], { multiple: false });
      if (!contacts || !contacts.length) return;
      const c = contacts[0];
      if (c.name && c.name.length) document.getElementById('custName').value = c.name[0];
      if (c.tel && c.tel.length) document.getElementById('custPhone').value = c.tel[0];
      Toast.show('Contact imported — check the details before saving', 'success');
    } catch (err) {
      if (err && err.name !== 'AbortError') Toast.show('Could not import from contacts', 'error');
    }
  },

  async submitForm() {
    const name = Utils.clean(document.getElementById('custName').value, 120);
    const phone = Utils.clean(document.getElementById('custPhone').value, 40);
    const address = Utils.clean(document.getElementById('custAddress').value, 200);
    const notes = Utils.clean(document.getElementById('custNotes').value, 500);
    const errEl = document.getElementById('custFormError');

    if (!name) { errEl.textContent = 'Please enter the customer\'s full name.'; return; }
    if (!Utils.isValidPhone(phone)) { errEl.textContent = 'Please enter a valid phone number.'; return; }

    try {
      if (this.editingId) {
        await DB.updateCustomer(this.editingId, { name, phone, address, notes });
        Toast.show('Customer updated', 'success');
        await Sound.announce('customer_updated', 'Customer updated', `${name} was updated`);
      } else {
        await DB.addCustomer({ name, phone, address, notes });
        Toast.show('Customer added', 'success');
        await Sound.announce('customer_added', 'Customer added', `${name} was added to your customers`);
      }
      closeSheet('customerFormSheet');
      await afterDataChange();
    } catch (err) {
      errEl.textContent = err.message || 'Could not save customer.';
    }
  },

  async confirmDelete(customerId) {
    const customer = State.customers.find(c => c.id === customerId);
    if (!customer) return;
    const hasDebt = (customer.balance || 0) > 0;
    const ok = await confirmDialog({
      title: 'Delete this customer?',
      message: hasDebt
        ? `${customer.name} still owes ${Utils.formatMoney(customer.balance)}. Deleting will permanently remove this customer and their entire transaction history. This cannot be undone.`
        : `This will permanently remove ${customer.name} and their transaction history. This cannot be undone.`,
      confirmLabel: 'Delete Customer',
      danger: true,
      glyph: '⚠'
    });
    if (!ok) return;
    try {
      await DB.deleteCustomer(customerId);
      Toast.show('Customer deleted', 'success');
      await Sound.announce('customer_deleted', 'Customer deleted', `${customer.name} and their records were deleted`);
      if (State.currentCustomerId === customerId) {
        State.currentCustomerId = null;
        switchView('customers');
      }
      await afterDataChange();
    } catch (err) {
      Toast.show(err.message || 'Could not delete customer', 'error');
    }
  }
};

document.addEventListener('DOMContentLoaded', () => {
  Customers.wireSearch();
  document.getElementById('addCustomerBtn').addEventListener('click', () => Customers.openForm());
  document.getElementById('customerFormSave').addEventListener('click', () => Customers.submitForm());
  document.getElementById('importContactBtn').addEventListener('click', () => Customers.importFromContacts());
});

window.Customers = Customers;
