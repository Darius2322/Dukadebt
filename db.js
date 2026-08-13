/* =========================================================
   db.js — IndexedDB access layer
   Single source of truth for all persisted data.
   All writes go through transactions; balances are derived
   from transactions, never trusted as a lone stored value.
   ========================================================= */

const DB_NAME = 'duka-ledger';
const DB_VERSION = 2;

const STORES = {
  customers: 'customers',
  transactions: 'transactions',
  settings: 'settings',
  activity: 'activity'
};

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (event) => {
      const db = req.result;
      const oldVersion = event.oldVersion;

      if (oldVersion < 1) {
        const customers = db.createObjectStore(STORES.customers, { keyPath: 'id' });
        customers.createIndex('name', 'name', { unique: false });
        customers.createIndex('phone', 'phone', { unique: false });
        customers.createIndex('createdAt', 'createdAt', { unique: false });

        const transactions = db.createObjectStore(STORES.transactions, { keyPath: 'id' });
        transactions.createIndex('customerId', 'customerId', { unique: false });
        transactions.createIndex('type', 'type', { unique: false });
        transactions.createIndex('date', 'date', { unique: false });
        transactions.createIndex('createdAt', 'createdAt', { unique: false });

        db.createObjectStore(STORES.settings, { keyPath: 'id' });
      }
      if (oldVersion < 2) {
        const activity = db.createObjectStore(STORES.activity, { keyPath: 'id' });
        activity.createIndex('timestamp', 'timestamp', { unique: false });
        activity.createIndex('notify', 'notify', { unique: false });
      }
      // Future schema migrations append here as `if (oldVersion < N) { ... }`
    };

    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => { db.close(); };
      resolve(db);
    };

    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('Database upgrade blocked by another open tab.'));
  });
  return dbPromise;
}

function tx(storeNames, mode, fn) {
  return openDB().then(db => new Promise((resolve, reject) => {
    let t;
    try {
      t = db.transaction(storeNames, mode);
    } catch (err) {
      reject(err);
      return;
    }
    let result;
    t.oncomplete = () => resolve(result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error || new Error('Transaction aborted'));
    try {
      const maybe = fn(t);
      if (maybe && typeof maybe.then === 'function') {
        maybe.then(r => { result = r; }).catch(err => { try { t.abort(); } catch(e){}; reject(err); });
      } else {
        result = maybe;
      }
    } catch (err) {
      try { t.abort(); } catch (e) {}
      reject(err);
    }
  }));
}

function reqToPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function uid() {
  return (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Date.now() + '-' + Math.random().toString(16).slice(2));
}

