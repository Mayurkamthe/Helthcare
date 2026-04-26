'use strict';
const vitalService   = require('../services/vitalService');
const diseaseService = require('../services/diseaseService');

// ────────────────────────────────────────────────────────────────────────────────
//  IoT ENDPOINTS  (used by ESP32 / Raspberry Pi / Python simulators)
// ────────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/iot/vitals
 * Primary IoT data-ingestion endpoint.
 * Accepts { deviceId, heartRate, spo2, temperature }
 * Validates API key, records reading, auto-generates alerts, runs disease matching.
 */
exports.receiveIoTVitals = async (req, res) => {
  const { deviceId, device_id, heartRate, heart_rate, spo2, temperature } = req.body;
  const dId = deviceId || device_id;
  const hr  = heartRate || heart_rate;

  if (!dId || hr == null || spo2 == null || temperature == null) {
    return res.status(400).json({
      success: false,
      message: 'Required: deviceId, heartRate, spo2, temperature'
    });
  }

  const result = await vitalService.processIoTVitals({
    deviceId: dId,
    heartRate: parseInt(hr),
    spo2: parseInt(spo2),
    temperature: parseFloat(temperature)
  });

  // Emit real-time event via Socket.IO
  const io = req.app.get('io');
  if (io) {
    io.to(`patient:${result.patient.id}`).emit('vital:new', {
      patientId:   result.patient.id,
      patientName: result.patient.full_name,
      heartRate:   result.reading.heart_rate,
      spo2:        result.reading.spo2,
      temperature: parseFloat(result.reading.temperature),
      recordedAt:  result.reading.recorded_at,
      alerts:      result.alerts.length,
      matches:     result.diseaseMatches.length
    });
    // Also broadcast to the doctor's room
    io.to(`doctor:${result.patient.doctor_id}`).emit('vital:new', {
      patientId:   result.patient.id,
      patientName: result.patient.full_name,
      heartRate:   result.reading.heart_rate,
      spo2:        result.reading.spo2,
      temperature: parseFloat(result.reading.temperature),
      alertsCount: result.alerts.length
    });
  }

  res.json({
    success: true,
    message: 'Vitals recorded successfully',
    data: {
      id:             result.reading.id,
      patientId:      result.patient.id,
      patientName:    result.patient.full_name,
      heartRate:      result.reading.heart_rate,
      spo2:           result.reading.spo2,
      temperature:    parseFloat(result.reading.temperature),
      recordedAt:     result.reading.recorded_at,
      alertsGenerated: result.alerts.length,
      diseaseMatches:  result.diseaseMatches.length,
      severity:        result.analysis ? result.analysis.severity : null
    }
  });
};

/**
 * GET /api/iot/device-status/:deviceId
 * Poll endpoint — returns true/false whether device has an active patient.
 */
exports.checkDeviceStatus = async (req, res) => {
  const active = await vitalService.isDeviceActive(req.params.deviceId);
  res.json({
    success: true,
    message: active ? 'Device active' : 'No active patient',
    data: active
  });
};

// ────────────────────────────────────────────────────────────────────────────────
//  API ENDPOINTS  (JWT-authenticated — used by mobile app / Postman)
// ────────────────────────────────────────────────────────────────────────────────

/** GET /api/patients/:patientId/vitals  — paginated */
exports.apiGetVitalHistory = async (req, res) => {
  const page  = parseInt(req.query.page  || 1);
  const limit = parseInt(req.query.size  || req.query.limit || 20);
  const result = await vitalService.getVitalHistory(req.params.patientId, { page, limit });
  res.json({ success: true, data: result });
};

/** GET /api/patients/:patientId/vitals/latest */
exports.apiGetLatestVitals = async (req, res) => {
  const v = await vitalService.getLatestVitals(req.params.patientId);
  if (!v) return res.json({ success: false, message: 'No readings found' });
  res.json({ success: true, data: v });
};

/** GET /api/patients/:patientId/vitals/recent  — last 10 */
exports.apiGetRecentVitals = async (req, res) => {
  const vitals = await vitalService.getRecentVitals(req.params.patientId);
  res.json({ success: true, data: vitals });
};

/** GET /api/patients/:patientId/vitals/range?start=...&end=... */
exports.apiGetVitalsByRange = async (req, res) => {
  const { start, end } = req.query;
  if (!start || !end) return res.status(400).json({ success: false, message: 'start and end query params required' });
  const vitals = await vitalService.getVitalsByDateRange(req.params.patientId, new Date(start), new Date(end));
  res.json({ success: true, data: vitals });
};

// ────────────────────────────────────────────────────────────────────────────────
//  WEB VIEWS
// ────────────────────────────────────────────────────────────────────────────────

/** GET /patients/:patientId/vitals */
exports.webVitalHistory = async (req, res) => {
  const patientService = require('../services/patientService');
  const patient = await patientService.getPatientById(req.params.patientId, req.session.doctorId);
  const page  = parseInt(req.query.page || 1);
  const result = await vitalService.getVitalHistory(patient.id, { page, limit: 20 });

  res.render('vitals/index', {
    title: `Vitals — ${patient.full_name}`,
    patient,
    vitals:      result.readings,
    currentPage: result.page,
    totalPages:  result.pages,
    success: req.flash('success'),
    error:   req.flash('error')
  });
};

/** POST /patients/:patientId/vitals  — manual entry from dashboard */
exports.webAddManualVital = async (req, res) => {
  const patientService = require('../services/patientService');
  const patient = await patientService.getPatientById(req.params.patientId, req.session.doctorId);
  await vitalService.addManualReading(patient.id, req.body);
  req.flash('success', 'Vital reading recorded');
  res.redirect(`/patients/${patient.id}`);
};

/** GET /api/patients/:patientId/vitals  — called by live chart via fetch() */
exports.webApiVitals = async (req, res) => {
  const result = await vitalService.getVitalHistory(req.params.patientId, { page: 1, limit: 50 });
  res.json({ success: true, data: result.readings });
};
