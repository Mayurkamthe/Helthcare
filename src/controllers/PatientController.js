'use strict';
const { body, validationResult } = require('express-validator');
const patientService = require('../services/patientService');
const diseaseService = require('../services/diseaseService');
const mlService      = require('../services/mlService');
// ── Validation rules ──────────────────────────────────────────────────────────
exports.createRules = [
  body('full_name').notEmpty().withMessage('Full name is required'),
  body('gender').notEmpty().withMessage('Gender is required')
];
exports.updateRules = [
  body('full_name').notEmpty().withMessage('Full name is required')
];

// ── Web: GET /patients ────────────────────────────────────────────────────────
exports.index = async (req, res) => {
  const search = req.query.search || '';
  const patients = await patientService.getAllPatients(req.session.doctorId, search);

  // Attach latest vitals to each patient
  const { VitalReading, HealthAlert } = require('../models');
  const enriched = await Promise.all(patients.map(async p => {
    const latest = await VitalReading.findOne({
      where: { patient_id: p.id },
      order: [['recorded_at', 'DESC']]
    });
    const unread = await HealthAlert.count({ where: { patient_id: p.id, is_read: false } });
    return { ...p.toJSON(), latest, unread_alerts: unread };
  }));

  res.render('patients/index', {
    title: 'Patients', patients: enriched, search,
    success: req.flash('success'), error: req.flash('error')
  });
};

// ── Web: GET /patients/new ────────────────────────────────────────────────────
exports.newForm = (req, res) => {
  res.render('patients/form', {
    title: 'Add Patient', patient: null, error: [], success: [], values: {}
  });
};

// ── Web: POST /patients ───────────────────────────────────────────────────────
exports.create = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.render('patients/form', {
      title: 'Add Patient', patient: null,
      error: errors.array().map(e => e.msg), success: [], values: req.body
    });
  }
  await patientService.createPatient(req.session.doctorId, _pick(req.body));
  req.flash('success', 'Patient added successfully');
  res.redirect('/patients');
};

// ── Web: GET /patients/:id ────────────────────────────────────────────────────
exports.show = async (req, res) => {
  const { patient, vitals, alerts, diseases, analyses } =
    await patientService.getPatientDetail(req.params.id, req.session.doctorId);

  const latest = vitals[0];
  let diseaseMatches = [];
  let mlPredictions  = null;
  if (latest) {
    diseaseMatches = diseaseService.matchDiseases({
      heartRate: latest.heart_rate,
      spo2: latest.spo2,
      temperature: latest.temperature
    });
    // ML prediction (non-blocking — null if service unavailable)
    mlPredictions = await mlService.predict({
      heartRate: latest.heart_rate,
      spo2: latest.spo2,
      temperature: latest.temperature
    });
  }

  res.render('patients/show', {
    title: patient.full_name,
    patient, vitals, alerts, diseases, analyses, diseaseMatches, mlPredictions,
    success: req.flash('success'), error: req.flash('error')
  });
};

// ── Web: GET /patients/:id/edit ───────────────────────────────────────────────
exports.editForm = async (req, res) => {
  const patient = await patientService.getPatientById(req.params.id, req.session.doctorId);
  res.render('patients/form', { title: 'Edit Patient', patient, error: [], success: [], values: patient.toJSON() });
};

// ── Web: POST /patients/:id/edit ──────────────────────────────────────────────
exports.update = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const patient = await patientService.getPatientById(req.params.id, req.session.doctorId);
    return res.render('patients/form', {
      title: 'Edit Patient', patient,
      error: errors.array().map(e => e.msg), success: [], values: req.body
    });
  }
  await patientService.updatePatient(req.params.id, req.session.doctorId, _pick(req.body));
  req.flash('success', 'Patient updated');
  res.redirect(`/patients/${req.params.id}`);
};

// ── Web: POST /patients/:id/delete ───────────────────────────────────────────
exports.destroy = async (req, res) => {
  await patientService.deletePatient(req.params.id, req.session.doctorId);
  req.flash('success', 'Patient deleted');
  res.redirect('/patients');
};

