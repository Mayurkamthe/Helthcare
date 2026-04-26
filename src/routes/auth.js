'use strict';
const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/AuthController');

// Web routes
router.get ('/login',    ctrl.showLogin);
router.post('/login',    ctrl.loginRules,    ctrl.login);
router.get ('/register', ctrl.showRegister);
router.post('/register', ctrl.registerRules, ctrl.register);
router.post('/logout',   ctrl.logout);

module.exports = router;
