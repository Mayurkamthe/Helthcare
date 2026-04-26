'use strict';
const { AIAnalysisResult, VitalReading } = require('../models');
const diseaseService = require('./diseaseService');

class AIAnalysisService {
  async getPatientAnalyses(patientId) {
    return AIAnalysisResult.findAll({
      where: { patient_id: patientId },
      order: [['analyzed_at', 'DESC']],
      limit: 10
    });
  }

  async getLatestAnalysis(patientId) {
    return AIAnalysisResult.findOne({
      where: { patient_id: patientId },
      order: [['analyzed_at', 'DESC']]
    });
  }

  /** Manually trigger AI analysis for a patient based on latest vitals */
  async triggerAnalysis(patientId) {
    const latest = await VitalReading.findOne({
      where: { patient_id: patientId },
      order: [['recorded_at', 'DESC']]
    });
    if (!latest) throw new Error('No vital readings found for patient');

    const matches = diseaseService.matchDiseases({
      heartRate:   latest.heart_rate,
      spo2:        latest.spo2,
      temperature: latest.temperature
    });

    const severity = matches.length > 0 ? this._computeSeverity(matches) : 'NORMAL';
    const recommendations = matches.flatMap(m => m.disease.recommendations).slice(0, 3);

    return AIAnalysisResult.create({
      patient_id: patientId,
      vital_reading_id: latest.id,
      possible_conditions: matches.map(m => m.disease.name),
      severity,
      recommendation: recommendations.length > 0 ? recommendations.join(' | ') : 'All vitals appear within normal range.',
      disclaimer: 'AI-based suggestions only. Clinical diagnosis requires professional evaluation.'
    });
  }

  _computeSeverity(matches) {
    const max = Math.max(...matches.map(m => m.confidence));
    if (max >= 0.85) return 'CRITICAL';
    if (max >= 0.65) return 'WARNING';
    return 'INFO';
  }
}

module.exports = new AIAnalysisService();
