// ===== API Helper =====
const api = {
  async get(url) {
    const r = await fetch(url, { credentials: 'include' });
    if (!r.ok) throw await r.json().catch(() => ({ error: r.statusText }));
    return r.json();
  },
  async post(url, body, isForm = false) {
    const opts = { method: 'POST', credentials: 'include' };
    if (isForm) { opts.body = body; }
    else { opts.headers = { 'Content-Type': 'application/json' }; opts.body = JSON.stringify(body); }
    const r = await fetch(url, opts);
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw data;
    return data;
  },
  async put(url, body) {
    const r = await fetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), credentials: 'include' });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw data;
    return data;
  },
  async del(url) {
    const r = await fetch(url, { method: 'DELETE', credentials: 'include' });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw data;
    return data;
  }
};

// ===== Toast =====
function toast(msg, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }
  const iconName = { success: 'check-circle', error: 'alert-circle', warning: 'alert-triangle', info: 'info' }[type] || 'info';
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `${icon(iconName, { size: 18 })}<span>${msg}</span>`;
  container.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transform = 'translateX(100%)'; el.style.transition = 'all .3s'; setTimeout(() => el.remove(), 300); }, 3500);
}

// ===== Format Helpers =====
function fmtDate(d) {
  if (!d) return '-';
  const date = new Date(d);
  if (typeof formatThaiDate === 'function') {
    return formatThaiDate(`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`);
  }
  return date.toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });
}
function fmtDateTime(d) {
  if (!d) return '-';
  const date = new Date(d);
  return date.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function timeAgo(d) {
  if (!d) return '';
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'เมื่อกี้';
  if (m < 60) return `${m} นาทีที่แล้ว`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ชั่วโมงที่แล้ว`;
  return fmtDate(d);
}

function formatHourNumber(value) {
  return Math.round(Number(value || 0)).toLocaleString('th-TH', { maximumFractionDigits: 0 });
}

function formatHours(value) {
  return `${formatHourNumber(value)} ชม.`;
}

function escapeHtml(v) {
  return String(v ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

const CATEGORY_THEMES = ['blue', 'green', 'amber', 'rose', 'violet', 'cyan'];

function categoryThemeKey(item) {
  const raw = typeof item === 'object' && item ? (item.category_id || item.id || item.category_name || item.name || '') : (item || '');
  const str = String(raw);
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  return CATEGORY_THEMES[Math.abs(hash) % CATEGORY_THEMES.length];
}

function categoryBadge(item) {
  const name = typeof item === 'object' && item ? (item.category_name || item.name) : item;
  if (!name) return '';
  const theme = categoryThemeKey(item);
  return `<span class="category-badge category-${theme}"><span class="category-dot"></span>${escapeHtml(name)}</span>`;
}

function activityDateLabel(activity) {
  const start = activity?.date ? String(activity.date).slice(0, 10) : '';
  const end = activity?.end_date ? String(activity.end_date).slice(0, 10) : '';
  if (!start) return '-';
  if (end && end !== start) return `${fmtDate(start)} - ${fmtDate(end)}`;
  return fmtDate(start);
}

function activityTimeLabel(activity) {
  const start = activity?.start_time ? String(activity.start_time).slice(0, 5) : '';
  const end = activity?.end_time ? String(activity.end_time).slice(0, 5) : '';
  if (start && end) return `${start} - ${end}`;
  return start || end || 'ไม่ระบุเวลา';
}

function activityScheduleLabel(activity) {
  return `${activityDateLabel(activity)} · ${activityTimeLabel(activity)}`;
}

function splitDateTime(value) {
  if (!value) return { date: '', time: '' };
  const s = String(value).replace('T', ' ');
  return { date: s.slice(0, 10), time: s.slice(11, 16) };
}

function buildDateTime(date, time) {
  if (!date) return '';
  return `${date} ${time || '00:00'}:00`;
}

function registrationWindowText(activity) {
  if (!activity?.registration_start_at && !activity?.registration_end_at) return 'เปิดรับตามสถานะกิจกรรม';
  const start = splitDateTime(activity.registration_start_at);
  const end = splitDateTime(activity.registration_end_at);
  if (start.date && end.date) return `เปิดรับ ${fmtDate(start.date)} ${start.time || '00:00'} - ${fmtDate(end.date)} ${end.time || '23:59'}`;
  if (start.date) return `เปิดรับตั้งแต่ ${fmtDate(start.date)} ${start.time || '00:00'}`;
  return `ปิดรับ ${fmtDate(end.date)} ${end.time || '23:59'}`;
}

function parseLocalDateTime(value) {
  if (!value) return null;
  const s = String(value).replace(' ', 'T');
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function registrationState(activity) {
  const status = activity?.status || activity?.activity_status;
  if (status !== 'open') return { ok: false, label: 'ปิดรับสมัคร' };
  if (Number(activity?.registration_not_started)) return { ok: false, label: 'ยังไม่เปิดรับสมัคร' };
  if (Number(activity?.registration_ended)) return { ok: false, label: 'หมดเวลารับสมัคร' };
  const now = new Date();
  const start = parseLocalDateTime(activity.registration_start_at);
  const end = parseLocalDateTime(activity.registration_end_at);
  if (start && now < start) return { ok: false, label: 'ยังไม่เปิดรับสมัคร' };
  if (end && now > end) return { ok: false, label: 'หมดเวลารับสมัคร' };
  return { ok: true, label: 'สมัครได้' };
}

function activityStatusBadge(activity) {
  const state = registrationState(activity);
  const status = activity?.status || activity?.activity_status;
  if (status === 'open' && !state.ok) {
    const cls = Number(activity?.registration_not_started) || state.label === 'ยังไม่เปิดรับสมัคร' ? 'badge-pending' : 'badge-closed';
    return `<span class="badge ${cls}">${state.label}</span>`;
  }
  return badgeStatus(status);
}

function badgeStatus(status) {
  const map = {
    open: ['badge-open', 'เปิดรับสมัคร'], closed: ['badge-closed', 'ปิดรับสมัคร'],
    cancelled: ['badge-cancelled', 'ยกเลิก'], pending: ['badge-pending', 'รอตรวจสอบ'],
    approved: ['badge-approved', 'อนุมัติแล้ว'], rejected: ['badge-rejected', 'ปฏิเสธ'],
    registered: ['badge-registered', 'ลงทะเบียนแล้ว'], attended: ['badge-attended', 'เข้าร่วมแล้ว'],
    absent: ['badge-absent', 'ขาด'], student: ['badge-student', 'นิสิต'], staff: ['badge-staff', 'เจ้าหน้าที่']
  };
  const [cls, label] = map[status] || ['badge-pending', status];
  return `<span class="badge ${cls}">${label}</span>`;
}

// ===== Sidebar Nav Config =====
const studentNav = [
  { href: '/dashboard', icon: 'dashboard', label: 'แดชบอร์ด' },
  { href: '/activities', icon: 'calendar', label: 'กิจกรรมทั้งหมด' },
  { href: '/calendar', icon: 'calendar-check', label: 'ปฏิทินกิจกรรม' },
  { href: '/my-activities', icon: 'check-square', label: 'กิจกรรมของฉัน' },
  { href: '/criteria', icon: 'chart-bar', label: 'เกณฑ์กิจกรรม' },
];
const staffNav = [
  { href: '/staff/dashboard', icon: 'dashboard', label: 'แดชบอร์ด' },
  { href: '/staff/activities', icon: 'calendar', label: 'จัดการกิจกรรม' },
  { href: '/calendar', icon: 'calendar-check', label: 'ปฏิทินกิจกรรม' },
  { href: '/staff/evidence', icon: 'folder', label: 'ตรวจหลักฐาน' },
  { href: '/staff/reports', icon: 'chart', label: 'รายงาน' },
  { href: '/staff/criteria', icon: 'clipboard', label: 'จัดการเกณฑ์' },
  { href: '/staff/users', icon: 'users', label: 'จัดการผู้ใช้' },
];

// ===== User Cache (sessionStorage, 5 min TTL) =====
const USER_CACHE_KEY = '__sa_user';
const USER_CACHE_TTL = 5 * 60 * 1000;

function getCachedUser() {
  try {
    const raw = sessionStorage.getItem(USER_CACHE_KEY);
    if (!raw) return null;
    const { user, ts } = JSON.parse(raw);
    if (Date.now() - ts > USER_CACHE_TTL) return null;
    return user;
  } catch { return null; }
}
function setCachedUser(user) {
  try { sessionStorage.setItem(USER_CACHE_KEY, JSON.stringify({ user, ts: Date.now() })); } catch {}
}
function clearCachedUser() {
  try { sessionStorage.removeItem(USER_CACHE_KEY); } catch {}
}

// ===== Layout Init (optimized) =====
async function initLayout(opts = {}) {
  const { requireRole = null } = opts;

  // Render sidebar IMMEDIATELY from cache if available — non-blocking
  const cached = getCachedUser();
  let user = cached;

  if (cached) {
    renderSidebar(cached);
    setupNotificationBox(cached);
    // Refresh in background, don't block
    api.get('/api/auth/me').then(fresh => {
      setCachedUser(fresh);
      if (JSON.stringify(fresh) !== JSON.stringify(cached)) renderSidebar(fresh);
      setupNotificationBox(fresh);
    }).catch(() => {
      clearCachedUser();
      window.location.href = '/login';
    });
  } else {
    try {
      user = await api.get('/api/auth/me');
      setCachedUser(user);
    } catch {
      window.location.href = '/login';
      return null;
    }
    renderSidebar(user);
    setupNotificationBox(user);
  }

  if (requireRole && user.role !== requireRole) {
    window.location.href = user.role === 'staff' ? '/staff/dashboard' : '/dashboard';
    return null;
  }

  // Load notif count in background (non-blocking)
  loadNotifCount();

  return user;
}

function renderSidebar(user) {
  const nav = user.role === 'staff' ? staffNav : studentNav;
  const initials = user.name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'U';

  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;

  sidebar.innerHTML = `
    <div class="sidebar-logo">
      <div class="logo-mark">TSU</div>
      <div class="logo-text"><strong>ระบบกิจกรรมนิสิต</strong>มหาวิทยาลัยทักษิณ</div>
    </div>
    <nav class="sidebar-nav">
      ${nav.map(item => `
        <a href="${item.href}" class="nav-item${window.location.pathname === item.href ? ' active' : ''}" data-page="${item.href}">
          <span class="icon">${icon(item.icon, { size: 18 })}</span>${item.label}
        </a>
      `).join('')}
    </nav>
    <div class="sidebar-bottom">
      <div class="user-mini">
        ${user.avatar_url ? `<img src="${user.avatar_url}" alt="${user.name}" loading="lazy">` : `<div class="user-avatar-placeholder">${initials}</div>`}
        <div class="user-info">
          <div class="user-name">${user.name}</div>
          <div class="user-role">${user.role === 'staff' ? 'เจ้าหน้าที่' : 'นิสิต'}</div>
        </div>
        <button onclick="logout()" class="btn btn-danger btn-sm logout-btn" title="ออกจากระบบ">${icon('logout', { size: 16 })}<span>ออก</span></button>
      </div>
    </div>`;

  // Topbar notif button: replace any bell emoji with icon
  document.querySelectorAll('#notif-btn').forEach(btn => {
    if (!btn.querySelector('svg')) btn.innerHTML = icon('bell', { size: 18 });
  });
}

async function loadNotifCount() {
  try {
    const data = await api.get('/api/notifications/my');
    const btn = document.getElementById('notif-btn');
    if (btn && data.unread > 0) {
      let badge = btn.querySelector('.notif-badge');
      if (!badge) { badge = document.createElement('span'); badge.className = 'notif-badge'; btn.appendChild(badge); }
      badge.textContent = data.unread > 99 ? '99+' : data.unread;
    } else if (btn) {
      btn.querySelector('.notif-badge')?.remove();
    }
  } catch {}
}

let activeNotifBox = null;

function setupNotificationBox(user) {
  document.querySelectorAll('#notif-btn').forEach(btn => {
    if (!btn.querySelector('svg')) btn.innerHTML = icon('bell', { size: 18 });
    btn.setAttribute('aria-label', 'การแจ้งเตือน');
    if (user?.role !== 'student' || btn._notifInit) return;
    btn._notifInit = true;
    btn.setAttribute('href', '#');
    btn.setAttribute('role', 'button');
    btn.addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
      toggleNotificationBox(btn);
    });
  });
}

function closeNotificationBox() {
  if (!activeNotifBox) return;
  activeNotifBox.remove();
  activeNotifBox = null;
  document.removeEventListener('pointerdown', closeNotificationBox);
  window.removeEventListener('resize', closeNotificationBox);
}

async function toggleNotificationBox(btn) {
  if (activeNotifBox) { closeNotificationBox(); return; }

  const box = document.createElement('div');
  box.className = 'notif-popover';
  box.innerHTML = `<div class="notif-popover-head"><strong>การแจ้งเตือน</strong></div><div class="notif-popover-body"><div class="notif-loading">กำลังโหลด...</div></div>`;
  box.addEventListener('pointerdown', e => e.stopPropagation());
  box.addEventListener('click', e => e.stopPropagation());
  document.body.appendChild(box);
  activeNotifBox = box;

  const r = btn.getBoundingClientRect();
  box.style.top = `${window.scrollY + r.bottom + 8}px`;
  box.style.right = `${Math.max(12, window.innerWidth - window.scrollX - r.right)}px`;

  setTimeout(() => document.addEventListener('pointerdown', closeNotificationBox), 0);
  window.addEventListener('resize', closeNotificationBox);

  try {
    const data = await api.get('/api/notifications/my');
    const items = data.notifications || [];
    const body = box.querySelector('.notif-popover-body');
    const unread = Number(data.unread || 0);
    box.querySelector('.notif-popover-head').innerHTML = `
      <strong>การแจ้งเตือน</strong>
      ${unread ? `<button class="btn btn-ghost btn-sm" data-act="read-all">อ่านทั้งหมด</button>` : ''}`;

    if (!items.length) {
      body.innerHTML = `<div class="notif-empty">${icon('bell', { size: 32 })}<p>ยังไม่มีการแจ้งเตือน</p></div>`;
    } else {
      body.innerHTML = items.slice(0, 8).map(n => `
        <button class="notif-message${n.is_read ? ' read' : ''}" data-id="${n.id}">
          <span class="notif-dot${n.is_read ? ' read' : ''}"></span>
          <span class="notif-content">
            <span class="notif-title">${escapeHtml(n.title)}</span>
            <span class="notif-msg">${escapeHtml(n.message || '')}</span>
            <span class="notif-time">${timeAgo(n.created_at)}</span>
          </span>
        </button>`).join('');
    }

    box.querySelector('[data-act="read-all"]')?.addEventListener('click', async () => {
      await api.put('/api/notifications/read-all', {});
      closeNotificationBox();
      await loadNotifCount();
      toast('อ่านการแจ้งเตือนทั้งหมดแล้ว', 'success');
    });
    box.querySelectorAll('.notif-message').forEach(item => {
      item.addEventListener('click', async () => {
        if (!item.classList.contains('read')) {
          await api.put(`/api/notifications/${item.dataset.id}/read`, {});
          item.classList.add('read');
          item.querySelector('.notif-dot')?.classList.add('read');
          await loadNotifCount();
        }
      });
    });
  } catch {
    box.querySelector('.notif-popover-body').innerHTML = '<div class="notif-empty"><p>โหลดการแจ้งเตือนไม่สำเร็จ</p></div>';
  }
}

async function logout() {
  if (!await confirmDialog('ต้องการออกจากระบบหรือไม่?', {
    title: 'ยืนยันการออกจากระบบ',
    confirmText: 'ออกจากระบบ',
    tone: 'danger'
  })) return;
  clearCachedUser();
  try { await api.post('/api/auth/logout', {}); } catch {}
  window.location.href = '/login';
}

// ===== Modal =====
function openModal(id) { document.getElementById(id)?.classList.add('open'); }
function closeModal(id) { document.getElementById(id)?.classList.remove('open'); }
document.addEventListener('click', e => {
  const closeBtn = e.target.closest?.('.modal-close');
  if (closeBtn) { closeBtn.closest('.modal-overlay')?.classList.remove('open'); return; }
  if (e.target.classList.contains('modal-overlay')) e.target.classList.remove('open');
});
// Auto-render X icon inside any empty .modal-close
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.modal-close').forEach(b => { if (!b.innerHTML.trim()) b.innerHTML = icon('x', { size: 18 }); });
});

// ===== Confirm Dialog =====
function confirmDialog(msg, opts = {}) {
  const {
    title = 'ยืนยันการทำรายการ',
    confirmText = 'ยืนยัน',
    cancelText = 'ยกเลิก',
    tone = 'primary'
  } = opts;

  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay confirm-overlay open';
    overlay.innerHTML = `
      <div class="modal confirm-modal" role="dialog" aria-modal="true">
        <div class="confirm-icon ${tone}">${icon(tone === 'danger' ? 'alert-triangle' : 'info', { size: 26 })}</div>
        <h2>${escapeHtml(title)}</h2>
        <p>${escapeHtml(msg)}</p>
        <div class="confirm-actions">
          <button type="button" class="btn btn-outline" data-act="cancel">${escapeHtml(cancelText)}</button>
          <button type="button" class="btn ${tone === 'danger' ? 'btn-danger' : 'btn-primary'}" data-act="confirm">${escapeHtml(confirmText)}</button>
        </div>
      </div>`;

    const close = (value) => {
      overlay.remove();
      document.removeEventListener('keydown', onKey);
      resolve(value);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') close(false);
      if (e.key === 'Enter') close(true);
    };
    overlay.addEventListener('click', e => { if (e.target === overlay) close(false); });
    overlay.querySelector('[data-act="cancel"]').onclick = () => close(false);
    overlay.querySelector('[data-act="confirm"]').onclick = () => close(true);
    document.addEventListener('keydown', onKey);
    document.body.appendChild(overlay);
    overlay.querySelector('[data-act="confirm"]').focus();
  });
}

// ===== Pagination =====
function renderPagination(container, current, total, onChange) {
  container.innerHTML = '';
  if (total <= 1) return;
  const makeBtn = (label, page, disabled, active) => {
    const btn = document.createElement('button');
    btn.className = `page-btn${active ? ' active' : ''}`;
    btn.innerHTML = label;
    btn.disabled = disabled;
    btn.onclick = () => onChange(page);
    return btn;
  };
  container.appendChild(makeBtn(icon('chevron-left', { size: 14 }), current - 1, current === 1, false));
  for (let i = 1; i <= total; i++) {
    if (total > 7 && Math.abs(i - current) > 2 && i !== 1 && i !== total) {
      if (i === current - 3 || i === current + 3) { const d = document.createElement('span'); d.textContent = '…'; d.style.padding = '0 4px'; container.appendChild(d); }
      continue;
    }
    container.appendChild(makeBtn(i, i, false, i === current));
  }
  container.appendChild(makeBtn(icon('chevron-right', { size: 14 }), current + 1, current === total, false));
}

// ===== File Drop Zone =====
function initFileDrop(dropEl, inputEl, previewEl) {
  dropEl.addEventListener('click', () => inputEl.click());
  dropEl.addEventListener('dragover', e => { e.preventDefault(); dropEl.classList.add('dragover'); });
  dropEl.addEventListener('dragleave', () => dropEl.classList.remove('dragover'));
  dropEl.addEventListener('drop', e => { e.preventDefault(); dropEl.classList.remove('dragover'); if (e.dataTransfer.files[0]) showPreview(e.dataTransfer.files[0]); });
  inputEl.addEventListener('change', () => { if (inputEl.files[0]) showPreview(inputEl.files[0]); });

  function showPreview(file) {
    const dt = new DataTransfer();
    dt.items.add(file);
    inputEl.files = dt.files;
    previewEl.innerHTML = `
      <div class="file-preview">
        ${icon('file', { size: 18 })}
        <span class="truncate">${file.name}</span>
        <span style="color:var(--text-muted);font-size:.75rem">${(file.size/1024/1024).toFixed(1)} MB</span>
        <span class="remove-file" onclick="clearFile()">${icon('x', { size: 16 })}</span>
      </div>`;
  }

  window.clearFile = () => {
    inputEl.value = '';
    previewEl.innerHTML = '';
  };
}

// ===== Search debounce =====
function debounce(fn, ms = 350) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

// ===== Prefetch nav links on hover =====
document.addEventListener('mouseover', e => {
  const a = e.target.closest('a[href^="/"]:not([href*="#"]):not([data-no-prefetch])');
  if (!a || a._prefetched) return;
  const href = a.getAttribute('href');
  if (href.includes('/api/') || href.includes('/uploads/')) return;
  a._prefetched = true;
  const link = document.createElement('link');
  link.rel = 'prefetch';
  link.href = href;
  document.head.appendChild(link);
}, { passive: true });
