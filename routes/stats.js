const express = require('express');
const db = require('../db/database');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();

// GET /api/stats/dashboard
router.get('/dashboard', requireAuth, (req, res) => {
  if (req.user.role === 'staff') {
    const totalActivities = db.prepare('SELECT COUNT(*) as c FROM activities').get().c;
    const openActivities = db.prepare("SELECT COUNT(*) as c FROM activities WHERE status='open'").get().c;
    const totalStudents = db.prepare("SELECT COUNT(*) as c FROM users WHERE role='student'").get().c;
    const pendingEvidence = db.prepare("SELECT COUNT(*) as c FROM evidence_submissions WHERE status='pending'").get().c;
    const recentActivities = db.prepare(`
      SELECT a.*, c.name as category_name,
        (SELECT COUNT(*) FROM activity_registrations WHERE activity_id = a.id) as registered_count
      FROM activities a LEFT JOIN activity_categories c ON a.category_id = c.id
      ORDER BY a.created_at DESC LIMIT 5
    `).all();

    return res.json({ totalActivities, openActivities, totalStudents, pendingEvidence, recentActivities });
  }

  // Student dashboard
  const myRegistrations = db.prepare(`
    SELECT ar.*, a.title, a.date, a.hours_credit, a.status as activity_status, c.name as category_name
    FROM activity_registrations ar
    JOIN activities a ON ar.activity_id = a.id
    LEFT JOIN activity_categories c ON a.category_id = c.id
    WHERE ar.user_id = ?
    ORDER BY a.date DESC
  `).all(req.user.id);

  const totalHours = db.prepare(`
    SELECT SUM(a.hours_credit) as total
    FROM activity_registrations ar
    JOIN activities a ON ar.activity_id = a.id
    WHERE ar.user_id = ? AND ar.status = 'attended'
  `).get(req.user.id).total || 0;

  const attendedCount = myRegistrations.filter(r => r.status === 'attended').length;
  const pendingCount = myRegistrations.filter(r => r.status === 'registered').length;

  const categories = db.prepare('SELECT * FROM activity_categories').all();
  const categoryProgress = categories.map(cat => {
    const earned = db.prepare(`
      SELECT SUM(a.hours_credit) as total
      FROM activity_registrations ar
      JOIN activities a ON ar.activity_id = a.id
      WHERE ar.user_id = ? AND a.category_id = ? AND ar.status = 'attended'
    `).get(req.user.id, cat.id).total || 0;
    return { ...cat, earned_hours: earned, passed: earned >= cat.min_hours };
  });

  const upcomingActivities = db.prepare(`
    SELECT a.*, c.name as category_name
    FROM activities a
    LEFT JOIN activity_categories c ON a.category_id = c.id
    WHERE a.status = 'open' AND a.date >= date('now')
    ORDER BY a.date ASC LIMIT 5
  `).all();

  res.json({ totalHours, attendedCount, pendingCount, myRegistrations, categoryProgress, upcomingActivities });
});

module.exports = router;
