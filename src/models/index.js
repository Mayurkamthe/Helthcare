const sequelize    = require('../config/database');
const Doctor       = require('./Doctor');
const Patient      = require('./Patient');
const VitalReading = require('./VitalReading');
const HealthAlert  = require('./HealthAlert');
const PatientDiseaseHistory = require('./PatientDiseaseHistory');
const AIAnalysisResult      = require('./AIAnalysisResult');

// ── Associations ─────────────────────────────────────────────────────────────

// Doctor → Patients
Doctor.hasMany(Patient, { foreignKey: 'doctor_id', as: 'patients', onDelete: 'CASCADE' });
Patient.belongsTo(Doctor, { foreignKey: 'doctor_id', as: 'doctor' });

// Patient → VitalReadings
Patient.hasMany(VitalReading, { foreignKey: 'patient_id', as: 'vitals', onDelete: 'CASCADE' });
VitalReading.belongsTo(Patient, { foreignKey: 'patient_id', as: 'patient' });

// Patient → HealthAlerts
Patient.hasMany(HealthAlert, { foreignKey: 'patient_id', as: 'alerts', onDelete: 'CASCADE' });
HealthAlert.belongsTo(Patient, { foreignKey: 'patient_id', as: 'patient' });

// Patient → DiseaseHistory
Patient.hasMany(PatientDiseaseHistory, { foreignKey: 'patient_id', as: 'diseaseHistory', onDelete: 'CASCADE' });
PatientDiseaseHistory.belongsTo(Patient, { foreignKey: 'patient_id', as: 'patient' });

// Patient → AIAnalysis
Patient.hasMany(AIAnalysisResult, { foreignKey: 'patient_id', as: 'analyses', onDelete: 'CASCADE' });
AIAnalysisResult.belongsTo(Patient, { foreignKey: 'patient_id', as: 'patient' });

// VitalReading → AIAnalysis
VitalReading.hasMany(AIAnalysisResult, { foreignKey: 'vital_reading_id', as: 'analyses', onDelete: 'SET NULL' });
AIAnalysisResult.belongsTo(VitalReading, { foreignKey: 'vital_reading_id', as: 'vitalReading' });

// ── Sync (alter: add missing columns, do NOT drop) ────────────────────────────
async function syncDatabase() {
  try {
    await sequelize.authenticate();
    console.log('[DB] Sequelize connected');
    await sequelize.sync({ alter: true });
    console.log('[DB] Models synced');
  } catch (err) {
    console.error('[DB] Sync error:', err.message);
  }
}

module.exports = {
  sequelize,
  syncDatabase,
  Doctor,
  Patient,
  VitalReading,
  HealthAlert,
  PatientDiseaseHistory,
  AIAnalysisResult
};
