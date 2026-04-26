'use strict';
const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/PatientController');
const dhCtrl  = require('../controllers/DiseaseHistoryController');
const { requireAuth } = require('../middleware/auth');

// All web routes require session auth
router.use(requireAuth);

// CRUD
router.get ('/',              ctrl.index);
router.get ('/new',           ctrl.newForm);
router.post('/',              ctrl.createRules, ctrl.create);
router.get ('/:id',           ctrl.show);
router.get ('/:id/edit',      ctrl.editForm);
router.post('/:id/edit',      ctrl.updateRules, ctrl.update);
router.post('/:id/delete',    ctrl.destroy);

// Device management
router.post('/:id/device/assign',   ctrl.assignDevice);
router.post('/:id/device/unassign', ctrl.unassignDevice);

// Disease history (web)
router.post('/:id/disease-history',           dhCtrl.create);
router.post('/:id/disease-history/:hid/clear', dhCtrl.clear);

module.exports = router;