const DB = {
  uid,

  // ---------- Customers ----------
  async addCustomer(data) {
    const now = new Date().toISOString();
    const customer = {
      id: uid(),
      name: (data.name || '').trim(),
      phone: (data.phone || '').trim(),
      address: (data.address || '').trim(),
      notes: (data.notes || '').trim(),
      createdAt: now,
      updatedAt: now
    };
    await tx([STORES.customers], 'readwrite', (t) => {
      t.objectStore(STORES.customers).add(customer);
    });
    return customer;
  },

  async updateCustomer(id, patch) {
    return tx([STORES.customers], 'readwrite', async (t) => {
      const store = t.objectStore(STORES.customers);
      const existing = await reqToPromise(store.get(id));
      if (!existing) throw new Error('Customer not found');
      const updated = { ...existing, ...patch, id, updatedAt: new Date().toISOString() };
      store.put(updated);
      return updated;
    });
  },

  async deleteCustomer(id) {
    return tx([STORES.customers, STORES.transactions], 'readwrite', async (t) => {
      const txStore = t.objectStore(STORES.transactions);
      const idx = txStore.index('customerId');
      const items = await reqToPromise(idx.getAll(id));
      for (const item of items) txStore.delete(item.id);
      t.objectStore(STORES.customers).delete(id);
    });
  },

  async getCustomer(id) {
    return tx([STORES.customers], 'readonly', (t) => reqToPromise(t.objectStore(STORES.customers).get(id)));
  },

  async getAllCustomers() {
    return tx([STORES.customers], 'readonly', (t) => reqToPromise(t.objectStore(STORES.customers).getAll()));
  },

  // ---------- Transactions ----------
  async addTransaction(data) {
    const now = new Date().toISOString();
    const txn = {
      id: uid(),
      customerId: data.customerId,
      type: data.type, // 'debt' | 'payment' | 'adjustment'
      amount: Number(data.amount) || 0,
      description: (data.description || '').trim(),
      paymentMethod: data.paymentMethod || null,
      confirmationName: (data.confirmationName || '').trim(),
      notes: (data.notes || '').trim(),
      date: data.date || now,
      createdAt: now
    };
    await tx([STORES.transactions, STORES.customers], 'readwrite', async (t) => {
      t.objectStore(STORES.transactions).add(txn);
      await touchCustomer(t, txn.customerId);
    });
    return txn;
  },

  async updateTransaction(id, patch) {
    return tx([STORES.transactions, STORES.customers], 'readwrite', async (t) => {
      const store = t.objectStore(STORES.transactions);
      const existing = await reqToPromise(store.get(id));
      if (!existing) throw new Error('Transaction not found');
      const updated = {
        ...existing,
        ...patch,
        amount: patch.amount !== undefined ? Number(patch.amount) || 0 : existing.amount,
        id
      };
      store.put(updated);
      await touchCustomer(t, updated.customerId);
      if (existing.customerId !== updated.customerId) await touchCustomer(t, existing.customerId);
      return updated;
    });
  },

  async deleteTransaction(id) {
    return tx([STORES.transactions, STORES.customers], 'readwrite', async (t) => {
      const store = t.objectStore(STORES.transactions);
      const existing = await reqToPromise(store.get(id));
      if (!existing) return;
      store.delete(id);
      await touchCustomer(t, existing.customerId);
    });
  },

  async getTransactionsForCustomer(customerId) {
    return tx([STORES.transactions], 'readonly', (t) =>
      reqToPromise(t.objectStore(STORES.transactions).index('customerId').getAll(customerId))
    );
  },

  async getAllTransactions() {
    return tx([STORES.transactions], 'readonly', (t) => reqToPromise(t.objectStore(STORES.transactions).getAll()));
  },

  // ---------- Settings ----------
  async getSettings() {
    const rows = await tx([STORES.settings], 'readonly', (t) => reqToPromise(t.objectStore(STORES.settings).getAll()));
    if (rows.length) return migratePaymentMethodFields(rows[0]);
    const defaults = {
      id: 'default',
      businessName: 'My Shop',
      businessPhone: '',
      businessLocation: '',
      currency: 'KSh',
      receiptFooter: 'Thank you for your business.',
      theme: 'system',
      allowOverpayment: false,
      soundEnabled: true,
      pushEnabled: false,
      methodTillEnabled: false, methodTillNumber: '',
      methodPochiEnabled: false, methodPochiNumber: '',
      methodSendEnabled: false, methodSendNumber: '',
      methodPaybillEnabled: false, methodPaybillNumber: '', methodPaybillAccount: '',
      methodOtherEnabled: false, methodOtherDetails: '',
      migratedPaymentMethodsV2: true,
      supportPhone: '',
      supportEmail: '',
      pinHash: '',
      pinSalt: '',
      biometricEnabled: false,
      biometricCredentialId: ''
    };
    await tx([STORES.settings], 'readwrite', (t) => t.objectStore(STORES.settings).put(defaults));
    return defaults;
  },

  async saveSettings(patch) {
    return tx([STORES.settings], 'readwrite', async (t) => {
      const store = t.objectStore(STORES.settings);
      const rows = await reqToPromise(store.getAll());
      const current = rows[0] || { id: 'default' };
      const updated = { ...current, ...patch, id: 'default' };
      store.put(updated);
      return updated;
    });
  },

  // ---------- Activity log (History + Notifications) ----------
  async logActivity(type, message, opts = {}) {
    const entry = {
      id: uid(),
      type,
      message,
      timestamp: new Date().toISOString(),
      notify: opts.notify !== false,
      read: false
    };
    await tx([STORES.activity], 'readwrite', (t) => { t.objectStore(STORES.activity).add(entry); });
    return entry;
  },

  async getActivity(limit = 500) {
    const rows = await tx([STORES.activity], 'readonly', (t) => reqToPromise(t.objectStore(STORES.activity).getAll()));
    return rows.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, limit);
  },

  async getUnreadNotificationCount() {
    const rows = await this.getActivity(1000);
    return rows.filter(r => r.notify && !r.read).length;
  },

  async markAllNotificationsRead() {
    return tx([STORES.activity], 'readwrite', async (t) => {
      const store = t.objectStore(STORES.activity);
      const rows = await reqToPromise(store.getAll());
      for (const r of rows) {
        if (r.notify && !r.read) store.put({ ...r, read: true });
      }
    });
  },

  async clearActivity() {
    return tx([STORES.activity], 'readwrite', (t) => t.objectStore(STORES.activity).clear());
  },

  // ---------- Backup / Restore ----------
  async exportAll() {
    const [customers, transactions, settings, activity] = await Promise.all([
      this.getAllCustomers(),
      this.getAllTransactions(),
      this.getSettings(),
      this.getActivity(5000)
    ]);
    return {
      app: 'duka-ledger',
      exportedAt: new Date().toISOString(),
      version: DB_VERSION,
      data: { customers, transactions, settings, activity }
    };
  },

  async restoreAll(payload) {
    if (!payload || typeof payload !== 'object' || !payload.data) {
      throw new Error('This file is not a valid backup.');
    }
    const { customers, transactions, settings, activity } = payload.data;
    if (!Array.isArray(customers) || !Array.isArray(transactions)) {
      throw new Error('Backup file is missing customers or transactions.');
    }
    for (const c of customers) {
      if (!c.id || typeof c.name !== 'string') throw new Error('Backup contains an invalid customer record.');
    }
    for (const t of transactions) {
      if (!t.id || !t.customerId || !['debt', 'payment', 'adjustment'].includes(t.type)) {
        throw new Error('Backup contains an invalid transaction record.');
      }
    }

    return tx([STORES.customers, STORES.transactions, STORES.settings, STORES.activity], 'readwrite', async (t) => {
      const cStore = t.objectStore(STORES.customers);
      const tStore = t.objectStore(STORES.transactions);
      const sStore = t.objectStore(STORES.settings);
      const aStore = t.objectStore(STORES.activity);

      await reqToPromise(cStore.clear());
      await reqToPromise(tStore.clear());
      await reqToPromise(sStore.clear());
      await reqToPromise(aStore.clear());

      for (const c of customers) cStore.put(c);
      for (const tr of transactions) tStore.put(tr);
      if (settings) sStore.put({ ...settings, id: 'default' });
      if (Array.isArray(activity)) for (const a of activity) aStore.put(a);
    });
  }
};

