const express = require('express');
const db = require('../db/database');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');
const jwt = require('jsonwebtoken');
const router = express.Router();

// GET /api/users — list all users (staff)
router.get('/', requireAuth, requireRole('staff'), (req, res) => {
  const { search = '', role = '', page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  let where = '1=1';
  const params = [];
  if (search) { where += ' AND (name LIKE ? OR email LIKE ? OR student_id LIKE ?)'; params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
  if (role) { where += ' AND role = ?'; params.push(role); }

  const rows = db.prepare(`
    SELECT id, name, email, student_id, role, avatar_url, created_at
    FROM users WHERE ${where}
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, parseInt(limit), offset);

  const total = db.prepare(`SELECT COUNT(*) as c FROM users WHERE ${where}`).get(...params).c;
  res.json({ users: rows, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
});

// PUT /api/users/:id/role — change role (staff)
router.put('/:id/role', requireAuth, requireRole('staff'), (req, res) => {
  const { role } = req.body;
  if (!['student', 'staff'].includes(role)) return res.status(400).json({ error: 'role ต้องเป็น student หรือ staff' });
  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'ไม่พบผู้ใช้' });
  db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, req.params.id);
  res.json({ success: true });
});

// PUT /api/users/me/student-id — student update their own student_id
router.put('/me/student-id', requireAuth, (req, res) => {
  const { student_id } = req.body;
  if (!student_id) return res.status(400).json({ error: 'กรุณากรอกรหัสนิสิต' });
  db.prepare('UPDATE users SET student_id = ? WHERE id = ?').run(student_id, req.user.id);
  res.json({ success: true });
});

module.exports = router;
