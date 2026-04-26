'use strict';
const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/AlertController');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

router.get ('/',          ctrl.index);
router.post('/read-all',  ctrl.markAllRead);
router.post('/:id/read',  ctrl.markRead);

module.exports = router;
