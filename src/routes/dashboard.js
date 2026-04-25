const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { requireAuth } = require('../middleware/auth');

// GET /dashboard
router.get('/', requireAuth, async (req, res) => {
  const doctorId = req.session.doctorId;
  try {
    // Patient count
    const [[{ totalPatients }]] = await db.query(
      'SELECT COUNT(*) as totalPatients FROM patients WHERE doctor_id = ?', [doctorId]
    );

    // Active device count
    const [[{ activeDevices }]] = await db.query(
      'SELECT COUNT(*) as activeDevices FROM patients WHERE doctor_id = ? AND device_id IS NOT NULL', [doctorId]
    );

    // Unread alerts
    const [[{ unreadAlerts }]] = await db.query(
      `SELECT COUNT(*) as unreadAlerts FROM health_alerts ha
       JOIN patients p ON ha.patient_id = p.id
       WHERE p.doctor_id = ? AND ha.is_read = FALSE`, [doctorId]
    );

    // Recent alerts
    const [alerts] = await db.query(
      `SELECT ha.*, p.full_name as patient_name
       FROM health_alerts ha
       JOIN patients p ON ha.patient_id = p.id
       WHERE p.doctor_id = ?
       ORDER BY ha.created_at DESC LIMIT 5`, [doctorId]
    );

    // Recent vitals with patient name
    const [recentVitals] = await db.query(
      `SELECT vr.*, p.full_name as patient_name
       FROM vital_readings vr
       JOIN patients p ON vr.patient_id = p.id
       WHERE p.doctor_id = ?
       ORDER BY vr.recorded_at DESC LIMIT 10`, [doctorId]
    );

    // Patients with latest vitals
    const [patients] = await db.query(
      `SELECT p.*,
         (SELECT heart_rate FROM vital_readings WHERE patient_id = p.id ORDER BY recorded_at DESC LIMIT 1) as last_hr,
         (SELECT spo2 FROM vital_readings WHERE patient_id = p.id ORDER BY recorded_at DESC LIMIT 1) as last_spo2,
         (SELECT temperature FROM vital_readings WHERE patient_id = p.id ORDER BY recorded_at DESC LIMIT 1) as last_temp,
         (SELECT recorded_at FROM vital_readings WHERE patient_id = p.id ORDER BY recorded_at DESC LIMIT 1) as last_vital_at
       FROM patients p WHERE p.doctor_id = ? ORDER BY p.full_name LIMIT 10`, [doctorId]
    );

    res.render('dashboard/index', {
      title: 'Dashboard',
      totalPatients,
      activeDevices,
      unreadAlerts,
      alerts,
      recentVitals,
      patients,
      success: req.flash('success'),
      error: req.flash('error')
    });
  } catch (e) {
    console.error('Dashboard error:', e);
    res.render('dashboard/index', {
      title: 'Dashboard',
      totalPatients: 0, activeDevices: 0, unreadAlerts: 0,
      alerts: [], recentVitals: [], patients: [],
      success: [], error: ['Failed to load dashboard data']
    });
  }
});

module.exports = router;
