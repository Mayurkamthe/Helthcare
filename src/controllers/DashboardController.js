'use strict';
const { Patient, VitalReading, HealthAlert, Doctor } = require('../models');
const { Op } = require('sequelize');

exports.index = async (req, res) => {
  const doctorId = req.session.doctorId;

  const [totalPatients, activeDevices, alerts, recentVitals, patients] = await Promise.all([
    Patient.count({ where: { doctor_id: doctorId } }),
    Patient.count({ where: { doctor_id: doctorId, device_id: { [Op.ne]: null } } }),
    HealthAlert.findAll({
      include: [{ model: Patient, as: 'patient', where: { doctor_id: doctorId }, attributes: ['id', 'full_name'] }],
      order: [['created_at', 'DESC']],
      limit: 5
    }),
    VitalReading.findAll({
      include: [{ model: Patient, as: 'patient', where: { doctor_id: doctorId }, attributes: ['id', 'full_name'] }],
      order: [['recorded_at', 'DESC']],
      limit: 10
    }),
    Patient.findAll({ where: { doctor_id: doctorId }, order: [['full_name', 'ASC']], limit: 10 })
  ]);

  // Attach latest vital to each patient for dashboard table
  const enrichedPatients = await Promise.all(patients.map(async p => {
    const v = await VitalReading.findOne({ where: { patient_id: p.id }, order: [['recorded_at', 'DESC']] });
    return { ...p.toJSON(), latest: v };
  }));

  res.render('dashboard/index', {
    title: 'Dashboard',
    totalPatients,
    activeDevices,
    unreadAlertsCount: alerts.filter(a => !a.is_read).length,
    alerts,
    recentVitals,
    patients: enrichedPatients,
    success: req.flash('success'),
    error:   req.flash('error')
  });
};
