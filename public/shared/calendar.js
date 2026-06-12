// ===== Activity Calendar Component =====
class ActivityCalendar {
  constructor(container, opts = {}) {
    this.container = container;
    this.viewDate = new Date();
    this.activities = [];
    this.onSelectDate = opts.onSelectDate || null;
    this.onClickActivity = opts.onClickActivity || (a => location.href = `/activity-detail?id=${a.id}`);
    this.render();
    this.fetchMonth();
  }

  async fetchMonth() {
    const y = this.viewDate.getFullYear();
    const m = this.viewDate.getMonth();
    const start = `${y}-${pad2(m+1)}-01`;
    const endDate = new Date(y, m+1, 0);
    const end = `${y}-${pad2(m+1)}-${pad2(endDate.getDate())}`;
    try {
      const data = await api.get(`/api/activities?from=${start}&to=${end}&limit=200`);
      this.activities = data.activities || [];
      this.render();
    } catch (e) {
      console.error(e);
    }
  }

  prev() { this.viewDate = new Date(this.viewDate.getFullYear(), this.viewDate.getMonth()-1, 1); this.fetchMonth(); }
  next() { this.viewDate = new Date(this.viewDate.getFullYear(), this.viewDate.getMonth()+1, 1); this.fetchMonth(); }
  today() { this.viewDate = new Date(); this.fetchMonth(); }

  render() {
    const y = this.viewDate.getFullYear();
    const m = this.viewDate.getMonth();
    const firstDay = new Date(y, m, 1).getDay();
    const daysInMonth = new Date(y, m+1, 0).getDate();
    const todayISO = toISO(new Date());

    // group by every date touched by each activity
    const byDate = {};
    this.activities.forEach(a => {
      const start = parseISO(a.date.slice(0, 10));
      const end = a.end_date ? parseISO(a.end_date.slice(0, 10)) : start;
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const iso = toISO(d);
        (byDate[iso] = byDate[iso] || []).push(a);
      }
    });

    let cells = '';
    for (let i = 0; i < firstDay; i++) cells += '<div class="cal-cell empty"></div>';
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = `${y}-${pad2(m+1)}-${pad2(d)}`;
      const list = byDate[iso] || [];
      const isToday = iso === todayISO;
      const dots = list.slice(0, 3).map(a => {
        const statusCls = a.status === 'cancelled' ? 'dot-cancel' : a.status === 'closed' ? 'dot-closed' : '';
        return `<div class="cal-event cal-cat-${categoryThemeKey(a)} ${statusCls}" data-id="${a.id}" title="${a.title}">${a.start_time ? a.start_time.slice(0,5) + ' ' : ''}${a.title}</div>`;
      }).join('');
      const more = list.length > 3 ? `<div class="cal-more">+${list.length - 3} เพิ่มเติม</div>` : '';
      cells += `
        <div class="cal-cell${isToday ? ' today' : ''}" data-date="${iso}">
          <div class="cal-day-num">${d}</div>
          ${dots}${more}
        </div>`;
    }

    this.container.innerHTML = `
      <div class="cal-header">
        <button class="btn btn-outline btn-sm cal-nav" data-act="today">วันนี้</button>
        <div class="cal-nav-group">
          <button class="btn btn-ghost btn-sm cal-nav" data-act="prev">${icon('chevron-left', { size: 18 })}</button>
          <div class="cal-title">${THAI_MONTHS[m]} ${y + 543}</div>
          <button class="btn btn-ghost btn-sm cal-nav" data-act="next">${icon('chevron-right', { size: 18 })}</button>
        </div>
        <div class="cal-legend"><span>สีของกิจกรรมแยกตามประเภท</span></div>
      </div>
      <div class="cal-days">${THAI_DAYS.map(d => `<div class="cal-day-label">${d}</div>`).join('')}</div>
      <div class="cal-grid">${cells}</div>`;

    this.container.querySelector('[data-act="prev"]').onclick = () => this.prev();
    this.container.querySelector('[data-act="next"]').onclick = () => this.next();
    this.container.querySelector('[data-act="today"]').onclick = () => this.today();
    this.container.querySelectorAll('.cal-event[data-id]').forEach(el => {
      el.onclick = (e) => {
        e.stopPropagation();
        const id = +el.dataset.id;
        const a = this.activities.find(x => x.id === id);
        if (a) this.onClickActivity(a);
      };
    });
    if (this.onSelectDate) {
      this.container.querySelectorAll('.cal-cell[data-date]').forEach(el => {
        el.onclick = () => this.onSelectDate(el.dataset.date);
      });
    }
  }
}
