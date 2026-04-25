const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { requireAuth } = require('../middleware/auth');

// GET /alerts
router.get('/', requireAuth, async (req, res) => {
  const doctorId = req.session.doctorId;
  const page = parseInt(req.query.page) || 1;
  const limit = 20;
  const offset = (page - 1) * limit;
  const filter = req.query.filter || 'all'; // all | unread

  try {
    let where = `p.doctor_id = ?`;
    const params = [doctorId];
    if (filter === 'unread') { where += ' AND ha.is_read = FALSE'; }

    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) as total FROM health_alerts ha JOIN patients p ON ha.patient_id = p.id WHERE ${where}`,
      params
    );

    const [alerts] = await db.query(
      `SELECT ha.*, p.full_name as patient_name
       FROM health_alerts ha JOIN patients p ON ha.patient_id = p.id
       WHERE ${where} ORDER BY ha.created_at DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    res.render('alerts/index', {
      title: 'Health Alerts',
      alerts,
      filter,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      success: req.flash('success'),
      error: req.flash('error')
    });
  } catch (e) {
    console.error(e);
    res.render('alerts/index', { title: 'Health Alerts', alerts: [], filter: 'all', currentPage: 1, totalPages: 1, success: [], error: ['Error loading alerts'] });
  }
});

// POST /alerts/:id/read
router.post('/:id/read', requireAuth, async (req, res) => {
  await db.query(
    `UPDATE health_alerts SET is_read = TRUE WHERE id = ?
     AND patient_id IN (SELECT id FROM patients WHERE doctor_id = ?)`,
    [req.params.id, req.session.doctorId]
  );
  res.json({ success: true });
});

// POST /alerts/read-all
router.post('/read-all', requireAuth, async (req, res) => {
  await db.query(
    `UPDATE health_alerts SET is_read = TRUE
     WHERE patient_id IN (SELECT id FROM patients WHERE doctor_id = ?)`,
    [req.session.doctorId]
  );
  req.flash('success', 'All alerts marked as read');
  res.redirect('/alerts');
});

// API: GET /api/alerts/unread/count
router.get('/api/unread-count', requireAuth, async (req, res) => {
  const [[{ count }]] = await db.query(
    `SELECT COUNT(*) as count FROM health_alerts ha
     JOIN patients p ON ha.patient_id = p.id
     WHERE p.doctor_id = ? AND ha.is_read = FALSE`,
    [req.session.doctorId]
  );
  res.json({ success: true, data: { count } });
});

module.exports = router;
