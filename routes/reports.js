const express = require('express');
const db = require('../db/database');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');
const router = express.Router();

// GET /api/reports/students — export CSV
router.get('/students', requireAuth, requireRole('staff'), (req, res) => {
  const { category = '', status = '' } = req.query;

  let where = '1=1';
  const params = [];
  if (category) { where += ' AND a.category_id = ?'; params.push(category); }

  const rows = db.prepare(`
    SELECT
      u.student_id, u.name, u.email,
      c.name as category,
      a.title as activity_title, a.date as activity_date,
      a.hours_credit,
      ar.status as attendance_status,
      ar.registered_at
    FROM activity_registrations ar
    JOIN users u ON ar.user_id = u.id
    JOIN activities a ON ar.activity_id = a.id
    LEFT JOIN activity_categories c ON a.category_id = c.id
    WHERE ${where}
    ORDER BY u.name, a.date
  `).all(...params);

  const escapeCSV = v => {
    if (v == null) return '';
    const s = String(v);
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const headers = ['รหัสนิสิต', 'ชื่อ-นามสกุล', 'อีเมล', 'หมวดหมู่', 'กิจกรรม', 'วันที่', 'ชั่วโมง', 'สถานะ', 'วันที่ลงทะเบียน'];
  const lines = [
    '﻿' + headers.join(','),
    ...rows.map(r => [
      r.student_id, r.name, r.email, r.category, r.activity_title,
      r.activity_date, r.hours_credit, r.attendance_status, r.registered_at
    ].map(escapeCSV).join(','))
  ];

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="student_activities_report_${new Date().toISOString().slice(0,10)}.csv"`);
  res.send(lines.join('\r\n'));
});

// GET /api/reports/summary — summary per student
router.get('/summary', requireAuth, requireRole('staff'), (req, res) => {
  const rows = db.prepare(`
    SELECT
      u.id, u.student_id, u.name, u.email,
      COUNT(CASE WHEN ar.status='attended' THEN 1 END) as total_activities,
      SUM(CASE WHEN ar.status='attended' THEN a.hours_credit ELSE 0 END) as total_hours,
      COUNT(CASE WHEN ar.status='registered' THEN 1 END) as pending_activities
    FROM users u
    LEFT JOIN activity_registrations ar ON ar.user_id = u.id
    LEFT JOIN activities a ON ar.activity_id = a.id
    WHERE u.role = 'student'
    GROUP BY u.id
    ORDER BY u.name
  `).all();
  res.json(rows);
});

module.exports = router;
