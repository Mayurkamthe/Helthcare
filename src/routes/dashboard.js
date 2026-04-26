'use strict';
const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/DashboardController');
const { requireAuth } = require('../middleware/auth');

router.get('/', requireAuth, ctrl.index);

module.exports = router;
