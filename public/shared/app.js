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
  const icons = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span>${icons[type] || 'ℹ'}</span><span>${msg}</span>`;
  container.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transform = 'translateX(100%)'; el.style.transition = 'all .3s'; setTimeout(() => el.remove(), 300); }, 3500);
}

// ===== Format Helpers =====
function fmtDate(d) {
  if (!d) return '-';
  const date = new Date(d);
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
  { href: '/dashboard', icon: '⊞', label: 'แดชบอร์ด' },
  { href: '/activities', icon: '📅', label: 'กิจกรรมทั้งหมด' },
  { href: '/my-activities', icon: '✓', label: 'กิจกรรมของฉัน' },
  { href: '/criteria', icon: '📊', label: 'เกณฑ์กิจกรรม' },
  { href: '/notifications', icon: '🔔', label: 'การแจ้งเตือน' },
];
const staffNav = [
  { href: '/staff/dashboard', icon: '⊞', label: 'แดชบอร์ด' },
  { href: '/staff/activities', icon: '📅', label: 'จัดการกิจกรรม' },
  { href: '/staff/evidence', icon: '📁', label: 'ตรวจหลักฐาน' },
  { href: '/staff/reports', icon: '📈', label: 'รายงาน' },
  { href: '/staff/criteria', icon: '📋', label: 'จัดการเกณฑ์' },
  { href: '/staff/users', icon: '👥', label: 'จัดการผู้ใช้' },
];

// ===== Layout Init =====
async function initLayout(opts = {}) {
  const { activePage = '', requireRole = null } = opts;

  let user;
  try {
    user = await api.get('/api/auth/me');
  } catch {
    window.location.href = '/login';
    return null;
  }

  if (requireRole && user.role !== requireRole) {
    window.location.href = user.role === 'staff' ? '/staff/dashboard' : '/dashboard';
    return null;
  }

  // Build sidebar
  const nav = user.role === 'staff' ? staffNav : studentNav;
  const initials = user.name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'U';

  const sidebar = document.getElementById('sidebar');
  if (sidebar) {
    sidebar.innerHTML = `
      <div class="sidebar-logo">
        <div class="logo-mark">TSU</div>
        <div class="logo-text"><strong>ระบบกิจกรรมนิสิต</strong>มหาวิทยาลัยทักษิณ</div>
      </div>
      <nav class="sidebar-nav">
        ${nav.map(item => `
          <a href="${item.href}" class="nav-item${window.location.pathname === item.href ? ' active' : ''}" data-page="${item.href}">
            <span class="icon">${item.icon}</span>${item.label}
          </a>
        `).join('')}
      </nav>
      <div class="sidebar-bottom">
        <div class="user-mini">
          ${user.avatar_url ? `<img src="${user.avatar_url}" alt="${user.name}">` : `<div class="user-avatar-placeholder">${initials}</div>`}
          <div class="user-info">
            <div class="user-name">${user.name}</div>
            <div class="user-role">${user.role === 'staff' ? 'เจ้าหน้าที่' : 'นิสิต'}</div>
          </div>
          <button onclick="logout()" class="btn btn-ghost btn-sm" title="ออกจากระบบ">⏻</button>
        </div>
      </div>
    `;
  }

  // Load notifications count
  loadNotifCount(user.role);

  return user;
}

async function loadNotifCount(role) {
  try {
    const data = await api.get('/api/notifications/my');
    const btn = document.getElementById('notif-btn');
    if (btn && data.unread > 0) {
      let badge = btn.querySelector('.notif-badge');
      if (!badge) { badge = document.createElement('span'); badge.className = 'notif-badge'; btn.appendChild(badge); }
      badge.textContent = data.unread > 99 ? '99+' : data.unread;
    }
  } catch {}
}

async function logout() {
  try { await api.post('/api/auth/logout', {}); } catch {}
  window.location.href = '/login';
}

// ===== Modal =====
function openModal(id) { document.getElementById(id)?.classList.add('open'); }
function closeModal(id) { document.getElementById(id)?.classList.remove('open'); }
document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-overlay')) e.target.classList.remove('open');
  if (e.target.classList.contains('modal-close')) e.target.closest('.modal-overlay')?.classList.remove('open');
});

// ===== Confirm Dialog =====
function confirmDialog(msg) {
  return new Promise(resolve => {
    if (window.confirm(msg)) resolve(true);
    else resolve(false);
  });
}

// ===== Pagination =====
function renderPagination(container, current, total, onChange) {
  container.innerHTML = '';
  if (total <= 1) return;
  const makeBtn = (label, page, disabled, active) => {
    const btn = document.createElement('button');
    btn.className = `page-btn${active ? ' active' : ''}`;
    btn.textContent = label;
    btn.disabled = disabled;
    btn.onclick = () => onChange(page);
    return btn;
  };
  container.appendChild(makeBtn('‹', current - 1, current === 1, false));
  for (let i = 1; i <= total; i++) {
    if (total > 7 && Math.abs(i - current) > 2 && i !== 1 && i !== total) {
      if (i === current - 3 || i === current + 3) { const d = document.createElement('span'); d.textContent = '…'; d.style.padding = '0 4px'; container.appendChild(d); }
      continue;
    }
    container.appendChild(makeBtn(i, i, false, i === current));
  }
  container.appendChild(makeBtn('›', current + 1, current === total, false));
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
        <span>📄</span>
        <span class="truncate">${file.name}</span>
        <span style="color:var(--text-muted);font-size:.75rem">${(file.size/1024/1024).toFixed(1)} MB</span>
        <span class="remove-file" onclick="clearFile()">✕</span>
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
