const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const PatientDiseaseHistory = sequelize.define('PatientDiseaseHistory', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true
  },
  patient_id: {
    type: DataTypes.BIGINT,
    allowNull: false
  },
  disease_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  disease_name: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  possible_causes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('ACTIVE', 'RESOLVED', 'MONITORING'),
    defaultValue: 'ACTIVE'
  },
  detection_confidence: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: true
  },
  detected_temperature: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: true
  },
  detected_heart_rate: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  detected_spo2: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  observed_symptoms: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  doctor_notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  detected_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  cleared_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  clearance_notes: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: 'patient_disease_history',
  timestamps: false
});

module.exports = PatientDiseaseHistory;
