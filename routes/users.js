const express = require('express');
const { pool } = require('../db/database');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');
const router = express.Router();

router.get('/', requireAuth, requireRole('staff'), async (req, res) => {
  try {
    const { search = '', role = '', page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    let where = '1=1';
    const params = [];
    if (search) {
      where += ' AND (name LIKE ? OR email LIKE ? OR student_id LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (role) { where += ' AND role = ?'; params.push(role); }

    const [rows] = await pool.query(`
      SELECT id, name, email, student_id, role, avatar_url, created_at
      FROM users WHERE ${where}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?`, [...params, parseInt(limit), offset]);

    const [[totalRow]] = await pool.query(`SELECT COUNT(*) as c FROM users WHERE ${where}`, params);
    res.json({ users: rows, total: totalRow.c, page: parseInt(page), pages: Math.ceil(totalRow.c / parseInt(limit)) });
  } catch (e) { console.error(e); res.status(500).json({ error: 'เกิดข้อผิดพลาด' }); }
});

router.put('/:id/role', requireAuth, requireRole('staff'), async (req, res) => {
  try {
    const { role } = req.body;
    if (!['student', 'staff'].includes(role)) return res.status(400).json({ error: 'role ต้องเป็น student หรือ staff' });
    const [result] = await pool.query('UPDATE users SET role = ? WHERE id = ?', [role, req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ error: 'ไม่พบผู้ใช้' });
    res.json({ success: true });
  } catch (e) { console.error(e); res.status(500).json({ error: 'เกิดข้อผิดพลาด' }); }
});

router.put('/me/student-id', requireAuth, async (req, res) => {
  try {
    const { student_id } = req.body;
    if (!student_id) return res.status(400).json({ error: 'กรุณากรอกรหัสนิสิต' });
    await pool.query('UPDATE users SET student_id = ? WHERE id = ?', [student_id, req.user.id]);
    res.json({ success: true });
  } catch (e) { console.error(e); res.status(500).json({ error: 'เกิดข้อผิดพลาด' }); }
});

module.exports = router;
