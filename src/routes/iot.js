'use strict';
const express = require('express');
const router  = express.Router();
const { requireAuth } = require('../middleware/auth');
const patientService = require('../services/patientService');

// Web live-monitor view
router.get('/patients/:id/live', requireAuth, async (req, res) => {
  const patient = await patientService.getPatientById(req.params.id, req.session.doctorId);
  res.render('iot/monitor', { title: `Live Monitor — ${patient.full_name}`, patient });
});

module.exports = router;
