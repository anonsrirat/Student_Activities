const express = require('express');
const db = require('../db/database');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');
const router = express.Router();

// GET /api/activities — list with search, filter, pagination
router.get('/', requireAuth, (req, res) => {
  const { search = '', category = '', status = '', date = '', page = 1, limit = 10 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  let where = ['1=1'];
  const params = [];

  if (search) {
    where.push('(a.title LIKE ? OR a.description LIKE ? OR a.location LIKE ?)');
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (category) { where.push('a.category_id = ?'); params.push(category); }
  if (status) { where.push('a.status = ?'); params.push(status); }
  if (date) { where.push('a.date = ?'); params.push(date); }

  const whereStr = where.join(' AND ');

  const rows = db.prepare(`
    SELECT a.*, c.name as category_name,
      (SELECT COUNT(*) FROM activity_registrations WHERE activity_id = a.id) as registered_count,
      (SELECT COUNT(*) FROM activity_registrations WHERE activity_id = a.id AND user_id = ?) as is_registered
    FROM activities a
    LEFT JOIN activity_categories c ON a.category_id = c.id
    WHERE ${whereStr}
    ORDER BY a.date DESC, a.start_time ASC
    LIMIT ? OFFSET ?
  `).all(req.user.id, ...params, parseInt(limit), offset);

  const total = db.prepare(`
    SELECT COUNT(*) as count FROM activities a WHERE ${whereStr}
  `).get(...params).count;

  res.json({ activities: rows, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
});

// GET /api/activities/:id — detail
router.get('/:id', requireAuth, (req, res) => {
  const activity = db.prepare(`
    SELECT a.*, c.name as category_name,
      u.name as creator_name,
      (SELECT COUNT(*) FROM activity_registrations WHERE activity_id = a.id) as registered_count,
      (SELECT COUNT(*) FROM activity_registrations WHERE activity_id = a.id AND user_id = ?) as is_registered
    FROM activities a
    LEFT JOIN activity_categories c ON a.category_id = c.id
    LEFT JOIN users u ON a.created_by = u.id
    WHERE a.id = ?
  `).get(req.user.id, req.params.id);

  if (!activity) return res.status(404).json({ error: 'ไม่พบกิจกรรม' });
  res.json(activity);
});

// POST /api/activities — create (staff)
router.post('/', requireAuth, requireRole('staff'), (req, res) => {
  const { title, description, category_id, date, start_time, end_time, location, capacity, hours_credit, status } = req.body;
  if (!title || !date) return res.status(400).json({ error: 'กรุณากรอกชื่อและวันที่กิจกรรม' });

  db.prepare(`
    INSERT INTO activities (title, description, category_id, date, start_time, end_time, location, capacity, hours_credit, status, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(title, description || null, category_id || null, date, start_time || null, end_time || null,
    location || null, parseInt(capacity) || 0, parseFloat(hours_credit) || 0, status || 'open', req.user.id);

  const activity = db.prepare('SELECT * FROM activities WHERE id = ?').get(db.lastInsertRowid);
  res.status(201).json(activity);
});

// PUT /api/activities/:id — update (staff)
router.put('/:id', requireAuth, requireRole('staff'), (req, res) => {
  const { title, description, category_id, date, start_time, end_time, location, capacity, hours_credit, status } = req.body;
  const existing = db.prepare('SELECT id FROM activities WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'ไม่พบกิจกรรม' });

  db.prepare(`
    UPDATE activities SET title=?, description=?, category_id=?, date=?, start_time=?, end_time=?,
      location=?, capacity=?, hours_credit=?, status=?, updated_at=CURRENT_TIMESTAMP
    WHERE id=?
  `).run(title, description || null, category_id || null, date, start_time || null, end_time || null,
    location || null, parseInt(capacity) || 0, parseFloat(hours_credit) || 0, status || 'open', req.params.id);

  res.json(db.prepare('SELECT * FROM activities WHERE id = ?').get(req.params.id));
});

// DELETE /api/activities/:id — delete (staff)
router.delete('/:id', requireAuth, requireRole('staff'), (req, res) => {
  const existing = db.prepare('SELECT id FROM activities WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'ไม่พบกิจกรรม' });
  db.prepare('DELETE FROM activities WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// POST /api/activities/:id/register — student register
router.post('/:id/register', requireAuth, requireRole('student'), (req, res) => {
  const activity = db.prepare('SELECT * FROM activities WHERE id = ?').get(req.params.id);
  if (!activity) return res.status(404).json({ error: 'ไม่พบกิจกรรม' });
  if (activity.status !== 'open') return res.status(400).json({ error: 'กิจกรรมปิดรับสมัครแล้ว' });

  const regCount = db.prepare('SELECT COUNT(*) as c FROM activity_registrations WHERE activity_id = ?').get(req.params.id).c;
  if (activity.capacity > 0 && regCount >= activity.capacity) {
    return res.status(400).json({ error: 'กิจกรรมเต็มแล้ว' });
  }

  try {
    db.prepare('INSERT INTO activity_registrations (activity_id, user_id) VALUES (?, ?)').run(req.params.id, req.user.id);
    res.json({ success: true, message: 'ลงทะเบียนสำเร็จ' });
  } catch {
    res.status(400).json({ error: 'คุณลงทะเบียนกิจกรรมนี้แล้ว' });
  }
});

// DELETE /api/activities/:id/register — cancel registration
router.delete('/:id/register', requireAuth, requireRole('student'), (req, res) => {
  const result = db.prepare('DELETE FROM activity_registrations WHERE activity_id = ? AND user_id = ?')
    .run(req.params.id, req.user.id);
  if (!result.changes) return res.status(404).json({ error: 'ไม่พบการลงทะเบียน' });
  res.json({ success: true });
});

module.exports = router;
