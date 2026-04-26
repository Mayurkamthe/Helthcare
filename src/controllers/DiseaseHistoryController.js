'use strict';
const diseaseService = require('../services/diseaseService');

// ── Web: POST /patients/:id/disease-history ───────────────────────────────────
exports.create = async (req, res) => {
  await diseaseService.recordDiseaseManually(req.params.id, req.body);
  req.flash('success', 'Disease recorded');
  res.redirect(`/patients/${req.params.id}`);
};

// ── Web: POST /patients/:id/disease-history/:hid/clear ───────────────────────
exports.clear = async (req, res) => {
  await diseaseService.clearDisease(req.params.hid, req.body.clearance_notes);
  req.flash('success', 'Disease marked as resolved');
  res.redirect(`/patients/${req.params.id}`);
};

// ── API: GET /api/patients/:patientId/disease-history ────────────────────────
exports.apiIndex = async (req, res) => {
  const { PatientDiseaseHistory, Patient } = require('../models');
  const history = await PatientDiseaseHistory.findAll({
    where: { patient_id: req.params.patientId },
    include: [{ model: Patient, as: 'patient', attributes: ['id', 'full_name'] }],
    order: [['detected_at', 'DESC']]
  });
  res.json({ success: true, data: history });
};

// ── API: GET /api/patients/:patientId/disease-history/active ─────────────────
exports.apiActive = async (req, res) => {
  const { PatientDiseaseHistory } = require('../models');
  const active = await PatientDiseaseHistory.findAll({
    where: { patient_id: req.params.patientId, status: 'ACTIVE' },
    order: [['detected_at', 'DESC']]
  });
  res.json({ success: true, data: active });
};

// ── API: GET /api/patients/:patientId/disease-history/summary ────────────────
exports.apiSummary = async (req, res) => {
  const summary = await diseaseService.getDiseaseSummary(req.params.patientId);
  res.json({ success: true, data: summary });
};

// ── API: POST /api/patients/:patientId/disease-history ───────────────────────
exports.apiCreate = async (req, res) => {
  const entry = await diseaseService.recordDiseaseManually(req.params.patientId, req.body);
  res.json({ success: true, message: 'Disease recorded successfully', data: entry });
};

// ── API: POST /api/patients/:patientId/disease-history/auto-record ────────────
exports.apiAutoRecord = async (req, res) => {
  const recorded = await diseaseService.autoRecordFromMatches(req.params.patientId);
  res.json({ success: true, message: `Recorded ${recorded.length} disease(s)`, data: recorded });
};

// ── API: POST /api/patients/:patientId/disease-history/:historyId/clear ──────
exports.apiClear = async (req, res) => {
  const entry = await diseaseService.clearDisease(req.params.historyId, req.body.clearanceNotes);
  res.json({ success: true, message: 'Disease cleared successfully', data: entry });
};

// ── API: PUT /api/patients/:patientId/disease-history/:historyId/status ───────
exports.apiUpdateStatus = async (req, res) => {
  const { status, notes } = req.body;
  const entry = await diseaseService.updateDiseaseStatus(req.params.historyId, status, notes);
  res.json({ success: true, message: 'Status updated successfully', data: entry });
};

// ── API: GET /api/patients/:patientId/disease-history/available-diseases ──────
exports.apiAvailableDiseases = async (req, res) => {
  const diseases = diseaseService.getAllDiseases();
  res.json({ success: true, data: diseases });
};
