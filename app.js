/* =========================================================
   app.js — router, dashboard, action sheets, shared UI glue
   ========================================================= */

const State = {
  customers: [],
  transactions: [],
  settings: null,
  currentView: 'dashboard',
  currentCustomerId: null,
  pendingAction: null // 'debt' | 'payment' — set before opening the customer picker
};

// ---------- Boot ----------
document.addEventListener('DOMContentLoaded', init);

async function init() {
  Toast.init();
  wireNav();
  wireFab();
  wireTopbar();
  wireOverlayDismiss();
  updateConnectionPill();
  window.addEventListener('online', updateConnectionPill);
  window.addEventListener('offline', updateConnectionPill);

  try {
    State.settings = await DB.getSettings();
    Utils.currencySymbol = State.settings.currency || 'KSh';
    applyTheme(State.settings.theme || 'system');
    updateCurrencyLabels();
    await refreshData();
    renderDashboard();
    Customers.render();
    Transactions.render();
    Reports.render();
    Settings.render();
  } catch (err) {
    console.error(err);
    showFatalError(err);
  }

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(e => console.warn('SW registration failed', e));
  }
  wireInstallPrompt();
}

async function refreshData() {
  const [customers, transactions] = await Promise.all([DB.getAllCustomers(), DB.getAllTransactions()]);
  State.customers = customers.sort((a, b) => a.name.localeCompare(b.name));
  State.transactions = transactions;
}

function showFatalError(err) {
  const main = document.getElementById('mainContent');
  main.innerHTML = `<div class="empty"><div class="glyph">!</div><h3>Couldn't open the local database</h3>
    <p>${Utils.esc(err.message || 'An unknown error occurred.')} Try reloading the app. Your data has not been deleted.</p></div>`;
}

// ---------- Theme ----------
function applyTheme(pref) {
  const root = document.documentElement;
  if (pref === 'dark') root.setAttribute('data-theme', 'dark');
  else if (pref === 'light') root.setAttribute('data-theme', 'light');
  else {
    const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.setAttribute('data-theme', dark ? 'dark' : 'light');
  }
}

// ---------- Navigation ----------
function wireNav() {
  document.querySelectorAll('.bottomnav button[data-view]').forEach(btn => {
    btn.addEventListener('click', () => switchView(btn.dataset.view));
  });
}

function switchView(view, opts = {}) {
  State.currentView = view;
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === 'view-' + view));
  document.querySelectorAll('.bottomnav button[data-view]').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  document.getElementById('mainContent').scrollTop = 0;
  window.scrollTo(0, 0);
  if (view === 'dashboard') renderDashboard();
  if (view === 'customers') Customers.render();
  if (view === 'transactions') Transactions.render();
  if (view === 'reports') Reports.render();
  if (view === 'settings') Settings.render();
}
window.switchView = switchView;

function wireTopbar() {
  document.getElementById('themeToggleBtn').addEventListener('click', () => {
    const current = State.settings.theme || 'system';
    const next = current === 'light' ? 'dark' : current === 'dark' ? 'system' : 'light';
    Settings.setTheme(next);
  });
}

function updateConnectionPill() {
  const pill = document.getElementById('connPill');
  if (!pill) return;
  const online = navigator.onLine;
  pill.classList.toggle('offline', !online);
  pill.querySelector('.pill-label').textContent = online ? 'Online' : 'Offline';
}

// ---------- Dashboard ----------
function computeTotals() {
  let totalOwed = 0, totalDebt = 0, totalPaid = 0, customersOwing = 0;
  for (const c of State.customers) {
    totalDebt += c.totalBorrowed || 0;
    totalPaid += c.totalPaid || 0;
    if ((c.balance || 0) > 0) { totalOwed += c.balance; customersOwing++; }
  }
  return {
    totalOwed, totalDebt, totalPaid,
    customersOwing,
    totalCustomers: State.customers.length,
    totalTransactions: State.transactions.length
  };
}

