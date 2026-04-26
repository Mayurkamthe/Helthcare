'use strict';
const jwt = require('jsonwebtoken');
const { Doctor, Patient, HealthAlert } = require('../models');
const { Op } = require('sequelize');

// ── Session auth (web) ────────────────────────────────────────────────────────
const requireAuth = (req, res, next) => {
  if (req.session && req.session.doctorId) return next();
  req.flash('error', 'Please log in to continue');
  res.redirect('/auth/login');
};

// ── JWT auth (REST API) ───────────────────────────────────────────────────────
const requireJwt = (req, res, next) => {
  const header = req.headers['authorization'];
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Authorization header missing' });
  }
  try {
    const decoded = jwt.verify(header.slice(7), process.env.JWT_SECRET);
    req.doctorId = decoded.id;
    return next();
  } catch (e) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
};

// ── API-key auth (IoT devices) ────────────────────────────────────────────────
const requireApiKey = (req, res, next) => {
  const key = req.headers['x-api-key'];
  if (key && key === process.env.IOT_API_KEY) return next();
  // Also accept JWT as fallback
  const header = req.headers['authorization'];
  if (header && header.startsWith('Bearer ')) {
    try {
      jwt.verify(header.slice(7), process.env.JWT_SECRET);
      return next();
    } catch (_) {}
  }
  return res.status(401).json({ success: false, message: 'Invalid API key' });
};

// ── Inject doctor + unread-count into all views ───────────────────────────────
const loadDoctor = async (req, res, next) => {
  res.locals.currentDoctor = null;
  res.locals.unreadAlerts  = 0;
  if (req.session && req.session.doctorId) {
    try {
      const doctor = await Doctor.findByPk(req.session.doctorId, {
        attributes: ['id', 'email', 'full_name', 'specialization', 'license_number', 'phone_number']
      });
      if (doctor) {
        res.locals.currentDoctor = doctor.toJSON();
        // Unread alerts count across all doctor's patients
        const { sequelize } = require('../models');
        const [[row]] = await sequelize.query(
          `SELECT COUNT(*) AS cnt FROM health_alerts ha
           JOIN patients p ON ha.patient_id = p.id
           WHERE p.doctor_id = :doctorId AND ha.is_read = 0`,
          { replacements: { doctorId: doctor.id } }
        );
        res.locals.unreadAlerts = row.cnt || 0;
      }
    } catch (e) {
      console.error('loadDoctor error:', e.message);
    }
  }
  next();
};

// ── Async error wrapper ───────────────────────────────────────────────────────
const asyncWrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

module.exports = { requireAuth, requireJwt, requireApiKey, loadDoctor, asyncWrap };
