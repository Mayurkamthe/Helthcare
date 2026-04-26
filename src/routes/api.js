'use strict';
const express  = require('express');
const router   = express.Router();
const { requireJwt, requireApiKey } = require('../middleware/auth');

const authCtrl    = require('../controllers/AuthController');
const patientCtrl = require('../controllers/PatientController');
const vitalCtrl   = require('../controllers/VitalController');
const alertCtrl   = require('../controllers/AlertController');
const diseaseCtrl = require('../controllers/DiseaseHistoryController');
const aiCtrl      = require('../controllers/AIAnalysisController');

// ── Public auth ───────────────────────────────────────────────────────────────
router.post('/auth/login',    authCtrl.apiLogin);
router.post('/auth/register', authCtrl.apiRegister);
router.get ('/auth/me',       requireJwt, authCtrl.apiMe);

// ── IoT device endpoints (API-key auth) ───────────────────────────────────────
router.post('/iot/vitals',                  requireApiKey, vitalCtrl.receiveIoTVitals);
router.get ('/iot/device-status/:deviceId',               vitalCtrl.checkDeviceStatus);

// ── Patient endpoints (JWT auth) ──────────────────────────────────────────────
router.get   ('/patients',                              requireJwt, patientCtrl.apiIndex);
router.post  ('/patients',                              requireJwt, patientCtrl.apiCreate);
router.get   ('/patients/device/:deviceId/active-patient', requireJwt, patientCtrl.apiActivePatientForDevice);
router.get   ('/patients/:id',                          requireJwt, patientCtrl.apiShow);
router.put   ('/patients/:id',                          requireJwt, patientCtrl.apiUpdate);
router.delete('/patients/:id',                          requireJwt, patientCtrl.apiDestroy);
router.post  ('/patients/:id/device/assign',            requireJwt, patientCtrl.apiAssignDevice);
router.post  ('/patients/:id/device/unassign',          requireJwt, patientCtrl.apiUnassignDevice);
router.get   ('/patients/:id/disease-matches',          requireJwt, patientCtrl.apiDiseaseMatches);

// ── Vital endpoints ───────────────────────────────────────────────────────────
router.get('/patients/:patientId/vitals',         requireJwt, vitalCtrl.apiGetVitalHistory);
router.get('/patients/:patientId/vitals/latest',  requireJwt, vitalCtrl.apiGetLatestVitals);
router.get('/patients/:patientId/vitals/recent',  requireJwt, vitalCtrl.apiGetRecentVitals);
router.get('/patients/:patientId/vitals/range',   requireJwt, vitalCtrl.apiGetVitalsByRange);

// ── Alert endpoints ───────────────────────────────────────────────────────────
router.get('/alerts',               requireJwt, alertCtrl.apiIndex);
router.get('/alerts/unread',        requireJwt, alertCtrl.apiUnread);
router.get('/alerts/unread/count',  requireJwt, alertCtrl.apiUnreadCount);
router.put('/alerts/read-all',      requireJwt, alertCtrl.apiMarkAllRead);
router.put('/alerts/:id/read',      requireJwt, alertCtrl.apiMarkRead);
router.get('/alerts/patient/:patientId', requireJwt, alertCtrl.apiPatientAlerts);

// ── Disease history endpoints ─────────────────────────────────────────────────
router.get ('/patients/:patientId/disease-history',                    requireJwt, diseaseCtrl.apiIndex);
router.post('/patients/:patientId/disease-history',                    requireJwt, diseaseCtrl.apiCreate);
router.get ('/patients/:patientId/disease-history/active',             requireJwt, diseaseCtrl.apiActive);
router.get ('/patients/:patientId/disease-history/summary',            requireJwt, diseaseCtrl.apiSummary);
router.post('/patients/:patientId/disease-history/auto-record',        requireJwt, diseaseCtrl.apiAutoRecord);
router.post('/patients/:patientId/disease-history/:historyId/clear',   requireJwt, diseaseCtrl.apiClear);
router.put ('/patients/:patientId/disease-history/:historyId/status',  requireJwt, diseaseCtrl.apiUpdateStatus);
router.get ('/patients/:patientId/disease-history/available-diseases', requireJwt, diseaseCtrl.apiAvailableDiseases);

// ── AI Analysis endpoints ─────────────────────────────────────────────────────
router.get ('/patients/:patientId/ai-analysis',         requireJwt, aiCtrl.apiIndex);
router.get ('/patients/:patientId/ai-analysis/latest',  requireJwt, aiCtrl.apiLatest);
router.post('/patients/:patientId/ai-analysis/trigger', requireJwt, aiCtrl.apiTrigger);

module.exports = router;