function renderDashboard() {
  const t = computeTotals();
  const wrap = document.getElementById('dashboardContent');

  const recentDebts = State.transactions.filter(x => x.type === 'debt').sort(Utils.sortByDateDesc).slice(0, 4);
  const recentPayments = State.transactions.filter(x => x.type === 'payment').sort(Utils.sortByDateDesc).slice(0, 4);

  wrap.innerHTML = `
    <div class="hero-total">
      <div class="label">Total Outstanding</div>
      <div class="value num">${Utils.esc(Utils.formatMoney(t.totalOwed))}</div>
      <div class="foot">
        <span>Owed by <b>${t.customersOwing}</b> customer${t.customersOwing === 1 ? '' : 's'}</span>
      </div>
    </div>

    <div class="stat-grid" style="margin-top:14px;">
      <div class="stat-card owed"><div class="label">Debt Issued</div><div class="value num">${Utils.esc(Utils.formatMoney(t.totalDebt))}</div></div>
      <div class="stat-card paid"><div class="label">Payments Received</div><div class="value num">${Utils.esc(Utils.formatMoney(t.totalPaid))}</div></div>
      <div class="stat-card count"><div class="label">Customers</div><div class="value num">${t.totalCustomers}</div></div>
      <div class="stat-card txn"><div class="label">Transactions</div><div class="value num">${t.totalTransactions}</div></div>
    </div>

    <div class="section-title"><h2>Recently Added Debts</h2><a data-goto="transactions">See all</a></div>
    ${renderMiniTxnList(recentDebts, 'No debts recorded yet.')}

    <div class="section-title"><h2>Recently Received Payments</h2><a data-goto="transactions">See all</a></div>
    ${renderMiniTxnList(recentPayments, 'No payments recorded yet.')}
  `;

  wrap.querySelectorAll('[data-goto]').forEach(el => el.addEventListener('click', () => switchView(el.dataset.goto)));
  wrap.querySelectorAll('.row-card[data-id]').forEach(el => {
    el.addEventListener('click', () => openCustomerProfile(el.dataset.custid));
  });
}

function renderMiniTxnList(items, emptyText) {
  if (!items.length) return `<div class="empty" style="padding:24px 10px;"><p>${Utils.esc(emptyText)}</p></div>`;
  return `<div class="list">${items.map(txn => {
    const c = State.customers.find(x => x.id === txn.customerId);
    const name = c ? c.name : 'Unknown customer';
    return `
      <div class="row-card" data-id="${txn.id}" data-custid="${txn.customerId}">
        <div class="avatar">${Utils.esc(Utils.initials(name))}</div>
        <div class="row-main">
          <div class="title">${Utils.esc(name)}</div>
          <div class="subtitle">${Utils.esc(txn.description || (txn.type === 'payment' ? (txn.paymentMethod || 'Payment') : 'Debt'))}</div>
        </div>
        <div class="row-end">
          <div class="amt num ${txn.type === 'payment' ? 'paid' : 'owed'}">${Utils.esc(Utils.formatSignedMoney(txn.amount, txn.type))}</div>
          <div class="meta">${Utils.esc(Utils.formatDate(txn.date))}</div>
        </div>
      </div>`;
  }).join('')}</div>`;
}

// ---------- FAB / action sheet ----------
function wireFab() {
  document.getElementById('fabBtn').addEventListener('click', () => openSheet('fabSheet'));
  document.getElementById('fabAddCustomer').addEventListener('click', () => { closeSheet('fabSheet'); Customers.openForm(); });
  document.getElementById('fabRecordDebt').addEventListener('click', () => { closeSheet('fabSheet'); Transactions.openPickerThen('debt'); });
  document.getElementById('fabRecordPayment').addEventListener('click', () => { closeSheet('fabSheet'); Transactions.openPickerThen('payment'); });
}

