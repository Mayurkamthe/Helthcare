'use strict';
const alertService = require('../services/alertService');

// ── Web: GET /alerts ──────────────────────────────────────────────────────────
exports.index = async (req, res) => {
  const page   = parseInt(req.query.page || 1);
  const filter = req.query.filter || 'all';
  const { alerts, total, pages } = await alertService.getAlerts(
    req.session.doctorId,
    { page, limit: 20, unreadOnly: filter === 'unread' }
  );
  res.render('alerts/index', {
    title: 'Health Alerts',
    alerts, filter, currentPage: page, totalPages: pages,
    success: req.flash('success'), error: req.flash('error')
  });
};

// ── Web: POST /alerts/read-all ────────────────────────────────────────────────
exports.markAllRead = async (req, res) => {
  await alertService.markAllAsRead(req.session.doctorId);
  req.flash('success', 'All alerts marked as read');
  res.redirect('/alerts');
};

// ── Web/API: POST /alerts/:id/read ────────────────────────────────────────────
exports.markRead = async (req, res) => {
  await alertService.markAsRead(req.params.id);
  if (req.headers.accept && req.headers.accept.includes('application/json')) {
    return res.json({ success: true });
  }
  res.redirect('/alerts');
};

// ── API: GET /api/alerts ──────────────────────────────────────────────────────
exports.apiIndex = async (req, res) => {
  const page = parseInt(req.query.page || 0) + 1; // Java uses 0-based paging
  const size = parseInt(req.query.size || 20);
  const result = await alertService.getAlerts(req.doctorId, { page, limit: size });
  res.json({ success: true, data: result });
};

// ── API: GET /api/alerts/unread ───────────────────────────────────────────────
exports.apiUnread = async (req, res) => {
  const alerts = await alertService.getUnreadAlerts(req.doctorId);
  res.json({ success: true, data: alerts });
};

// ── API: GET /api/alerts/unread/count ────────────────────────────────────────
exports.apiUnreadCount = async (req, res) => {
  const count = await alertService.getUnreadCount(req.doctorId);
  res.json({ success: true, data: { count } });
};

// ── API: PUT /api/alerts/:id/read ────────────────────────────────────────────
exports.apiMarkRead = async (req, res) => {
  await alertService.markAsRead(req.params.id);
  res.json({ success: true, message: 'Alert marked as read', data: null });
};

// ── API: PUT /api/alerts/read-all ────────────────────────────────────────────
exports.apiMarkAllRead = async (req, res) => {
  await alertService.markAllAsRead(req.doctorId);
  res.json({ success: true, message: 'All alerts marked as read', data: null });
};

// ── API: GET /api/alerts/patient/:patientId ───────────────────────────────────
exports.apiPatientAlerts = async (req, res) => {
  const alerts = await alertService.getPatientAlerts(req.params.patientId);
  res.json({ success: true, data: alerts });
};
