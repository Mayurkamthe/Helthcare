'use strict';
const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/VitalController');
const { requireAuth, requireApiKey } = require('../middleware/auth');

// ── IoT Device endpoints (API-key authenticated) ──────────────────────────────
router.post('/api/iot/vitals',                  requireApiKey, ctrl.receiveIoTVitals);
router.get ('/api/iot/device-status/:deviceId',               ctrl.checkDeviceStatus);

// ── Web views (session authenticated) ────────────────────────────────────────
router.get ('/patients/:patientId/vitals',  requireAuth, ctrl.webVitalHistory);
router.post('/patients/:patientId/vitals',  requireAuth, ctrl.webAddManualVital);

// ── JSON endpoint for live chart (session) ────────────────────────────────────
router.get ('/api/patients/:patientId/vitals', requireAuth, ctrl.webApiVitals);

module.exports = router;
