'use strict';
const { HealthAlert, Patient } = require('../models');
const { Op } = require('sequelize');

class AlertService {
  async getAlerts(doctorId, { page = 1, limit = 20, unreadOnly = false } = {}) {
    const where = unreadOnly ? { is_read: false } : {};
    const { count, rows } = await HealthAlert.findAndCountAll({
      where,
      include: [{
        model: Patient,
        as: 'patient',
        where: { doctor_id: doctorId },
        attributes: ['id', 'full_name']
      }],
      order: [['created_at', 'DESC']],
      limit,
      offset: (page - 1) * limit
    });
    return { alerts: rows, total: count, page, pages: Math.ceil(count / limit) };
  }

  async getUnreadAlerts(doctorId) {
    return HealthAlert.findAll({
      where: { is_read: false },
      include: [{ model: Patient, as: 'patient', where: { doctor_id: doctorId }, attributes: ['id', 'full_name'] }],
      order: [['created_at', 'DESC']]
    });
  }

  async getUnreadCount(doctorId) {
    return HealthAlert.count({
      where: { is_read: false },
      include: [{ model: Patient, as: 'patient', where: { doctor_id: doctorId } }]
    });
  }

  async getPatientAlerts(patientId) {
    return HealthAlert.findAll({
      where: { patient_id: patientId },
      order: [['created_at', 'DESC']],
      limit: 50
    });
  }

  async markAsRead(alertId) {
    return HealthAlert.update({ is_read: true }, { where: { id: alertId } });
  }

  async markAllAsRead(doctorId) {
    await HealthAlert.update(
      { is_read: true },
      {
        where: { is_read: false },
        include: [{ model: Patient, as: 'patient', where: { doctor_id: doctorId } }]
      }
    );
    // Fallback: direct subquery approach
    const { sequelize } = require('../models');
    await sequelize.query(
      `UPDATE health_alerts ha
       JOIN patients p ON ha.patient_id = p.id
       SET ha.is_read = TRUE
       WHERE p.doctor_id = :doctorId AND ha.is_read = FALSE`,
      { replacements: { doctorId }, type: sequelize.QueryTypes.UPDATE }
    );
  }
}

module.exports = new AlertService();