// ── Web: POST /patients/:id/device/assign ────────────────────────────────────
exports.assignDevice = async (req, res) => {
  const { device_id, duration_seconds } = req.body;
  await patientService.assignDevice(req.params.id, req.session.doctorId, device_id, duration_seconds ? parseInt(duration_seconds) : null);
  req.flash('success', 'Device assigned successfully');
  res.redirect(`/patients/${req.params.id}`);
};

// ── Web: POST /patients/:id/device/unassign ───────────────────────────────────
exports.unassignDevice = async (req, res) => {
  await patientService.unassignDevice(req.params.id, req.session.doctorId);
  req.flash('success', 'Device unassigned');
  res.redirect(`/patients/${req.params.id}`);
};

// ── API: GET /api/patients ────────────────────────────────────────────────────
exports.apiIndex = async (req, res) => {
  const patients = await patientService.getAllPatients(req.doctorId, req.query.search || '');
  res.json({ success: true, data: patients });
};

// ── API: GET /api/patients/:id ────────────────────────────────────────────────
exports.apiShow = async (req, res) => {
  const patient = await patientService.getPatientById(req.params.id, req.doctorId);
  res.json({ success: true, data: patient });
};

// ── API: POST /api/patients ───────────────────────────────────────────────────
exports.apiCreate = async (req, res) => {
  const patient = await patientService.createPatient(req.doctorId, _pick(req.body));
  res.json({ success: true, message: 'Patient created successfully', data: patient });
};

// ── API: PUT /api/patients/:id ────────────────────────────────────────────────
exports.apiUpdate = async (req, res) => {
  const patient = await patientService.updatePatient(req.params.id, req.doctorId, _pick(req.body));
  res.json({ success: true, message: 'Patient updated successfully', data: patient });
};

// ── API: DELETE /api/patients/:id ────────────────────────────────────────────
exports.apiDestroy = async (req, res) => {
  await patientService.deletePatient(req.params.id, req.doctorId);
  res.json({ success: true, message: 'Patient deleted successfully', data: null });
};

// ── API: POST /api/patients/:id/device/assign ────────────────────────────────
exports.apiAssignDevice = async (req, res) => {
  const { deviceId, device_id, durationSeconds, duration_seconds } = req.body;
  const dId = deviceId || device_id;
  const dur  = durationSeconds || duration_seconds;
  if (!dId) return res.status(400).json({ success: false, message: 'deviceId is required' });
  const patient = await patientService.assignDevice(req.params.id, req.doctorId, dId, dur || null);
  res.json({ success: true, message: 'Device assigned successfully', data: patient });
};

// ── API: POST /api/patients/:id/device/unassign ───────────────────────────────
exports.apiUnassignDevice = async (req, res) => {
  await patientService.unassignDevice(req.params.id, req.doctorId);
  res.json({ success: true, message: 'Device unassigned successfully', data: null });
};

// ── API: GET /api/patients/device/:deviceId/active-patient ───────────────────
exports.apiActivePatientForDevice = async (req, res) => {
  const patient = await patientService.findActivePatientForDevice(req.params.deviceId);
  if (!patient) return res.json({ success: false, message: 'No active patient for this device' });
  res.json({ success: true, data: patient });
};

// ── API: GET /api/patients/:id/disease-matches ────────────────────────────────
exports.apiDiseaseMatches = async (req, res) => {
  const { VitalReading } = require('../models');
  const latest = await VitalReading.findOne({
    where: { patient_id: req.params.id },
    order: [['recorded_at', 'DESC']]
  });
  if (!latest) return res.json({ success: true, data: [] });
  const matches = diseaseService.matchDiseases({
    heartRate: latest.heart_rate, spo2: latest.spo2, temperature: latest.temperature
  });
  res.json({ success: true, data: matches.map(m => ({
    diseaseName: m.disease.name,
    confidence: m.confidence,
    possibleCauses: m.disease.possibleCauses,
    symptoms: m.disease.symptoms,
    recommendations: m.disease.recommendations,
    matchedParameters: m.matchedParameters
  }))});
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function _pick(body) {
  return {
    full_name:         body.full_name,
    date_of_birth:     body.date_of_birth     || null,
    gender:            body.gender,
    blood_type:        body.blood_type         || null,
    phone_number:      body.phone_number       || null,
    address:           body.address            || null,
    emergency_contact: body.emergency_contact  || null,
    medical_notes:     body.medical_notes      || null
  };
}
