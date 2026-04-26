'use strict';
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { Doctor } = require('../models');

// ── Validation rules ──────────────────────────────────────────────────────────
exports.registerRules = [
  body('email').isEmail().withMessage('Valid email required').normalizeEmail(),
  body('password').isLength({ min: 6 }).withMessage('Password min 6 chars'),
  body('full_name').notEmpty().withMessage('Full name required'),
  body('specialization').notEmpty().withMessage('Specialization required')
];

exports.loginRules = [
  body('email').isEmail().withMessage('Valid email required').normalizeEmail(),
  body('password').notEmpty().withMessage('Password required')
];

// ── Web: GET /auth/login ──────────────────────────────────────────────────────
exports.showLogin = (req, res) => {
  if (req.session.doctorId) return res.redirect('/dashboard');
  res.render('auth/login', { title: 'Login', error: req.flash('error'), success: req.flash('success'), values: {} });
};

// ── Web: POST /auth/login ─────────────────────────────────────────────────────
exports.login = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.render('auth/login', { title: 'Login', error: errors.array().map(e => e.msg), success: [], values: req.body });
  }
  const { email, password } = req.body;
  const doctor = await Doctor.findOne({ where: { email } });
  if (!doctor || !(await bcrypt.compare(password, doctor.password))) {
    return res.render('auth/login', { title: 'Login', error: ['Invalid email or password'], success: [], values: req.body });
  }
  req.session.doctorId = doctor.id;
  req.flash('success', `Welcome back, ${doctor.full_name}`);
  res.redirect('/dashboard');
};

// ── Web: GET /auth/register ───────────────────────────────────────────────────
exports.showRegister = (req, res) => {
  if (req.session.doctorId) return res.redirect('/dashboard');
  res.render('auth/register', { title: 'Register', error: [], success: [], values: {} });
};

// ── Web: POST /auth/register ──────────────────────────────────────────────────
exports.register = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.render('auth/register', { title: 'Register', error: errors.array().map(e => e.msg), success: [], values: req.body });
  }
  const { email, password, full_name, specialization, license_number, phone_number } = req.body;
  const exists = await Doctor.findOne({ where: { email } });
  if (exists) {
    return res.render('auth/register', { title: 'Register', error: ['Email already registered'], success: [], values: req.body });
  }
  const hash = await bcrypt.hash(password, 10);
  const doc = await Doctor.create({ email, password: hash, full_name, specialization, license_number, phone_number });
  req.session.doctorId = doc.id;
  req.flash('success', 'Account created. Welcome!');
  res.redirect('/dashboard');
};

// ── Web: POST /auth/logout ────────────────────────────────────────────────────
exports.logout = (req, res) => {
  req.session.destroy();
  res.redirect('/auth/login');
};

// ── API: POST /api/auth/login (JWT for mobile / IoT clients) ─────────────────
exports.apiLogin = async (req, res) => {
  const { email, password } = req.body;
  const doctor = await Doctor.findOne({ where: { email } });
  if (!doctor || !(await bcrypt.compare(password, doctor.password))) {
    return res.status(401).json({ success: false, message: 'Invalid email or password' });
  }
  const token = jwt.sign({ id: doctor.id, email: doctor.email }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
  res.json({ success: true, message: 'Login successful', data: { token, tokenType: 'Bearer', doctor: _toDto(doctor) } });
};

// ── API: POST /api/auth/register ──────────────────────────────────────────────
exports.apiRegister = async (req, res) => {
  const { email, password, full_name, specialization, license_number, phone_number } = req.body;
  if (!email || !password || !full_name) return res.status(400).json({ success: false, message: 'email, password, full_name required' });
  const exists = await Doctor.findOne({ where: { email } });
  if (exists) return res.status(409).json({ success: false, message: 'Email already registered' });
  const hash = await bcrypt.hash(password, 10);
  const doc = await Doctor.create({ email, password: hash, full_name, specialization, license_number, phone_number });
  const token = jwt.sign({ id: doc.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
  res.json({ success: true, message: 'Registration successful', data: { token, doctor: _toDto(doc) } });
};

// ── API: GET /api/auth/me ─────────────────────────────────────────────────────
exports.apiMe = async (req, res) => {
  const doc = await Doctor.findByPk(req.doctorId, { attributes: { exclude: ['password'] } });
  if (!doc) return res.status(404).json({ success: false, message: 'Not found' });
  res.json({ success: true, data: _toDto(doc) });
};

function _toDto(doc) {
  return { id: doc.id, email: doc.email, fullName: doc.full_name, specialization: doc.specialization, licenseNumber: doc.license_number, phoneNumber: doc.phone_number };
}
