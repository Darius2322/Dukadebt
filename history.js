/* =========================================================
   history.js — full activity/audit log ("every record stored")
   ========================================================= */

const History = {
  async open() {
    await this.render();
    openSheet('historySheet');
  },

  async render() {
    const wrap = document.getElementById('historyList');
    const items = await DB.getActivity(1000);
    if (!items.length) {
      wrap.innerHTML = `<div class="empty" style="padding:30px 10px;"><div class="glyph">${Icon('history', { size: 26 })}</div><h3>No History Yet</h3><p>Every action you take will be recorded here.</p></div>`;
      return;
    }
    wrap.innerHTML = items.map(item => `
      <div class="list-row">
        <div class="ic">${ICONS[item.type] ? Icon(ICONS[item.type]) : '•'}</div>
        <div class="body">
          <div class="t">${Utils.esc(item.message)}</div>
          <div class="s">${Utils.esc(Utils.formatDateTimeShort(item.timestamp))}</div>
        </div>
      </div>
    `).join('');
  }
};

window.History = History;