// Recompute and persist a customer's derived totals from their transactions.
// Balances are always recalculated from the transaction log (source of truth).
async function touchCustomer(t, customerId) {
  if (!customerId) return;
  const cStore = t.objectStore(STORES.customers);
  const customer = await reqToPromise(cStore.get(customerId));
  if (!customer) return;

  const txStore = t.objectStore(STORES.transactions);
  const items = await reqToPromise(txStore.index('customerId').getAll(customerId));

  let totalDebt = 0, totalPaid = 0;
  for (const it of items) {
    if (it.type === 'debt') totalDebt += it.amount;
    else if (it.type === 'payment') totalPaid += it.amount;
    else if (it.type === 'adjustment') totalDebt += it.amount; // can be negative to reduce balance
  }
  const balance = totalDebt - totalPaid;

  cStore.put({
    ...customer,
    totalBorrowed: totalDebt,
    totalPaid,
    balance,
    transactionCount: items.length,
    lastTransactionDate: items.length ? items.map(i => i.date).sort().slice(-1)[0] : null,
    updatedAt: new Date().toISOString()
  });
}

// One-time migration: the old settings shape had a single combined
// "Pochi / Till" number field and a separate Paybill field. The new
// shape lets each payment method be toggled on/off independently, so
// existing values are carried over into both Till and Pochi (since the
// old field covered either) and Paybill, without losing any data.
async function migratePaymentMethodFields(settings) {
  if (settings.migratedPaymentMethodsV2) return settings;

  const patch = { migratedPaymentMethodsV2: true };
  if (settings.pochiNumber) {
    patch.methodTillEnabled = true;
    patch.methodTillNumber = settings.pochiNumber;
    patch.methodPochiEnabled = true;
    patch.methodPochiNumber = settings.pochiNumber;
  }
  if (settings.paybillNumber) {
    patch.methodPaybillEnabled = true;
    patch.methodPaybillNumber = settings.paybillNumber;
    patch.methodPaybillAccount = settings.paybillAccount || '';
  }
  const updated = { ...settings, ...patch };
  await tx([STORES.settings], 'readwrite', (t) => t.objectStore(STORES.settings).put(updated));
  return updated;
}

window.DB = DB;
