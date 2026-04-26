'use strict';
const { Op } = require('sequelize');
const { VitalReading, Patient, HealthAlert, AIAnalysisResult } = require('../models');
const diseaseService = require('./diseaseService');

// ── Alert threshold constants (matching Java VitalService) ────────────────────
const THRESHOLDS = {
  HR_HIGH: 100,    // bpm
  HR_LOW:  50,
  SPO2_LOW: 95,    // %
  TEMP_HIGH: 38.0, // °C
  TEMP_LOW:  35.0
};

class VitalService {

  /** Process vital data from an IoT device – core IoT ingestion method */
  async processIoTVitals({ deviceId, heartRate, spo2, temperature }) {
    // 1. Find active patient for device
    const patient = await Patient.findOne({
      where: {
        device_id: deviceId,
        [Op.or]: [
          { device_expires_at: null },
          { device_expires_at: { [Op.gt]: new Date() } }
        ]
      }
    });
    if (!patient) throw new Error(`No active patient assigned to device ${deviceId}`);

    // 2. Save reading
    const reading = await VitalReading.create({
      patient_id: patient.id,
      device_id: deviceId,
      heart_rate: heartRate,
      spo2,
      temperature
    });

    // 3. Generate threshold alerts
    const alerts = await this._generateAlerts(patient, { heartRate, spo2, temperature });

    // 4. Run disease matching & store AI analysis
    const matches = diseaseService.matchDiseases({ heartRate, spo2, temperature: parseFloat(temperature) });
    let analysis = null;
    if (matches.length > 0) {
      const severity = this._computeSeverity(matches);
      const recommendations = matches.flatMap(m => m.disease.recommendations).slice(0, 3);
      analysis = await AIAnalysisResult.create({
        patient_id: patient.id,
        vital_reading_id: reading.id,
        possible_conditions: matches.map(m => m.disease.name),
        severity,
        recommendation: recommendations.join(' | '),
        disclaimer: 'AI-based suggestions only. Clinical diagnosis requires professional evaluation.'
      });
    }

    return { reading, patient, alerts, diseaseMatches: matches, analysis };
  }

  /** Check whether a device currently has an active patient */
  async isDeviceActive(deviceId) {
    const count = await Patient.count({
      where: {
        device_id: deviceId,
        [Op.or]: [
          { device_expires_at: null },
          { device_expires_at: { [Op.gt]: new Date() } }
        ]
      }
    });
    return count > 0;
  }

  /** Get paginated vital history for a patient */
  async getVitalHistory(patientId, { page = 1, limit = 20 } = {}) {
    const offset = (page - 1) * limit;
    const { count, rows } = await VitalReading.findAndCountAll({
      where: { patient_id: patientId },
      order: [['recorded_at', 'DESC']],
      limit,
      offset
    });
    return { readings: rows, total: count, page, limit, pages: Math.ceil(count / limit) };
  }

  /** Latest single reading */
  async getLatestVitals(patientId) {
    return VitalReading.findOne({
      where: { patient_id: patientId },
      order: [['recorded_at', 'DESC']]
    });
  }

  /** Last 10 readings */
  async getRecentVitals(patientId) {
    return VitalReading.findAll({
      where: { patient_id: patientId },
      order: [['recorded_at', 'DESC']],
      limit: 10
    });
  }

  /** Readings within a date range */
  async getVitalsByDateRange(patientId, start, end) {
    return VitalReading.findAll({
      where: {
        patient_id: patientId,
        recorded_at: { [Op.between]: [start, end] }
      },
      order: [['recorded_at', 'ASC']]
    });
  }

  /** Manual vital entry (no device) */
  async addManualReading(patientId, { heart_rate, spo2, temperature }) {
    return VitalReading.create({
      patient_id: patientId,
      device_id: 'MANUAL',
      heart_rate: heart_rate || null,
      spo2: spo2 || null,
      temperature: temperature || null
    });
  }

  // ── Private ──────────────────────────────────────────────────────────────────

  async _generateAlerts(patient, { heartRate, spo2, temperature }) {
    const created = [];
    const checks = [
      [heartRate > THRESHOLDS.HR_HIGH,   `High heart rate: ${heartRate} bpm`],
      [heartRate < THRESHOLDS.HR_LOW,    `Low heart rate: ${heartRate} bpm`],
      [spo2 < THRESHOLDS.SPO2_LOW,       `Low SpO2: ${spo2}%`],
      [parseFloat(temperature) >= THRESHOLDS.TEMP_HIGH, `High temperature: ${temperature}°C`],
      [parseFloat(temperature) < THRESHOLDS.TEMP_LOW,   `Low temperature: ${temperature}°C`]
    ];
    for (const [condition, msg] of checks) {
      if (condition) {
        const alert = await HealthAlert.create({
          patient_id: patient.id,
          alert_type: 'VITAL_ABNORMAL',
          message: `${patient.full_name}: ${msg}`
        });
        created.push(alert);
      }
    }
    return created;
  }

  _computeSeverity(matches) {
    const maxConf = Math.max(...matches.map(m => m.confidence));
    if (maxConf >= 0.85) return 'CRITICAL';
    if (maxConf >= 0.65) return 'WARNING';
    return 'INFO';
  }
}

module.exports = new VitalService();
