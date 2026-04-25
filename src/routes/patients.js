const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { matchDiseases, getAllDiseases } = require('../models/diseaseKnowledge');
const { body, validationResult } = require('express-validator');

// GET /patients
router.get('/', requireAuth, async (req, res) => {
  const doctorId = req.session.doctorId;
  const search = req.query.search || '';
  try {
    let query = `
      SELECT p.*,
        (SELECT heart_rate FROM vital_readings WHERE patient_id = p.id ORDER BY recorded_at DESC LIMIT 1) as last_hr,
        (SELECT spo2 FROM vital_readings WHERE patient_id = p.id ORDER BY recorded_at DESC LIMIT 1) as last_spo2,
        (SELECT temperature FROM vital_readings WHERE patient_id = p.id ORDER BY recorded_at DESC LIMIT 1) as last_temp,
        (SELECT recorded_at FROM vital_readings WHERE patient_id = p.id ORDER BY recorded_at DESC LIMIT 1) as last_vital_at,
        (SELECT COUNT(*) FROM health_alerts WHERE patient_id = p.id AND is_read = FALSE) as unread_alerts
      FROM patients p WHERE p.doctor_id = ?
    `;
    const params = [doctorId];
    if (search) {
      query += ' AND (p.full_name LIKE ? OR p.phone_number LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    query += ' ORDER BY p.full_name';
    const [patients] = await db.query(query, params);
    res.render('patients/index', {
      title: 'Patients',
      patients,
      search,
      success: req.flash('success'),
      error: req.flash('error')
    });
  } catch (e) {
    console.error(e);
    res.render('patients/index', { title: 'Patients', patients: [], search: '', success: [], error: ['Error loading patients'] });
  }
});

// GET /patients/new
router.get('/new', requireAuth, (req, res) => {
  res.render('patients/form', { title: 'Add Patient', patient: null, error: [], success: [], values: {} });
});

// POST /patients
router.post('/', requireAuth, [
  body('full_name').notEmpty().withMessage('Full name required'),
  body('gender').notEmpty().withMessage('Gender required')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.render('patients/form', {
      title: 'Add Patient', patient: null,
      error: errors.array().map(e => e.msg), success: [], values: req.body
    });
  }
  const { full_name, date_of_birth, gender, blood_type, phone_number, address, emergency_contact, medical_notes } = req.body;
  try {
    await db.query(
      `INSERT INTO patients (doctor_id, full_name, date_of_birth, gender, blood_type, phone_number, address, emergency_contact, medical_notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.session.doctorId, full_name, date_of_birth || null, gender, blood_type || null, phone_number || null, address || null, emergency_contact || null, medical_notes || null]
    );
    req.flash('success', 'Patient added successfully');
    res.redirect('/patients');
  } catch (e) {
    res.render('patients/form', { title: 'Add Patient', patient: null, error: ['Server error'], success: [], values: req.body });
  }
});

// GET /patients/:id
router.get('/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  const doctorId = req.session.doctorId;
  try {
    const [[patient]] = await db.query('SELECT * FROM patients WHERE id = ? AND doctor_id = ?', [id, doctorId]);
    if (!patient) { req.flash('error', 'Patient not found'); return res.redirect('/patients'); }

    const [vitals] = await db.query(
      'SELECT * FROM vital_readings WHERE patient_id = ? ORDER BY recorded_at DESC LIMIT 20', [id]
    );
    const [alerts] = await db.query(
      'SELECT * FROM health_alerts WHERE patient_id = ? ORDER BY created_at DESC LIMIT 10', [id]
    );
    const [diseases] = await db.query(
      'SELECT * FROM patient_disease_history WHERE patient_id = ? ORDER BY detected_at DESC', [id]
    );
    const [aiAnalysis] = await db.query(
      'SELECT * FROM ai_analysis_results WHERE patient_id = ? ORDER BY analyzed_at DESC LIMIT 5', [id]
    );

    // Disease matching from latest vitals
    let diseaseMatches = [];
    if (vitals.length > 0) {
      const latest = vitals[0];
      diseaseMatches = matchDiseases({
        temperature: parseFloat(latest.temperature),
        heartRate: latest.heart_rate,
        spo2: latest.spo2
      });
    }

    res.render('patients/show', {
      title: patient.full_name,
      patient, vitals, alerts, diseases, aiAnalysis, diseaseMatches,
      success: req.flash('success'),
      error: req.flash('error')
    });
  } catch (e) {
    console.error(e);
    req.flash('error', 'Error loading patient');
    res.redirect('/patients');
  }
});

// GET /patients/:id/edit
router.get('/:id/edit', requireAuth, async (req, res) => {
  const [[patient]] = await db.query('SELECT * FROM patients WHERE id = ? AND doctor_id = ?', [req.params.id, req.session.doctorId]);
  if (!patient) { req.flash('error', 'Patient not found'); return res.redirect('/patients'); }
  res.render('patients/form', { title: 'Edit Patient', patient, error: [], success: [], values: patient });
});

// POST /patients/:id/edit
router.post('/:id/edit', requireAuth, [
  body('full_name').notEmpty().withMessage('Full name required'),
], async (req, res) => {
  const errors = validationResult(req);
  const [[patient]] = await db.query('SELECT * FROM patients WHERE id = ? AND doctor_id = ?', [req.params.id, req.session.doctorId]);
  if (!patient) { req.flash('error', 'Patient not found'); return res.redirect('/patients'); }
  if (!errors.isEmpty()) {
    return res.render('patients/form', { title: 'Edit Patient', patient, error: errors.array().map(e => e.msg), success: [], values: req.body });
  }
  const { full_name, date_of_birth, gender, blood_type, phone_number, address, emergency_contact, medical_notes } = req.body;
  await db.query(
    `UPDATE patients SET full_name=?, date_of_birth=?, gender=?, blood_type=?, phone_number=?, address=?, emergency_contact=?, medical_notes=? WHERE id=?`,
    [full_name, date_of_birth || null, gender, blood_type || null, phone_number || null, address || null, emergency_contact || null, medical_notes || null, req.params.id]
  );
  req.flash('success', 'Patient updated');
  res.redirect(`/patients/${req.params.id}`);
});

// POST /patients/:id/delete
router.post('/:id/delete', requireAuth, async (req, res) => {
  const [[patient]] = await db.query('SELECT id FROM patients WHERE id = ? AND doctor_id = ?', [req.params.id, req.session.doctorId]);
  if (!patient) { req.flash('error', 'Patient not found'); return res.redirect('/patients'); }
  await db.query('DELETE FROM patients WHERE id = ?', [req.params.id]);
  req.flash('success', 'Patient deleted');
  res.redirect('/patients');
});

// POST /patients/:id/device/assign
router.post('/:id/device/assign', requireAuth, async (req, res) => {
  const { device_id, duration_seconds } = req.body;
  const [[patient]] = await db.query('SELECT id FROM patients WHERE id = ? AND doctor_id = ?', [req.params.id, req.session.doctorId]);
  if (!patient) { req.flash('error', 'Patient not found'); return res.redirect('/patients'); }
  
  let expiresAt = null;
  if (duration_seconds) {
    expiresAt = new Date(Date.now() + parseInt(duration_seconds) * 1000);
  }
  await db.query(
    'UPDATE patients SET device_id=?, device_assigned_at=NOW(), device_expires_at=? WHERE id=?',
    [device_id, expiresAt, req.params.id]
  );
  req.flash('success', 'Device assigned successfully');
  res.redirect(`/patients/${req.params.id}`);
});

// POST /patients/:id/device/unassign
router.post('/:id/device/unassign', requireAuth, async (req, res) => {
  await db.query('UPDATE patients SET device_id=NULL, device_assigned_at=NULL, device_expires_at=NULL WHERE id=? AND doctor_id=?',
    [req.params.id, req.session.doctorId]);
  req.flash('success', 'Device unassigned');
  res.redirect(`/patients/${req.params.id}`);
});

// POST /patients/:id/disease-history
router.post('/:id/disease-history', requireAuth, async (req, res) => {
  const { disease_name, possible_causes, status, doctor_notes, detected_temperature, detected_heart_rate, detected_spo2 } = req.body;
  const [[patient]] = await db.query('SELECT id FROM patients WHERE id = ? AND doctor_id = ?', [req.params.id, req.session.doctorId]);
  if (!patient) return res.redirect('/patients');

  await db.query(
    `INSERT INTO patient_disease_history (patient_id, disease_name, possible_causes, status, doctor_notes, detected_temperature, detected_heart_rate, detected_spo2)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [req.params.id, disease_name, possible_causes || null, status || 'ACTIVE', doctor_notes || null,
     detected_temperature || null, detected_heart_rate || null, detected_spo2 || null]
  );
  req.flash('success', 'Disease recorded');
  res.redirect(`/patients/${req.params.id}`);
});

// POST /patients/:id/disease-history/:hid/clear
router.post('/:id/disease-history/:hid/clear', requireAuth, async (req, res) => {
  const { clearance_notes } = req.body;
  await db.query(
    'UPDATE patient_disease_history SET status="RESOLVED", cleared_at=NOW(), clearance_notes=? WHERE id=?',
    [clearance_notes || null, req.params.hid]
  );
  req.flash('success', 'Disease marked as resolved');
  res.redirect(`/patients/${req.params.id}`);
});

module.exports = router;
