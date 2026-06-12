const express = require('express');
const multer = require('multer');
const path = require('path');
const { pool } = require('../db/database');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');
const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '..', 'uploads')),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `evidence_${req.user.id}_${Date.now()}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.pdf', '.gif'];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowed.includes(ext));
  }
});

router.get('/', requireAuth, requireRole('staff'), async (req, res) => {
  try {
    const { status = '', page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    let where = '1=1';
    const params = [];
    if (status) { where += ' AND e.status = ?'; params.push(status); }

    const [rows] = await pool.query(`
      SELECT e.*, u.name as student_name, u.email as student_email,
        a.title as activity_title, a.date as activity_date,
        r.name as reviewer_name
      FROM evidence_submissions e
      JOIN users u ON e.user_id = u.id
      JOIN activities a ON e.activity_id = a.id
      LEFT JOIN users r ON e.reviewer_id = r.id
      WHERE ${where}
      ORDER BY e.submitted_at DESC
      LIMIT ? OFFSET ?
    `, [...params, parseInt(limit), offset]);

    const [totalRows] = await pool.query(`SELECT COUNT(*) as c FROM evidence_submissions e WHERE ${where}`, params);
    const total = totalRows[0].c;
    res.json({ evidence: rows, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (e) { console.error(e); res.status(500).json({ error: 'เกิดข้อผิดพลาด' }); }
});

router.get('/my', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT e.*, a.title as activity_title, a.date as activity_date, a.hours_credit,
        r.name as reviewer_name
      FROM evidence_submissions e
      JOIN activities a ON e.activity_id = a.id
      LEFT JOIN users r ON e.reviewer_id = r.id
      WHERE e.user_id = ?
      ORDER BY e.submitted_at DESC
    `, [req.user.id]);
    res.json(rows);
  } catch (e) { console.error(e); res.status(500).json({ error: 'เกิดข้อผิดพลาด' }); }
});

router.post('/', requireAuth, requireRole('student'), upload.single('file'), async (req, res) => {
  try {
    const { activity_id, description } = req.body;
    if (!activity_id) return res.status(400).json({ error: 'กรุณาระบุกิจกรรม' });

    const [acts] = await pool.query('SELECT id FROM activities WHERE id = ?', [activity_id]);
    if (!acts.length) return res.status(404).json({ error: 'ไม่พบกิจกรรม' });

    const filePath = req.file ? `/uploads/${req.file.filename}` : null;
    const fileType = req.file ? path.extname(req.file.originalname).replace('.', '').toLowerCase() : null;

    const [result] = await pool.query(`
      INSERT INTO evidence_submissions (user_id, activity_id, file_path, file_type, description)
      VALUES (?, ?, ?, ?, ?)`,
      [req.user.id, activity_id, filePath, fileType, description || null]);
    const [rows] = await pool.query('SELECT * FROM evidence_submissions WHERE id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (e) { console.error(e); res.status(500).json({ error: 'เกิดข้อผิดพลาด' }); }
});

router.put('/:id/review', requireAuth, requireRole('staff'), async (req, res) => {
  try {
    const { status, reviewer_note } = req.body;
    if (!['approved', 'rejected'].includes(status)) return res.status(400).json({ error: 'status ต้องเป็น approved หรือ rejected' });

    const [evidence] = await pool.query(`
      SELECT e.*, a.title as activity_title, u.name as student_name
      FROM evidence_submissions e
      JOIN activities a ON e.activity_id = a.id
      JOIN users u ON e.user_id = u.id
      WHERE e.id = ?`, [req.params.id]);
    if (!evidence.length) return res.status(404).json({ error: 'ไม่พบหลักฐาน' });
    const ev = evidence[0];

    await pool.query(`
      UPDATE evidence_submissions
      SET status=?, reviewer_id=?, reviewer_note=?, reviewed_at=NOW()
      WHERE id=?`, [status, req.user.id, reviewer_note || null, req.params.id]);

    const statusTh = status === 'approved' ? 'อนุมัติ' : 'ปฏิเสธ';
    const note = reviewer_note ? ` — ${reviewer_note}` : '';
    await pool.query(`
      INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)`,
      [ev.user_id, `หลักฐานถูก${statusTh}แล้ว`,
       `หลักฐานกิจกรรม "${ev.activity_title}" ของคุณถูก${statusTh}${note}`,
       status === 'approved' ? 'evidence_approved' : 'evidence_rejected']);

    if (status === 'approved') {
      await pool.query(`UPDATE activity_registrations SET status='attended' WHERE activity_id=? AND user_id=?`,
        [ev.activity_id, ev.user_id]);
    }

    res.json({ success: true });
  } catch (e) { console.error(e); res.status(500).json({ error: 'เกิดข้อผิดพลาด' }); }
});

module.exports = router;
