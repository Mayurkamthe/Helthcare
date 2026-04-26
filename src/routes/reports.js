'use strict';
const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/ReportController');
const { requireAuth } = require('../middleware/auth');

router.get('/patient/:id', requireAuth, ctrl.patientReport);

module.exports = router;
