// ===== Custom Date & Time Picker =====
// Thai locale, theme-matching, no external lib
const THAI_MONTHS = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
const THAI_MONTHS_SHORT = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
const THAI_DAYS = ['อา.','จ.','อ.','พ.','พฤ.','ศ.','ส.'];

function pad2(n) { return String(n).padStart(2, '0'); }
function toISO(d) { return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`; }
function parseISO(s) { if (!s) return null; const [y,m,d] = s.split('-').map(Number); return new Date(y, m-1, d); }

function formatThaiDate(iso) {
  if (!iso) return '';
  const d = parseISO(iso);
  if (!d) return '';
  return `${d.getDate()} ${THAI_MONTHS_SHORT[d.getMonth()]} ${d.getFullYear() + 543}`;
}

// Replace any input[data-date] with a custom picker
function initDatePicker(input) {
  if (input._dpInit) return;
  input._dpInit = true;

  const wrap = document.createElement('div');
  wrap.className = 'dp-wrap';

  const display = document.createElement('button');
  display.type = 'button';
  display.className = 'form-control dp-trigger';
  display.innerHTML = `<span class="dp-value">${input.value ? formatThaiDate(input.value) : 'เลือกวันที่'}</span>${icon('calendar', { size: 16 })}`;

  input.type = 'hidden';
  input.parentNode.insertBefore(wrap, input);
  wrap.appendChild(display);
  wrap.appendChild(input);

  let viewDate = input.value ? parseISO(input.value) : new Date();
  let selected = input.value ? parseISO(input.value) : null;
  let panel = null;

  display.addEventListener('click', e => {
    e.stopPropagation();
    if (panel) { close(); return; }
    open();
  });

  function open() {
    panel = document.createElement('div');
    panel.className = 'dp-panel';
    render();
    document.body.appendChild(panel);
    positionPanel();
    setTimeout(() => document.addEventListener('click', outsideClick), 0);
    window.addEventListener('resize', positionPanel);
  }
  function close() {
    if (!panel) return;
    panel.remove(); panel = null;
    document.removeEventListener('click', outsideClick);
    window.removeEventListener('resize', positionPanel);
  }
  function outsideClick(e) { if (panel && !panel.contains(e.target) && e.target !== display) close(); }
  function positionPanel() {
    if (!panel) return;
    const r = display.getBoundingClientRect();
    panel.style.top = (window.scrollY + r.bottom + 6) + 'px';
    panel.style.left = (window.scrollX + r.left) + 'px';
  }

  function render() {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month+1, 0).getDate();
    const today = new Date();
    const todayISO = toISO(today);

    let cells = '';
    for (let i = 0; i < firstDay; i++) cells += '<div class="dp-cell empty"></div>';
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d);
      const iso = toISO(date);
      const isToday = iso === todayISO;
      const isSel = selected && toISO(selected) === iso;
      cells += `<button type="button" class="dp-cell${isToday ? ' today' : ''}${isSel ? ' selected' : ''}" data-iso="${iso}">${d}</button>`;
    }

    panel.innerHTML = `
      <div class="dp-header">
        <button type="button" class="dp-nav" data-act="prev">${icon('chevron-left', { size: 16 })}</button>
        <div class="dp-title">
          <select class="dp-month">${THAI_MONTHS.map((m,i) => `<option value="${i}"${i===month?' selected':''}>${m}</option>`).join('')}</select>
          <select class="dp-year">${Array.from({length:11}, (_,i) => year - 5 + i).map(y => `<option value="${y}"${y===year?' selected':''}>${y + 543}</option>`).join('')}</select>
        </div>
        <button type="button" class="dp-nav" data-act="next">${icon('chevron-right', { size: 16 })}</button>
      </div>
      <div class="dp-days">${THAI_DAYS.map(d => `<div class="dp-day-label">${d}</div>`).join('')}</div>
      <div class="dp-grid">${cells}</div>
      <div class="dp-footer">
        <button type="button" class="btn btn-ghost btn-sm" data-act="today">วันนี้</button>
        <button type="button" class="btn btn-ghost btn-sm" data-act="clear">ล้าง</button>
      </div>`;

    panel.querySelector('[data-act="prev"]').onclick = () => { viewDate = new Date(year, month-1, 1); render(); };
    panel.querySelector('[data-act="next"]').onclick = () => { viewDate = new Date(year, month+1, 1); render(); };
    panel.querySelector('.dp-month').onchange = e => { viewDate = new Date(year, +e.target.value, 1); render(); };
    panel.querySelector('.dp-year').onchange = e => { viewDate = new Date(+e.target.value, month, 1); render(); };
    panel.querySelector('[data-act="today"]').onclick = () => { selected = new Date(); viewDate = new Date(); commit(); };
    panel.querySelector('[data-act="clear"]').onclick = () => { selected = null; commit(); };
    panel.querySelectorAll('.dp-cell[data-iso]').forEach(btn => {
      btn.onclick = () => { selected = parseISO(btn.dataset.iso); commit(); };
    });
  }

  function commit() {
    const iso = selected ? toISO(selected) : '';
    input.value = iso;
    display.querySelector('.dp-value').textContent = iso ? formatThaiDate(iso) : 'เลือกวันที่';
    display.classList.toggle('has-value', !!iso);
    input.dispatchEvent(new Event('change', { bubbles: true }));
    close();
  }

  // External setter — for forms that reset/set values programmatically
  input._setDate = (iso) => {
    selected = iso ? parseISO(iso) : null;
    if (selected) viewDate = new Date(selected);
    input.value = iso || '';
    display.querySelector('.dp-value').textContent = iso ? formatThaiDate(iso) : 'เลือกวันที่';
    display.classList.toggle('has-value', !!iso);
  };
}

// ===== Custom Time Picker =====
function initTimePicker(input) {
  if (input._tpInit) return;
  input._tpInit = true;

  const wrap = document.createElement('div');
  wrap.className = 'dp-wrap';

  const display = document.createElement('button');
  display.type = 'button';
  display.className = 'form-control dp-trigger';
  display.innerHTML = `<span class="dp-value">${input.value || 'เลือกเวลา'}</span>${icon('clock', { size: 16 })}`;

  input.type = 'hidden';
  input.parentNode.insertBefore(wrap, input);
  wrap.appendChild(display);
  wrap.appendChild(input);

  let panel = null;
  let h = 9, m = 0;
  if (input.value) { const [hv, mv] = input.value.split(':').map(Number); h = hv; m = mv; }

  display.addEventListener('click', e => {
    e.stopPropagation();
    if (panel) { close(); return; }
    open();
  });

  function open() {
    panel = document.createElement('div');
    panel.className = 'dp-panel tp-panel';
    render();
    document.body.appendChild(panel);
    positionPanel();
    setTimeout(() => document.addEventListener('click', outsideClick), 0);
    window.addEventListener('resize', positionPanel);
  }
  function close() {
    if (!panel) return;
    panel.remove(); panel = null;
    document.removeEventListener('click', outsideClick);
    window.removeEventListener('resize', positionPanel);
  }
  function outsideClick(e) { if (panel && !panel.contains(e.target) && e.target !== display) close(); }
  function positionPanel() {
    if (!panel) return;
    const r = display.getBoundingClientRect();
    panel.style.top = (window.scrollY + r.bottom + 6) + 'px';
    panel.style.left = (window.scrollX + r.left) + 'px';
  }

  function render() {
    panel.innerHTML = `
      <div class="tp-body">
        <div class="tp-col">
          <button type="button" class="tp-step" data-act="h-up">${icon('chevron-up', { size: 14 })}</button>
          <div class="tp-val">${pad2(h)}</div>
          <button type="button" class="tp-step" data-act="h-down">${icon('chevron-down', { size: 14 })}</button>
          <div class="tp-label">ชั่วโมง</div>
        </div>
        <div class="tp-colon">:</div>
        <div class="tp-col">
          <button type="button" class="tp-step" data-act="m-up">${icon('chevron-up', { size: 14 })}</button>
          <div class="tp-val">${pad2(m)}</div>
          <button type="button" class="tp-step" data-act="m-down">${icon('chevron-down', { size: 14 })}</button>
          <div class="tp-label">นาที</div>
        </div>
      </div>
      <div class="dp-footer">
        <button type="button" class="btn btn-ghost btn-sm" data-act="clear">ล้าง</button>
        <button type="button" class="btn btn-primary btn-sm" data-act="ok">ตกลง</button>
      </div>`;
    panel.querySelector('[data-act="h-up"]').onclick = () => { h = (h+1)%24; render(); };
    panel.querySelector('[data-act="h-down"]').onclick = () => { h = (h+23)%24; render(); };
    panel.querySelector('[data-act="m-up"]').onclick = () => { m = (m+5)%60; render(); };
    panel.querySelector('[data-act="m-down"]').onclick = () => { m = (m+55)%60; render(); };
    panel.querySelector('[data-act="ok"]').onclick = () => commit(pad2(h)+':'+pad2(m));
    panel.querySelector('[data-act="clear"]').onclick = () => commit('');
  }
  function commit(v) {
    input.value = v;
    display.querySelector('.dp-value').textContent = v || 'เลือกเวลา';
    display.classList.toggle('has-value', !!v);
    input.dispatchEvent(new Event('change', { bubbles: true }));
    close();
  }

  input._setTime = (v) => {
    input.value = v || '';
    if (v) { const [hv, mv] = v.split(':').map(Number); h = hv; m = mv; }
    display.querySelector('.dp-value').textContent = v || 'เลือกเวลา';
    display.classList.toggle('has-value', !!v);
  };
}

// Auto-init all date/time inputs in DOM
function initAllPickers(root = document) {
  root.querySelectorAll('input[type="date"]').forEach(initDatePicker);
  root.querySelectorAll('input[type="time"]').forEach(initTimePicker);
}
