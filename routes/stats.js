const express = require('express');
const { pool } = require('../db/database');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();

router.get('/dashboard', requireAuth, async (req, res) => {
  try {
    if (req.user.role === 'staff') {
      const [[a1]] = await pool.query('SELECT COUNT(*) as c FROM activities');
      const [[a2]] = await pool.query("SELECT COUNT(*) as c FROM activities WHERE status='open'");
      const [[a3]] = await pool.query("SELECT COUNT(*) as c FROM users WHERE role='student'");
      const [[a4]] = await pool.query("SELECT COUNT(*) as c FROM evidence_submissions WHERE status='pending'");
      const [recent] = await pool.query(`
        SELECT a.*, c.name as category_name,
          (SELECT COUNT(*) FROM activity_registrations WHERE activity_id = a.id) as registered_count
        FROM activities a LEFT JOIN activity_categories c ON a.category_id = c.id
        ORDER BY a.created_at DESC LIMIT 5`);
      return res.json({
        totalActivities: a1.c, openActivities: a2.c, totalStudents: a3.c, pendingEvidence: a4.c,
        recentActivities: recent
      });
    }

    const [myRegistrations] = await pool.query(`
      SELECT ar.*, a.id as activity_id, a.title, a.date, a.end_date, a.start_time, a.end_time,
        a.hours_credit, a.status as activity_status, c.id as category_id, c.name as category_name
      FROM activity_registrations ar
      JOIN activities a ON ar.activity_id = a.id
      LEFT JOIN activity_categories c ON a.category_id = c.id
      WHERE ar.user_id = ?
      ORDER BY a.date DESC`, [req.user.id]);

    const [[hoursRow]] = await pool.query(`
      SELECT COALESCE(SUM(a.hours_credit), 0) as total
      FROM activity_registrations ar
      JOIN activities a ON ar.activity_id = a.id
      WHERE ar.user_id = ? AND ar.status = 'attended'`, [req.user.id]);

    const totalHours = Number(hoursRow.total);
    const attendedCount = myRegistrations.filter(r => r.status === 'attended').length;
    const pendingCount = myRegistrations.filter(r => r.status === 'registered').length;

    const [categories] = await pool.query('SELECT * FROM activity_categories');
    const categoryProgress = [];
    for (const cat of categories) {
      const [[er]] = await pool.query(`
        SELECT COALESCE(SUM(a.hours_credit), 0) as total
        FROM activity_registrations ar
        JOIN activities a ON ar.activity_id = a.id
        WHERE ar.user_id = ? AND a.category_id = ? AND ar.status = 'attended'`, [req.user.id, cat.id]);
      const earned = Number(er.total);
      categoryProgress.push({ ...cat, min_hours: Number(cat.min_hours), earned_hours: earned, passed: earned >= Number(cat.min_hours) });
    }

    const [upcoming] = await pool.query(`
      SELECT a.*, c.id as category_id, c.name as category_name
      FROM activities a
      LEFT JOIN activity_categories c ON a.category_id = c.id
      WHERE a.status = 'open' AND COALESCE(a.end_date, a.date) >= CURDATE()
      ORDER BY a.date ASC LIMIT 5`);

    res.json({
      totalHours, attendedCount, pendingCount,
      myRegistrations: myRegistrations.map(r => ({ ...r, hours_credit: Number(r.hours_credit) })),
      categoryProgress,
      upcomingActivities: upcoming.map(a => ({ ...a, hours_credit: Number(a.hours_credit) }))
    });
  } catch (e) { console.error(e); res.status(500).json({ error: 'เกิดข้อผิดพลาด' }); }
});

module.exports = router;
