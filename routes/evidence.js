const express = require('express');
const multer = require('multer');
const path = require('path');
const db = require('../db/database');
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
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('ไฟล์ต้องเป็น JPG, PNG, GIF หรือ PDF'));
  }
});

// GET /api/evidence — all evidence (staff)
router.get('/', requireAuth, requireRole('staff'), (req, res) => {
  const { status = '', page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  let where = '1=1';
  const params = [];
  if (status) { where += ' AND e.status = ?'; params.push(status); }

  const rows = db.prepare(`
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
  `).all(...params, parseInt(limit), offset);

  const total = db.prepare(`SELECT COUNT(*) as c FROM evidence_submissions e WHERE ${where}`).get(...params).c;
  res.json({ evidence: rows, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
});

// GET /api/evidence/my — my submissions
router.get('/my', requireAuth, (req, res) => {
  const rows = db.prepare(`
    SELECT e.*, a.title as activity_title, a.date as activity_date, a.hours_credit,
      r.name as reviewer_name
    FROM evidence_submissions e
    JOIN activities a ON e.activity_id = a.id
    LEFT JOIN users r ON e.reviewer_id = r.id
    WHERE e.user_id = ?
    ORDER BY e.submitted_at DESC
  `).all(req.user.id);
  res.json(rows);
});

// POST /api/evidence — submit evidence
router.post('/', requireAuth, requireRole('student'), upload.single('file'), (req, res) => {
  const { activity_id, description } = req.body;
  if (!activity_id) return res.status(400).json({ error: 'กรุณาระบุกิจกรรม' });

  const activity = db.prepare('SELECT id FROM activities WHERE id = ?').get(activity_id);
  if (!activity) return res.status(404).json({ error: 'ไม่พบกิจกรรม' });

  const filePath = req.file ? `/uploads/${req.file.filename}` : null;
  const fileType = req.file ? path.extname(req.file.originalname).replace('.', '').toLowerCase() : null;

  db.prepare(`
    INSERT INTO evidence_submissions (user_id, activity_id, file_path, file_type, description)
    VALUES (?, ?, ?, ?, ?)
  `).run(req.user.id, activity_id, filePath, fileType, description || null);

  res.status(201).json(db.prepare('SELECT * FROM evidence_submissions WHERE id = ?').get(db.lastInsertRowid));
});

// PUT /api/evidence/:id/review — approve or reject (staff)
router.put('/:id/review', requireAuth, requireRole('staff'), (req, res) => {
  const { status, reviewer_note } = req.body;
  if (!['approved', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'status ต้องเป็น approved หรือ rejected' });
  }

  const evidence = db.prepare(`
    SELECT e.*, a.title as activity_title, u.name as student_name
    FROM evidence_submissions e
    JOIN activities a ON e.activity_id = a.id
    JOIN users u ON e.user_id = u.id
    WHERE e.id = ?
  `).get(req.params.id);
  if (!evidence) return res.status(404).json({ error: 'ไม่พบหลักฐาน' });

  db.prepare(`
    UPDATE evidence_submissions
    SET status=?, reviewer_id=?, reviewer_note=?, reviewed_at=CURRENT_TIMESTAMP
    WHERE id=?
  `).run(status, req.user.id, reviewer_note || null, req.params.id);

  // Send notification to student
  const statusTh = status === 'approved' ? 'อนุมัติ' : 'ปฏิเสธ';
  const note = reviewer_note ? ` — ${reviewer_note}` : '';
  db.prepare(`
    INSERT INTO notifications (user_id, title, message, type)
    VALUES (?, ?, ?, ?)
  `).run(
    evidence.user_id,
    `หลักฐานถูก${statusTh}แล้ว`,
    `หลักฐานกิจกรรม "${evidence.activity_title}" ของคุณถูก${statusTh}${note}`,
    status === 'approved' ? 'evidence_approved' : 'evidence_rejected'
  );

  // If approved, mark registration as attended
  if (status === 'approved') {
    db.prepare(`
      UPDATE activity_registrations SET status='attended'
      WHERE activity_id=? AND user_id=?
    `).run(evidence.activity_id, evidence.user_id);
  }

  res.json({ success: true });
});

module.exports = router;
