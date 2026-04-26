const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const VitalReading = sequelize.define('VitalReading', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true
  },
  patient_id: {
    type: DataTypes.BIGINT,
    allowNull: false
  },
  device_id: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  heart_rate: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  spo2: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  temperature: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: true
  },
  recorded_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'vital_readings',
  timestamps: false,
  indexes: [{ fields: ['patient_id', 'recorded_at'] }]
});

module.exports = VitalReading;
