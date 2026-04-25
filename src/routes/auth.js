const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const db = require('../config/db');

// GET /auth/login
router.get('/login', (req, res) => {
  if (req.session.doctorId) return res.redirect('/dashboard');
  res.render('auth/login', { title: 'Login', error: req.flash('error'), success: req.flash('success') });
});

// POST /auth/login
router.post('/login', [
  body('email').isEmail().withMessage('Valid email required'),
  body('password').notEmpty().withMessage('Password required')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.render('auth/login', {
      title: 'Login',
      error: errors.array().map(e => e.msg),
      success: [],
      values: req.body
    });
  }

  const { email, password } = req.body;
  try {
    const [rows] = await db.query('SELECT * FROM doctors WHERE email = ?', [email.toLowerCase()]);
    if (rows.length === 0 || !(await bcrypt.compare(password, rows[0].password))) {
      return res.render('auth/login', {
        title: 'Login',
        error: ['Invalid email or password'],
        success: [],
        values: req.body
      });
    }
    req.session.doctorId = rows[0].id;
    req.flash('success', `Welcome back, ${rows[0].full_name}`);
    res.redirect('/dashboard');
  } catch (e) {
    res.render('auth/login', { title: 'Login', error: ['Server error, try again'], success: [], values: req.body });
  }
});

// GET /auth/register
router.get('/register', (req, res) => {
  if (req.session.doctorId) return res.redirect('/dashboard');
  res.render('auth/register', { title: 'Register', error: req.flash('error'), success: [], values: {} });
});

// POST /auth/register
router.post('/register', [
  body('email').isEmail().withMessage('Valid email required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('full_name').notEmpty().withMessage('Full name required'),
  body('specialization').notEmpty().withMessage('Specialization required')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.render('auth/register', {
      title: 'Register',
      error: errors.array().map(e => e.msg),
      success: [],
      values: req.body
    });
  }

  const { email, password, full_name, specialization, license_number, phone_number } = req.body;
  try {
    const [existing] = await db.query('SELECT id FROM doctors WHERE email = ?', [email.toLowerCase()]);
    if (existing.length > 0) {
      return res.render('auth/register', {
        title: 'Register',
        error: ['Email already registered'],
        success: [],
        values: req.body
      });
    }

    const hash = await bcrypt.hash(password, 10);
    const [result] = await db.query(
      `INSERT INTO doctors (email, password, full_name, specialization, license_number, phone_number)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [email.toLowerCase(), hash, full_name, specialization, license_number || null, phone_number || null]
    );

    req.session.doctorId = result.insertId;
    req.flash('success', 'Account created successfully');
    res.redirect('/dashboard');
  } catch (e) {
    res.render('auth/register', { title: 'Register', error: ['Server error'], success: [], values: req.body });
  }
});

// POST /auth/logout
router.post('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/auth/login');
});

module.exports = router;
