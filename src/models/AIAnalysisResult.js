const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const AIAnalysisResult = sequelize.define('AIAnalysisResult', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true
  },
  patient_id: {
    type: DataTypes.BIGINT,
    allowNull: false
  },
  vital_reading_id: {
    type: DataTypes.BIGINT,
    allowNull: true
  },
  possible_conditions: {
    type: DataTypes.JSON,
    allowNull: true
  },
  severity: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  recommendation: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  disclaimer: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  analyzed_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'ai_analysis_results',
  timestamps: false
});

module.exports = AIAnalysisResult;
