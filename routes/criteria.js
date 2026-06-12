const express = require('express');
const { pool } = require('../db/database');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');
const router = express.Router();

router.get('/', requireAuth, async (req, res) => {
  try {
    const [categories] = await pool.query('SELECT * FROM activity_categories ORDER BY name');

    if (req.user.role === 'student') {
      const [earned] = await pool.query(`
        SELECT a.category_id,
          SUM(CASE WHEN ar.status='attended' THEN a.hours_credit ELSE 0 END) as earned_hours,
          COUNT(CASE WHEN ar.status='attended' THEN 1 END) as activities_count
        FROM activity_registrations ar
        JOIN activities a ON ar.activity_id = a.id
        WHERE ar.user_id = ?
        GROUP BY a.category_id`, [req.user.id]);

      const earnedMap = {};
      earned.forEach(e => { earnedMap[e.category_id] = e; });

      const result = categories.map(cat => ({
        ...cat,
        min_hours: Number(cat.min_hours),
        earned_hours: Number(earnedMap[cat.id]?.earned_hours || 0),
        activities_count: Number(earnedMap[cat.id]?.activities_count || 0),
        passed: Number(earnedMap[cat.id]?.earned_hours || 0) >= Number(cat.min_hours)
      }));
      return res.json(result);
    }

    res.json(categories.map(c => ({ ...c, min_hours: Number(c.min_hours) })));
  } catch (e) { console.error(e); res.status(500).json({ error: 'เกิดข้อผิดพลาด' }); }
});

router.post('/', requireAuth, requireRole('staff'), async (req, res) => {
  try {
    const { name, description, min_hours } = req.body;
    if (!name) return res.status(400).json({ error: 'กรุณากรอกชื่อหมวดหมู่' });
    const [result] = await pool.query('INSERT INTO activity_categories (name, description, min_hours) VALUES (?, ?, ?)',
      [name, description || null, parseFloat(min_hours) || 0]);
    const [rows] = await pool.query('SELECT * FROM activity_categories WHERE id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (e) { console.error(e); res.status(500).json({ error: 'เกิดข้อผิดพลาด' }); }
});

router.put('/:id', requireAuth, requireRole('staff'), async (req, res) => {
  try {
    const { name, description, min_hours } = req.body;
    const [existing] = await pool.query('SELECT id FROM activity_categories WHERE id = ?', [req.params.id]);
    if (!existing.length) return res.status(404).json({ error: 'ไม่พบหมวดหมู่' });
    await pool.query('UPDATE activity_categories SET name=?, description=?, min_hours=? WHERE id=?',
      [name, description || null, parseFloat(min_hours) || 0, req.params.id]);
    const [rows] = await pool.query('SELECT * FROM activity_categories WHERE id = ?', [req.params.id]);
    res.json(rows[0]);
  } catch (e) { console.error(e); res.status(500).json({ error: 'เกิดข้อผิดพลาด' }); }
});

router.delete('/:id', requireAuth, requireRole('staff'), async (req, res) => {
  try {
    const [result] = await pool.query('DELETE FROM activity_categories WHERE id = ?', [req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ error: 'ไม่พบหมวดหมู่' });
    res.json({ success: true });
  } catch (e) { console.error(e); res.status(500).json({ error: 'เกิดข้อผิดพลาด' }); }
});

module.exports = router;
