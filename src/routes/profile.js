'use strict';
const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/ProfileController');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

router.get ('/',                ctrl.show);
router.post('/update',          ctrl.updateRules, ctrl.update);
router.post('/change-password', ctrl.changePassword);

module.exports = router;
