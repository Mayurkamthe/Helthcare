const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Patient = sequelize.define('Patient', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true
  },
  doctor_id: {
    type: DataTypes.BIGINT,
    allowNull: false
  },
  full_name: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  date_of_birth: {
    type: DataTypes.DATEONLY,
    allowNull: true
  },
  gender: {
    type: DataTypes.STRING(20),
    allowNull: true
  },
  blood_type: {
    type: DataTypes.STRING(10),
    allowNull: true
  },
  phone_number: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  address: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  emergency_contact: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  medical_notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  device_id: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  device_assigned_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  device_expires_at: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'patients',
  indexes: [{ fields: ['device_id'] }]
});

module.exports = Patient;
