'use strict';
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const { Doctor } = require('../models');

exports.updateRules = [
  body('full_name').notEmpty().withMessage('Full name required'),
  body('email').isEmail().withMessage('Valid email required')
];

exports.show = async (req, res) => {
  const doctor = await Doctor.findByPk(req.session.doctorId);
  res.render('dashboard/profile', {
    title: 'My Profile', doctor,
    success: req.flash('success'), error: req.flash('error')
  });
};

exports.update = async (req, res) => {
  const errors = validationResult(req);
  const doctor = await Doctor.findByPk(req.session.doctorId);
  if (!errors.isEmpty()) {
    return res.render('dashboard/profile', {
      title: 'My Profile', doctor: { ...doctor.toJSON(), ...req.body },
      success: [], error: errors.array().map(e => e.msg)
    });
  }
  const { full_name, email, specialization, license_number, phone_number } = req.body;
  await doctor.update({ full_name, email, specialization, license_number, phone_number });
  req.flash('success', 'Profile updated');
  res.redirect('/profile');
};

exports.changePassword = async (req, res) => {
  const doctor = await Doctor.findByPk(req.session.doctorId);
  const { current_password, new_password, confirm_password } = req.body;

  if (new_password !== confirm_password) {
    return res.render('dashboard/profile', { title: 'My Profile', doctor, success: [], error: ['Passwords do not match'] });
  }
  if (new_password.length < 6) {
    return res.render('dashboard/profile', { title: 'My Profile', doctor, success: [], error: ['Password must be at least 6 characters'] });
  }
  const valid = await bcrypt.compare(current_password, doctor.password);
  if (!valid) {
    return res.render('dashboard/profile', { title: 'My Profile', doctor, success: [], error: ['Current password is incorrect'] });
  }
  const hash = await bcrypt.hash(new_password, 10);
  await doctor.update({ password: hash });
  req.flash('success', 'Password changed successfully');
  res.redirect('/profile');
};
