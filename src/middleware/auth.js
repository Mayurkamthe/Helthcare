const jwt = require('jsonwebtoken');
const db = require('../config/db');

// Session-based auth for web routes
const requireAuth = (req, res, next) => {
  if (req.session && req.session.doctorId) {
    return next();
  }
  req.flash('error', 'Please log in to continue');
  res.redirect('/auth/login');
};

// JWT-based auth for API routes (IoT devices)
const requireApiKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  if (apiKey && apiKey === process.env.IOT_API_KEY) {
    return next();
  }
  // Also allow JWT for API
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.doctorId = decoded.id;
      return next();
    } catch (e) {
      // ignore
    }
  }
  res.status(401).json({ success: false, message: 'Unauthorized' });
};

// Load current doctor into res.locals for views
const loadDoctor = async (req, res, next) => {
  res.locals.currentDoctor = null;
  res.locals.unreadAlerts = 0;
  if (req.session && req.session.doctorId) {
    try {
      const [rows] = await db.query(
        'SELECT id, email, full_name, specialization, license_number, phone_number FROM doctors WHERE id = ?',
        [req.session.doctorId]
      );
      if (rows.length > 0) {
        res.locals.currentDoctor = rows[0];
        // Count unread alerts
        const [alerts] = await db.query(
          `SELECT COUNT(*) as cnt FROM health_alerts ha
           JOIN patients p ON ha.patient_id = p.id
           WHERE p.doctor_id = ? AND ha.is_read = FALSE`,
          [req.session.doctorId]
        );
        res.locals.unreadAlerts = alerts[0].cnt;
      }
    } catch (e) {
      console.error('loadDoctor error:', e.message);
    }
  }
  next();
};

module.exports = { requireAuth, requireApiKey, loadDoctor };
