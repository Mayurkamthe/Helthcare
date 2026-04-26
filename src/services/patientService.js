'use strict';
const { Op } = require('sequelize');
const { Patient, VitalReading, HealthAlert, PatientDiseaseHistory } = require('../models');

class PatientService {
  async getAllPatients(doctorId, search = '') {
    const where = { doctor_id: doctorId };
    if (search) {
      where[Op.or] = [
        { full_name:    { [Op.like]: `%${search}%` } },
        { phone_number: { [Op.like]: `%${search}%` } }
      ];
    }
    return Patient.findAll({ where, order: [['full_name', 'ASC']] });
  }

  async getPatientById(patientId, doctorId) {
    const p = await Patient.findOne({ where: { id: patientId, doctor_id: doctorId } });
    if (!p) throw new Error('Patient not found');
    return p;
  }

  async createPatient(doctorId, data) {
    return Patient.create({ ...data, doctor_id: doctorId });
  }

  async updatePatient(patientId, doctorId, data) {
    const p = await this.getPatientById(patientId, doctorId);
    return p.update(data);
  }

  async deletePatient(patientId, doctorId) {
    const p = await this.getPatientById(patientId, doctorId);
    await p.destroy();
  }

  async assignDevice(patientId, doctorId, deviceId, durationSeconds = null) {
    const p = await this.getPatientById(patientId, doctorId);
    const expiresAt = durationSeconds ? new Date(Date.now() + durationSeconds * 1000) : null;
    return p.update({ device_id: deviceId, device_assigned_at: new Date(), device_expires_at: expiresAt });
  }

  async unassignDevice(patientId, doctorId) {
    const p = await this.getPatientById(patientId, doctorId);
    return p.update({ device_id: null, device_assigned_at: null, device_expires_at: null });
  }

  async findActivePatientForDevice(deviceId) {
    return Patient.findOne({
      where: {
        device_id: deviceId,
        [Op.or]: [
          { device_expires_at: null },
          { device_expires_at: { [Op.gt]: new Date() } }
        ]
      }
    });
  }

  /** Fetch patient with all related data for the detail page */
  async getPatientDetail(patientId, doctorId) {
    const patient = await this.getPatientById(patientId, doctorId);
    const [vitals, alerts, diseases, analyses] = await Promise.all([
      VitalReading.findAll({ where: { patient_id: patientId }, order: [['recorded_at', 'DESC']], limit: 20 }),
      HealthAlert.findAll({ where: { patient_id: patientId }, order: [['created_at', 'DESC']], limit: 15 }),
      PatientDiseaseHistory.findAll({ where: { patient_id: patientId }, order: [['detected_at', 'DESC']] }),
      require('./aiAnalysisService').getPatientAnalyses(patientId)
    ]);
    return { patient, vitals, alerts, diseases, analyses };
  }
}

module.exports = new PatientService();
