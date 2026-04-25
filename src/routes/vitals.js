const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { requireAuth, requireApiKey } = require('../middleware/auth');
const { matchDiseases } = require('../models/diseaseKnowledge');

// POST /api/iot/vitals - IoT device endpoint
router.post('/iot/vitals', requireApiKey, async (req, res) => {
  const { deviceId, device_id, heartRate, heart_rate, spo2, temperature } = req.body;
  const dId = deviceId || device_id;
  const hr = heartRate || heart_rate;

  if (!dId || !hr || !spo2 || !temperature) {
    return res.status(400).json({ success: false, message: 'Missing required fields: deviceId, heartRate, spo2, temperature' });
  }

  try {
    // Find active patient for device
    const [patients] = await db.query(
      `SELECT * FROM patients WHERE device_id = ?
       AND (device_expires_at IS NULL OR device_expires_at > NOW())`,
      [dId]
    );

    if (patients.length === 0) {
      return res.status(404).json({ success: false, message: 'No active patient for this device' });
    }

    const patient = patients[0];

    // Insert vital reading
    const [result] = await db.query(
      `INSERT INTO vital_readings (patient_id, device_id, heart_rate, spo2, temperature)
       VALUES (?, ?, ?, ?, ?)`,
      [patient.id, dId, hr, spo2, temperature]
    );

    // Generate alerts for abnormal values
    const alerts = [];
    if (hr > 100) alerts.push({ type: 'VITAL_ABNORMAL', msg: `High heart rate: ${hr} bpm` });
    if (hr < 50) alerts.push({ type: 'VITAL_ABNORMAL', msg: `Low heart rate: ${hr} bpm` });
    if (spo2 < 95) alerts.push({ type: 'VITAL_ABNORMAL', msg: `Low SpO2: ${spo2}%` });
    if (parseFloat(temperature) >= 38.0) alerts.push({ type: 'VITAL_ABNORMAL', msg: `High temperature: ${temperature}°C` });
    if (parseFloat(temperature) < 35.0) alerts.push({ type: 'VITAL_ABNORMAL', msg: `Low temperature: ${temperature}°C` });

    for (const a of alerts) {
      await db.query(
        'INSERT INTO health_alerts (patient_id, alert_type, message) VALUES (?, ?, ?)',
        [patient.id, a.type, `${patient.full_name}: ${a.msg}`]
      );
    }

    // Run disease matching
    const matches = matchDiseases({
      temperature: parseFloat(temperature),
      heartRate: parseInt(hr),
      spo2: parseInt(spo2)
    });

    res.json({
      success: true,
      message: 'Vitals recorded successfully',
      data: {
        id: result.insertId,
        patientId: patient.id,
        patientName: patient.full_name,
        heartRate: hr, spo2, temperature,
        alertsGenerated: alerts.length,
        diseaseMatches: matches.length
      }
    });
  } catch (e) {
    console.error('IoT vitals error:', e);
    res.status(500).json({ success: false, message: e.message });
  }
});

// GET /api/iot/device-status/:deviceId
router.get('/iot/device-status/:deviceId', async (req, res) => {
  const [patients] = await db.query(
    `SELECT id FROM patients WHERE device_id = ?
     AND (device_expires_at IS NULL OR device_expires_at > NOW())`,
    [req.params.deviceId]
  );
  res.json({ success: true, data: patients.length > 0, message: patients.length > 0 ? 'Device active' : 'No active patient' });
});

// GET /patients/:patientId/vitals - Web view
router.get('/patients/:patientId/vitals', requireAuth, async (req, res) => {
  const doctorId = req.session.doctorId;
  const [[patient]] = await db.query('SELECT * FROM patients WHERE id = ? AND doctor_id = ?', [req.params.patientId, doctorId]);
  if (!patient) { req.flash('error', 'Patient not found'); return res.redirect('/patients'); }

  const page = parseInt(req.query.page) || 1;
  const limit = 20;
  const offset = (page - 1) * limit;

  const [[{ total }]] = await db.query('SELECT COUNT(*) as total FROM vital_readings WHERE patient_id = ?', [patient.id]);
  const [vitals] = await db.query(
    'SELECT * FROM vital_readings WHERE patient_id = ? ORDER BY recorded_at DESC LIMIT ? OFFSET ?',
    [patient.id, limit, offset]
  );

  res.render('vitals/index', {
    title: `Vitals - ${patient.full_name}`,
    patient, vitals,
    currentPage: page,
    totalPages: Math.ceil(total / limit),
    success: req.flash('success'),
    error: req.flash('error')
  });
});

// POST /patients/:patientId/vitals - Manual vital entry
router.post('/patients/:patientId/vitals', requireAuth, async (req, res) => {
  const { heart_rate, spo2, temperature } = req.body;
  const [[patient]] = await db.query('SELECT * FROM patients WHERE id = ? AND doctor_id = ?', [req.params.patientId, req.session.doctorId]);
  if (!patient) { req.flash('error', 'Patient not found'); return res.redirect('/patients'); }

  await db.query(
    'INSERT INTO vital_readings (patient_id, device_id, heart_rate, spo2, temperature) VALUES (?, ?, ?, ?, ?)',
    [patient.id, 'MANUAL', heart_rate || null, spo2 || null, temperature || null]
  );
  req.flash('success', 'Vital reading added');
  res.redirect(`/patients/${patient.id}/vitals`);
});

// API: GET /api/patients/:patientId/vitals
router.get('/api/patients/:patientId/vitals', requireAuth, async (req, res) => {
  const [[patient]] = await db.query('SELECT id FROM patients WHERE id = ? AND doctor_id = ?', [req.params.patientId, req.session.doctorId]);
  if (!patient) return res.json({ success: false, message: 'Not found' });

  const [vitals] = await db.query(
    'SELECT * FROM vital_readings WHERE patient_id = ? ORDER BY recorded_at DESC LIMIT 50', [patient.id]
  );
  res.json({ success: true, data: vitals });
});

module.exports = router;
