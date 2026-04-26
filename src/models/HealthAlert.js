const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const HealthAlert = sequelize.define('HealthAlert', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true
  },
  patient_id: {
    type: DataTypes.BIGINT,
    allowNull: false
  },
  alert_type: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  is_read: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  }
}, {
  tableName: 'health_alerts',
  updatedAt: false,
  indexes: [{ fields: ['patient_id', 'is_read'] }]
});

module.exports = HealthAlert;
