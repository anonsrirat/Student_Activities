require('dotenv').config();
const express = require('express');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const path = require('path');
const jwt = require('jsonwebtoken');
const { init } = require('./db/database');

const app = express();

// Trust reverse proxy (Coolify / Traefik) so secure cookies work over HTTPS
app.set('trust proxy', 1);

// Gzip compression — major speedup for HTML/CSS/JS
app.use(compression());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), { maxAge: '7d' }));

// API routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/activities', require('./routes/activities'));
app.use('/api/evidence', require('./routes/evidence'));
app.use('/api/criteria', require('./routes/criteria'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/stats', require('./routes/stats'));
app.use('/api/users', require('./routes/users'));

// Page routes — verify auth before serving HTML
function getUser(req) {
  try {
    const token = req.cookies?.token;
    if (!token) return null;
    return jwt.verify(token, process.env.JWT_SECRET || 'dev-jwt-secret');
  } catch {
    return null;
  }
}

// Root redirect
app.get('/', (req, res) => {
  const user = getUser(req);
  if (!user) return res.redirect('/login');
  res.redirect(user.role === 'staff' ? '/staff/dashboard' : '/dashboard');
});

// Student pages (require auth)
const studentPages = ['dashboard', 'activities', 'activity-detail', 'my-activities', 'submit-evidence', 'criteria', 'notifications', 'calendar'];
studentPages.forEach(page => {
  app.get(`/${page}`, (req, res) => {
    const user = getUser(req);
    if (!user) return res.redirect('/login');
    res.sendFile(path.join(__dirname, 'public', `${page}.html`));
  });
});

// Staff pages (require auth + staff role)
const staffPages = ['dashboard', 'activities', 'evidence', 'reports', 'criteria', 'users'];
staffPages.forEach(page => {
  app.get(`/staff/${page}`, (req, res) => {
    const user = getUser(req);
    if (!user) return res.redirect('/login');
    if (user.role !== 'staff') return res.redirect('/dashboard');
    res.sendFile(path.join(__dirname, 'public', 'staff', `${page}.html`));
  });
});

// Login page — redirect if already authed
app.get('/login', (req, res) => {
  const user = getUser(req);
  if (user) return res.redirect(user.role === 'staff' ? '/staff/dashboard' : '/dashboard');
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Static files: revalidate so HTML and shared JS/CSS do not drift after deploys
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: 0,
  etag: true,
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'no-cache');
  }
}));

// 404
app.use((req, res) => {
  res.status(404).json({ error: 'ไม่พบหน้าที่ต้องการ' });
});

const PORT = process.env.PORT || 3000;

(async () => {
  try {
    await init();
    app.listen(PORT, () => {
      console.log(`\n[OK] ระบบจัดการกิจกรรมนิสิต TSU`);
      console.log(`     Server: http://localhost:${PORT}`);
      console.log(`     Login:  http://localhost:${PORT}/login\n`);
    });
  } catch (err) {
    console.error('[FAIL] Database initialization failed:', err.message);
    process.exit(1);
  }
})();
