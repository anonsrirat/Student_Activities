const express = require('express');
const { pool, activityColumns } = require('../db/database');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');
const router = express.Router();

function dateRangeExpr(alias = 'a') {
  return activityColumns.end_date ? `COALESCE(${alias}.end_date, ${alias}.date)` : `${alias}.date`;
}

function pushActivityFields(fields, values, body) {
  if (activityColumns.end_date) {
    fields.push('end_date');
    values.push(body.end_date || null);
  }
  if (activityColumns.registration_start_at) {
    fields.push('registration_start_at');
    values.push(body.registration_start_at || null);
  }
  if (activityColumns.registration_end_at) {
    fields.push('registration_end_at');
    values.push(body.registration_end_at || null);
  }
}

function pushActivityUpdates(sets, values, body) {
  if (activityColumns.end_date) {
    sets.push('end_date=?');
    values.push(body.end_date || null);
  }
  if (activityColumns.registration_start_at) {
    sets.push('registration_start_at=?');
    values.push(body.registration_start_at || null);
  }
  if (activityColumns.registration_end_at) {
    sets.push('registration_end_at=?');
    values.push(body.registration_end_at || null);
  }
}

router.get('/', requireAuth, async (req, res) => {
  try {
    const { search = '', category = '', status = '', date = '', from = '', to = '', page = 1, limit = 10 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let where = ['1=1'];
    const params = [];

    if (search) {
      where.push('(a.title LIKE ? OR a.description LIKE ? OR a.location LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (category) { where.push('a.category_id = ?'); params.push(category); }
    if (status) { where.push('a.status = ?'); params.push(status); }
    if (date) {
      if (activityColumns.end_date) { where.push('a.date <= ? AND COALESCE(a.end_date, a.date) >= ?'); params.push(date, date); }
      else { where.push('a.date = ?'); params.push(date); }
    }
    if (from) { where.push(`${dateRangeExpr('a')} >= ?`); params.push(from); }
    if (to) { where.push('a.date <= ?'); params.push(to); }

    const whereStr = where.join(' AND ');

    const [rows] = await pool.query(`
      SELECT a.*, c.name as category_name,
        (SELECT COUNT(*) FROM activity_registrations WHERE activity_id = a.id) as registered_count,
        (SELECT COUNT(*) FROM activity_registrations WHERE activity_id = a.id AND user_id = ?) as is_registered
      FROM activities a
      LEFT JOIN activity_categories c ON a.category_id = c.id
      WHERE ${whereStr}
      ORDER BY a.date DESC, a.start_time ASC
      LIMIT ? OFFSET ?
    `, [req.user.id, ...params, parseInt(limit), offset]);

    const [totalRows] = await pool.query(`SELECT COUNT(*) as count FROM activities a WHERE ${whereStr}`, params);
    const total = totalRows[0].count;

    res.json({ activities: rows, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (e) { console.error(e); res.status(500).json({ error: 'เกิดข้อผิดพลาด' }); }
});

router.get('/:id', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT a.*, c.name as category_name, u.name as creator_name,
        (SELECT COUNT(*) FROM activity_registrations WHERE activity_id = a.id) as registered_count,
        (SELECT COUNT(*) FROM activity_registrations WHERE activity_id = a.id AND user_id = ?) as is_registered
      FROM activities a
      LEFT JOIN activity_categories c ON a.category_id = c.id
      LEFT JOIN users u ON a.created_by = u.id
      WHERE a.id = ?
    `, [req.user.id, req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'ไม่พบกิจกรรม' });
    res.json(rows[0]);
  } catch (e) { console.error(e); res.status(500).json({ error: 'เกิดข้อผิดพลาด' }); }
});

router.post('/', requireAuth, requireRole('staff'), async (req, res) => {
  try {
    const {
      title, description, category_id, date, end_date, start_time, end_time,
      registration_start_at, registration_end_at, location, capacity, hours_credit, status
    } = req.body;
    if (!title || !date) return res.status(400).json({ error: 'กรุณากรอกชื่อและวันที่กิจกรรม' });
    if (end_date && end_date < date) return res.status(400).json({ error: 'วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่มกิจกรรม' });
    if (registration_start_at && registration_end_at && registration_end_at < registration_start_at) {
      return res.status(400).json({ error: 'เวลาปิดรับสมัครต้องไม่ก่อนเวลาเปิดรับสมัคร' });
    }
    const fields = ['title', 'description', 'category_id', 'date', 'start_time', 'end_time', 'location', 'capacity', 'hours_credit', 'status', 'created_by'];
    const values = [title, description || null, category_id || null, date, start_time || null, end_time || null,
      location || null, parseInt(capacity) || 0, parseFloat(hours_credit) || 0, status || 'open', req.user.id];
    pushActivityFields(fields, values, { end_date, registration_start_at, registration_end_at });
    const placeholders = fields.map(() => '?').join(', ');
    const [result] = await pool.query(`
      INSERT INTO activities (${fields.join(', ')})
      VALUES (${placeholders})`, values);
    const [rows] = await pool.query('SELECT * FROM activities WHERE id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (e) { console.error(e); res.status(500).json({ error: 'เกิดข้อผิดพลาด' }); }
});

router.put('/:id', requireAuth, requireRole('staff'), async (req, res) => {
  try {
    const {
      title, description, category_id, date, end_date, start_time, end_time,
      registration_start_at, registration_end_at, location, capacity, hours_credit, status
    } = req.body;
    const [existing] = await pool.query('SELECT id FROM activities WHERE id = ?', [req.params.id]);
    if (!existing.length) return res.status(404).json({ error: 'ไม่พบกิจกรรม' });
    if (!title || !date) return res.status(400).json({ error: 'กรุณากรอกชื่อและวันที่กิจกรรม' });
    if (end_date && end_date < date) return res.status(400).json({ error: 'วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่มกิจกรรม' });
    if (registration_start_at && registration_end_at && registration_end_at < registration_start_at) {
      return res.status(400).json({ error: 'เวลาปิดรับสมัครต้องไม่ก่อนเวลาเปิดรับสมัคร' });
    }
    const sets = ['title=?', 'description=?', 'category_id=?', 'date=?', 'start_time=?', 'end_time=?', 'location=?', 'capacity=?', 'hours_credit=?', 'status=?'];
    const values = [title, description || null, category_id || null, date, start_time || null, end_time || null,
      location || null, parseInt(capacity) || 0, parseFloat(hours_credit) || 0, status || 'open'];
    pushActivityUpdates(sets, values, { end_date, registration_start_at, registration_end_at });
    values.push(req.params.id);
    await pool.query(`UPDATE activities SET ${sets.join(', ')} WHERE id=?`, values);
    const [rows] = await pool.query('SELECT * FROM activities WHERE id = ?', [req.params.id]);
    res.json(rows[0]);
  } catch (e) { console.error(e); res.status(500).json({ error: 'เกิดข้อผิดพลาด' }); }
});

router.delete('/:id', requireAuth, requireRole('staff'), async (req, res) => {
  try {
    const [result] = await pool.query('DELETE FROM activities WHERE id = ?', [req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ error: 'ไม่พบกิจกรรม' });
    res.json({ success: true });
  } catch (e) { console.error(e); res.status(500).json({ error: 'เกิดข้อผิดพลาด' }); }
});

router.post('/:id/register', requireAuth, requireRole('student'), async (req, res) => {
  try {
    const [acts] = await pool.query(`
      SELECT *,
        ${activityColumns.registration_start_at ? 'registration_start_at IS NOT NULL AND registration_start_at > NOW()' : '0'} as registration_not_started,
        ${activityColumns.registration_end_at ? 'registration_end_at IS NOT NULL AND registration_end_at < NOW()' : '0'} as registration_ended
      FROM activities WHERE id = ?`, [req.params.id]);
    if (!acts.length) return res.status(404).json({ error: 'ไม่พบกิจกรรม' });
    const activity = acts[0];
    if (activity.status !== 'open') return res.status(400).json({ error: 'กิจกรรมปิดรับสมัครแล้ว' });
    if (activity.registration_not_started) return res.status(400).json({ error: 'กิจกรรมนี้ยังไม่เปิดรับสมัคร' });
    if (activity.registration_ended) return res.status(400).json({ error: 'หมดเวลารับสมัครกิจกรรมนี้แล้ว' });

    const [regs] = await pool.query('SELECT COUNT(*) as c FROM activity_registrations WHERE activity_id = ?', [req.params.id]);
    if (activity.capacity > 0 && regs[0].c >= activity.capacity) return res.status(400).json({ error: 'กิจกรรมเต็มแล้ว' });

    try {
      await pool.query('INSERT INTO activity_registrations (activity_id, user_id) VALUES (?, ?)', [req.params.id, req.user.id]);
      res.json({ success: true, message: 'ลงทะเบียนสำเร็จ' });
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: 'คุณลงทะเบียนกิจกรรมนี้แล้ว' });
      throw err;
    }
  } catch (e) { console.error(e); res.status(500).json({ error: 'เกิดข้อผิดพลาด' }); }
});

router.delete('/:id/register', requireAuth, requireRole('student'), async (req, res) => {
  try {
    const [result] = await pool.query('DELETE FROM activity_registrations WHERE activity_id = ? AND user_id = ?', [req.params.id, req.user.id]);
    if (!result.affectedRows) return res.status(404).json({ error: 'ไม่พบการลงทะเบียน' });
    res.json({ success: true });
  } catch (e) { console.error(e); res.status(500).json({ error: 'เกิดข้อผิดพลาด' }); }
});

module.exports = router;
