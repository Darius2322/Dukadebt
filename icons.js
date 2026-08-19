/* =========================================================
   icons.js — local icon set, styled to match the bottom nav's
   existing hand-built icons (stroke-based, 24x24, currentColor).

   Deliberately NOT loaded from a CDN: icons are core UI, used on
   every screen, and this app promises to work fully offline from
   the very first cached load. A network-dependent icon font or
   script would risk blank icons on a slow connection. Inline SVG
   has zero runtime dependency and renders instantly.

   Usage: Icon('trash-2') returns a ready-to-insert <svg> string.
   Icon('trash-2', { size: 20, className: 'foo' }) for custom size.
   ========================================================= */

const ICON_PATHS = {
  'x': '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  'check': '<path d="M20 6 9 17l-5-5"/>',
  'check-circle': '<path d="M21.8 10A10 10 0 1 1 17 3.3"/><path d="m9 11 3 3L22 4"/>',
  'download': '<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/>',
  'upload': '<path d="M12 21V9"/><path d="m7 14 5-5 5 5"/><path d="M5 21h14"/>',
  'alert-triangle': '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  'message-circle': '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>',
  'pencil': '<path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/>',
  'trash-2': '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M10 11v6"/><path d="M14 11v6"/>',
  'banknote': '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01"/><path d="M18 12h.01"/>',
  'cloud': '<path d="M17.5 19a4.5 4.5 0 1 0-1.4-8.8A6 6 0 1 0 6.5 19h11Z"/>',
  'chevron-left': '<path d="m15 18-6-6 6-6"/>',
  'user': '<path d="M20 21a8 8 0 0 0-16 0"/><circle cx="12" cy="7" r="4"/>',
  'users': '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9"/><path d="M16 3.1a4 4 0 0 1 0 7.8"/>',
  'bell': '<path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/><path d="M3.3 16.9c-.8.9-.2 2.1 1 2.1h15.4c1.2 0 1.8-1.2 1-2.1A16 16 0 0 1 18 8a6 6 0 0 0-12 0 16 16 0 0 1-2.7 8.9Z"/>',
  'file-text': '<path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5Z"/><path d="M14 2v6h6"/><path d="M9 13h6"/><path d="M9 17h6"/>',
  'rotate-ccw': '<path d="M3 12a9 9 0 1 0 2.6-6.4L3 8"/><path d="M3 3v5h5"/>',
  'history': '<path d="M3 12a9 9 0 1 0 2.6-6.4L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l3 3"/>',
  'paperclip': '<path d="m21.4 11.4-8.8 8.8a5 5 0 0 1-7-7l8.5-8.5a3.5 3.5 0 0 1 5 5L10.4 18.4a2 2 0 0 1-2.8-2.8l7.4-7.4"/>',
  'user-round': '<circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/>',
  'plus': '<path d="M12 5v14"/><path d="M5 12h14"/>',
  'settings': '<path d="M9.7 3.3a2 2 0 0 1 4.6 0l.1.3a2 2 0 0 0 2.9 1.2l.3-.2a2 2 0 0 1 3 2.6l-.2.3a2 2 0 0 0 0 3l.2.3a2 2 0 0 1-3 2.6l-.3-.2a2 2 0 0 0-2.9 1.2l-.1.3a2 2 0 0 1-4.6 0l-.1-.3a2 2 0 0 0-2.9-1.2l-.3.2a2 2 0 0 1-3-2.6l.2-.3a2 2 0 0 0 0-3l-.2-.3a2 2 0 0 1 3-2.6l.3.2a2 2 0 0 0 2.9-1.2Z"/><circle cx="12" cy="12" r="3"/>',
  'lock': '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  'lock-open': '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.5-2.2"/>',
  'sparkles': '<path d="M12 3v4M3 12h4M19 12h2M12 19v2M5.6 5.6l1.4 1.4M17 7l1.4-1.4M6.5 17.5 5.6 18.4"/><path d="m12 8-1.5 3.5L7 13l3.5 1.5L12 18l1.5-3.5L17 13l-3.5-1.5Z"/>',
  'mail': '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 6-10 7L2 6"/>',
  'map-pin': '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
  'notebook-pen': '<path d="M13.4 2.6a2.1 2.1 0 1 1 3 3L7 15l-4 1 1-4Z"/><path d="M2 6h4"/><path d="M2 10h4"/><path d="M2 14h3"/><path d="M2 18h4"/>',
  'fingerprint': '<path d="M12 10a2 2 0 0 0-2 2c0 1.6-.3 3.9-1 5.5"/><path d="M7 19.3c1-1.7 1.5-4.5 1.5-7.3a3.5 3.5 0 1 1 7 0v1"/><path d="M4.5 15a17 17 0 0 0 .9-5.5A6.6 6.6 0 0 1 12 3a6.5 6.5 0 0 1 5 2.3"/><path d="M17.9 8A6.5 6.5 0 0 1 18.5 11c0 1.8-.1 3.5-.4 5"/><path d="M16 20.4a15 15 0 0 0 1.5-6.9"/>',
  'book-open': '<path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3Z"/>',
  'shield-check': '<path d="M20 13c0 5-3.5 7.5-7.7 9a1 1 0 0 1-.7 0C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.2-2.7a1 1 0 0 1 1.6 0C14.5 3.8 17 5 19 5a1 1 0 0 1 1 1Z"/><path d="m9 12 2 2 4-4"/>',
  'refresh-cw': '<path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 21v-5h5"/>',
  'link': '<path d="M9 17H7A5 5 0 0 1 7 7h2"/><path d="M15 7h2a5 5 0 1 1 0 10h-2"/><path d="M8 12h8"/>',
  'arrow-up': '<path d="M12 19V5"/><path d="m5 12 7-7 7 7"/>',
  'store': '<path d="M2 7h20l-1.5 5.5a2 2 0 0 1-2 1.5H5.5a2 2 0 0 1-2-1.5Z"/><path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7"/><path d="M9 21v-5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v5"/><path d="m4 7 1.5-4h13L20 7"/>',
  'smartphone': '<rect x="6" y="2" width="12" height="20" rx="2"/><path d="M11 18h2"/>',
  'send': '<path d="M14.5 12.8 3 17l4.2-11.5L21 3Z"/><path d="m10 14 4-4"/>',
  'receipt': '<path d="M4 2v20l2-1.5L8 22l2-1.5L12 22l2-1.5L16 22l2-1.5L20 22V2l-2 1.5L16 2l-2 1.5L12 2l-2 1.5L8 2 6 3.5Z"/><path d="M8 8h8"/><path d="M8 12h8"/><path d="M8 16h5"/>',
  'landmark': '<path d="M3 22h18"/><path d="M4 10h16"/><path d="M4 22V10"/><path d="M20 22V10"/><path d="m2 10 10-7 10 7"/><path d="M8 10v12"/><path d="M16 10v12"/>',
  'more-horizontal': '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
  'printer': '<path d="M6 9V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8" rx="1"/>',
  'clipboard': '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h1a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h1"/>',
  'cup-soda': '<path d="M11 12h4.5"/><path d="M12.8 3.4 15 8.8"/><path d="M15 8.8 6 9l1.5 11a2 2 0 0 0 2 1.8h5a2 2 0 0 0 2-1.8L18 9l-3 -.2"/><path d="m2 7 3 2 1.5-2.5L9 8l2-3 2.5 1.5L15 3l3 2 2-1"/>',
  'info': '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
  'shield': '<path d="M20 13c0 5-3.5 7.5-7.7 9a1 1 0 0 1-.7 0C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.2-2.7a1 1 0 0 1 1.6 0C14.5 3.8 17 5 19 5a1 1 0 0 1 1 1Z"/>',
};

function Icon(name, opts = {}) {
  const size = opts.size || 20;
  const cls = opts.className || '';
  const body = ICON_PATHS[name];
  if (!body) return ''; // unknown icon name — fail quietly, never throw
  return `<svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
}

// For static HTML that can't call Icon() directly: mark a spot with
// <i data-icon="trash-2"></i> and this fills it in once the DOM is ready.
function hydrateStaticIcons(root = document) {
  root.querySelectorAll('[data-icon]').forEach(el => {
    const name = el.getAttribute('data-icon');
    const size = el.getAttribute('data-icon-size');
    el.innerHTML = Icon(name, size ? { size: parseInt(size, 10) } : {});
  });
}

document.addEventListener('DOMContentLoaded', () => hydrateStaticIcons());

window.Icon = Icon;
window.hydrateStaticIcons = hydrateStaticIcons;
