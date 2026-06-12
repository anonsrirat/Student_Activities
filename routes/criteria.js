const express = require('express');
const db = require('../db/database');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');
const router = express.Router();

// GET /api/criteria — all categories with student progress (if student)
router.get('/', requireAuth, (req, res) => {
  const categories = db.prepare('SELECT * FROM activity_categories ORDER BY name').all();

  if (req.user.role === 'student') {
    // Calculate earned hours per category for this student
    const earned = db.prepare(`
      SELECT a.category_id,
        SUM(CASE WHEN ar.status='attended' THEN a.hours_credit ELSE 0 END) as earned_hours,
        COUNT(CASE WHEN ar.status='attended' THEN 1 END) as activities_count
      FROM activity_registrations ar
      JOIN activities a ON ar.activity_id = a.id
      WHERE ar.user_id = ?
      GROUP BY a.category_id
    `).all(req.user.id);

    const earnedMap = {};
    earned.forEach(e => { earnedMap[e.category_id] = e; });

    const result = categories.map(cat => ({
      ...cat,
      earned_hours: earnedMap[cat.id]?.earned_hours || 0,
      activities_count: earnedMap[cat.id]?.activities_count || 0,
      passed: (earnedMap[cat.id]?.earned_hours || 0) >= cat.min_hours
    }));
    return res.json(result);
  }

  res.json(categories);
});

// POST /api/criteria — create (staff)
router.post('/', requireAuth, requireRole('staff'), (req, res) => {
  const { name, description, min_hours } = req.body;
  if (!name) return res.status(400).json({ error: 'กรุณากรอกชื่อหมวดหมู่' });
  db.prepare('INSERT INTO activity_categories (name, description, min_hours) VALUES (?, ?, ?)').run(name, description || null, parseFloat(min_hours) || 0);
  res.status(201).json(db.prepare('SELECT * FROM activity_categories WHERE id = ?').get(db.lastInsertRowid));
});

// PUT /api/criteria/:id — update (staff)
router.put('/:id', requireAuth, requireRole('staff'), (req, res) => {
  const { name, description, min_hours } = req.body;
  const existing = db.prepare('SELECT id FROM activity_categories WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'ไม่พบหมวดหมู่' });
  db.prepare('UPDATE activity_categories SET name=?, description=?, min_hours=? WHERE id=?').run(name, description || null, parseFloat(min_hours) || 0, req.params.id);
  res.json(db.prepare('SELECT * FROM activity_categories WHERE id = ?').get(req.params.id));
});

// DELETE /api/criteria/:id — delete (staff)
router.delete('/:id', requireAuth, requireRole('staff'), (req, res) => {
  const existing = db.prepare('SELECT id FROM activity_categories WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'ไม่พบหมวดหมู่' });
  db.prepare('DELETE FROM activity_categories WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
