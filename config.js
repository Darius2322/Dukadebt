/* =========================================================
   config.js — app-wide configuration values.

   This file is intentionally separate from every other script.
   Unlike the rest of the app, it is NOT regenerated when Duka
   Ledger is updated — so once GOOGLE_CLIENT_ID is filled in here,
   it survives every future version without needing to be
   re-entered. If you're replacing files in GitHub for an update,
   this file only needs to be touched once, the first time you set
   up Google Drive backup.
   ========================================================= */

window.DUKA_CONFIG = {
  // From Google Cloud Console → Google Auth Platform → Clients.
  // Looks like: 123456789-abc123.apps.googleusercontent.com
  GOOGLE_CLIENT_ID: '535826355519-7d2ra2qe8a28kmhaf073l74j7mffmimg.apps.googleusercontent.com'
};