// ---------- Generic sheet / dialog handling ----------
function openSheet(id) {
  const overlay = document.getElementById(id);
  if (!overlay) return;
  overlay.classList.add('active');
  document.body.style.overflow = 'hidden';
}
function closeSheet(id) {
  const overlay = document.getElementById(id);
  if (!overlay) return;
  overlay.classList.remove('active');
  const anyOpen = document.querySelector('.overlay.active');
  if (!anyOpen) document.body.style.overflow = '';
}
function closeAllSheets() {
  document.querySelectorAll('.overlay.active').forEach(o => o.classList.remove('active'));
  document.body.style.overflow = '';
}
window.openSheet = openSheet;
window.closeSheet = closeSheet;
window.closeAllSheets = closeAllSheets;

function wireOverlayDismiss() {
  document.querySelectorAll('.overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeSheet(overlay.id);
    });
  });
  document.querySelectorAll('[data-close-sheet]').forEach(btn => {
    btn.addEventListener('click', () => closeSheet(btn.closest('.overlay').id));
  });
}

// Reusable confirm dialog. Returns a Promise<boolean>.
function confirmDialog({ title, message, confirmLabel = 'Confirm', danger = true, glyph = '!' }) {
  return new Promise((resolve) => {
    const overlay = document.getElementById('confirmDialog');
    overlay.querySelector('.glyph').textContent = glyph;
    overlay.querySelector('.dlg-title').textContent = title;
    overlay.querySelector('.dlg-message').textContent = message;
    const okBtn = overlay.querySelector('.dlg-confirm');
    const cancelBtn = overlay.querySelector('.dlg-cancel');
    okBtn.textContent = confirmLabel;
    okBtn.className = 'btn ' + (danger ? 'btn-danger' : 'btn-primary');

    const cleanup = (result) => {
      okBtn.removeEventListener('click', onOk);
      cancelBtn.removeEventListener('click', onCancel);
      closeSheet('confirmDialog');
      resolve(result);
    };
    const onOk = () => cleanup(true);
    const onCancel = () => cleanup(false);
    okBtn.addEventListener('click', onOk);
    cancelBtn.addEventListener('click', onCancel);
    openSheet('confirmDialog');
  });
}
window.confirmDialog = confirmDialog;

// ---------- Customer profile navigation (shared by all modules) ----------
function openCustomerProfile(customerId) {
  State.currentCustomerId = customerId;
  Profile.render(customerId);
  switchView('profile');
}
window.openCustomerProfile = openCustomerProfile;

// ---------- Install prompt ----------
let deferredInstallPrompt = null;
function wireInstallPrompt() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    document.getElementById('installBtn').style.display = 'flex';
  });
  const btn = document.getElementById('installBtn');
  if (btn) {
    btn.addEventListener('click', async () => {
      if (!deferredInstallPrompt) return;
      deferredInstallPrompt.prompt();
      await deferredInstallPrompt.userChoice;
      deferredInstallPrompt = null;
      btn.style.display = 'none';
    });
  }
  window.addEventListener('appinstalled', () => {
    const b = document.getElementById('installBtn');
    if (b) b.style.display = 'none';
    Toast.show('App installed', 'success');
  });
}

function updateCurrencyLabels() {
  document.querySelectorAll('.currency-input .prefix').forEach(el => { el.textContent = Utils.currencySymbol; });
}
window.updateCurrencyLabels = updateCurrencyLabels;

// Called by feature modules after any write, to keep everything consistent.
async function afterDataChange() {
  await refreshData();
  updateCurrencyLabels();
  if (State.currentView === 'dashboard') renderDashboard();
  if (State.currentView === 'customers') Customers.render();
  if (State.currentView === 'transactions') Transactions.render();
  if (State.currentView === 'reports') Reports.render();
  if (State.currentView === 'profile' && State.currentCustomerId) Profile.render(State.currentCustomerId);
}
window.afterDataChange = afterDataChange;
