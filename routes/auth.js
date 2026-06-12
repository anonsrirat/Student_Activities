const express = require('express');
const jwt = require('jsonwebtoken');
const querystring = require('querystring');
const db = require('../db/database');
const router = express.Router();

const TSU_DOMAIN = process.env.TSU_DOMAIN || 'tsu.ac.th';
const JWT_SECRET = process.env.JWT_SECRET || 'dev-jwt-secret';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const CALLBACK_URL = process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/api/auth/google/callback';

function makeJWT(user) {
  return jwt.sign(
    { id: user.id, email: user.email, name: user.name, role: user.role, avatar_url: user.avatar_url },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// GET /api/auth/google — redirect to Google consent screen
router.get('/google', (req, res) => {
  if (!GOOGLE_CLIENT_ID) {
    return res.redirect('/login?error=no_config');
  }
  const params = querystring.stringify({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: CALLBACK_URL,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    prompt: 'select_account',
    hd: TSU_DOMAIN
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});

// GET /api/auth/google/callback
router.get('/google/callback', async (req, res) => {
  const { code, error } = req.query;
  if (error || !code) return res.redirect('/login?error=cancelled');

  try {
    // Exchange code for access token
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: querystring.stringify({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: CALLBACK_URL,
        grant_type: 'authorization_code'
      })
    });
    const tokens = await tokenRes.json();
    if (!tokens.access_token) return res.redirect('/login?error=token');

    // Get user profile
    const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` }
    });
    const profile = await profileRes.json();

    const email = profile.email || '';
    const domain = email.split('@')[1];
    if (domain !== TSU_DOMAIN) return res.redirect('/login?error=domain');

    // Upsert user
    let user = db.prepare('SELECT * FROM users WHERE google_id = ?').get(profile.id);
    if (user) {
      db.prepare('UPDATE users SET name = ?, avatar_url = ? WHERE google_id = ?')
        .run(profile.name, profile.picture, profile.id);
      user = db.prepare('SELECT * FROM users WHERE google_id = ?').get(profile.id);
    } else {
      db.prepare(
        'INSERT INTO users (google_id, email, name, avatar_url) VALUES (?, ?, ?, ?)'
      ).run(profile.id, email, profile.name, profile.picture);
      user = db.prepare('SELECT * FROM users WHERE id = ?').get(db.lastInsertRowid);
    }

    const token = makeJWT(user);
    res.cookie('token', token, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000, sameSite: 'lax' });
    res.redirect(user.role === 'staff' ? '/staff/dashboard' : '/dashboard');
  } catch (err) {
    console.error('OAuth error:', err);
    res.redirect('/login?error=server');
  }
});

// GET /api/auth/me
router.get('/me', (req, res) => {
  const token = req.cookies?.token;
  if (!token) return res.status(401).json({ error: 'ไม่ได้เข้าสู่ระบบ' });
  try {
    res.json(jwt.verify(token, JWT_SECRET));
  } catch {
    res.status(401).json({ error: 'Session หมดอายุ' });
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ success: true });
});

module.exports = router;
