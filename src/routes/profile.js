const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');

// GET /profile
router.get('/', requireAuth, async (req, res) => {
  const [[doctor]] = await db.query('SELECT * FROM doctors WHERE id = ?', [req.session.doctorId]);
  res.render('dashboard/profile', {
    title: 'My Profile',
    doctor,
    success: req.flash('success'),
    error: req.flash('error')
  });
});

// POST /profile/update
router.post('/update', requireAuth, [
  body('full_name').notEmpty().withMessage('Full name required'),
  body('email').isEmail().withMessage('Valid email required')
], async (req, res) => {
  const errors = validationResult(req);
  const [[doctor]] = await db.query('SELECT * FROM doctors WHERE id = ?', [req.session.doctorId]);

  if (!errors.isEmpty()) {
    return res.render('dashboard/profile', {
      title: 'My Profile',
      doctor: { ...doctor, ...req.body },
      success: [],
      error: errors.array().map(e => e.msg)
    });
  }

  const { full_name, email, specialization, license_number, phone_number } = req.body;
  await db.query(
    'UPDATE doctors SET full_name=?, email=?, specialization=?, license_number=?, phone_number=? WHERE id=?',
    [full_name, email, specialization || null, license_number || null, phone_number || null, req.session.doctorId]
  );
  req.flash('success', 'Profile updated successfully');
  res.redirect('/profile');
});

// POST /profile/change-password
router.post('/change-password', requireAuth, [
  body('current_password').notEmpty().withMessage('Current password required'),
  body('new_password').isLength({ min: 6 }).withMessage('New password must be at least 6 characters'),
], async (req, res) => {
  const errors = validationResult(req);
  const [[doctor]] = await db.query('SELECT * FROM doctors WHERE id = ?', [req.session.doctorId]);

  if (!errors.isEmpty()) {
    return res.render('dashboard/profile', {
      title: 'My Profile',
      doctor,
      success: [],
      error: errors.array().map(e => e.msg)
    });
  }

  const { current_password, new_password } = req.body;
  const valid = await bcrypt.compare(current_password, doctor.password);
  if (!valid) {
    return res.render('dashboard/profile', { title: 'My Profile', doctor, success: [], error: ['Current password is incorrect'] });
  }

  const hash = await bcrypt.hash(new_password, 10);
  await db.query('UPDATE doctors SET password=? WHERE id=?', [hash, req.session.doctorId]);
  req.flash('success', 'Password changed successfully');
  res.redirect('/profile');
});

module.exports = router;
