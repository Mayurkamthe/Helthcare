'use strict';
const aiService = require('../services/aiAnalysisService');

// ── API: GET /api/patients/:patientId/ai-analysis ────────────────────────────
exports.apiIndex = async (req, res) => {
  const analyses = await aiService.getPatientAnalyses(req.params.patientId);
  res.json({ success: true, data: analyses });
};

// ── API: GET /api/patients/:patientId/ai-analysis/latest ─────────────────────
exports.apiLatest = async (req, res) => {
  const analysis = await aiService.getLatestAnalysis(req.params.patientId);
  if (!analysis) return res.json({ success: false, message: 'No analysis found' });
  res.json({ success: true, data: analysis });
};

// ── API: POST /api/patients/:patientId/ai-analysis/trigger ───────────────────
exports.apiTrigger = async (req, res) => {
  const analysis = await aiService.triggerAnalysis(req.params.patientId);
  res.json({ success: true, message: 'AI analysis triggered successfully', data: analysis });
};
