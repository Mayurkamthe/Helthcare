'use strict';
require('dotenv').config();
const express        = require('express');
const http           = require('http');
const { Server }     = require('socket.io');
const session        = require('express-session');
const flash          = require('connect-flash');
const cookieParser   = require('cookie-parser');
const morgan         = require('morgan');
const path           = require('path');
const methodOverride = require('method-override');

const { syncDatabase } = require('./models');
const { loadDoctor }   = require('./middleware/auth');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, { cors: { origin: '*' } });

// ── View engine ───────────────────────────────────────────────────────────────
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ── Core middleware ────────────────────────────────────────────────────────────
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(methodOverride('_method'));
app.use(express.static(path.join(__dirname, 'public')));

// ── Session ───────────────────────────────────────────────────────────────────
app.use(session({
  secret:            process.env.SESSION_SECRET || 'medico-secret',
  resave:            false,
  saveUninitialized: false,
  cookie: { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000 }
}));

// ── Flash + template globals ──────────────────────────────────────────────────
app.use(flash());
app.use(loadDoctor);
app.use((req, res, next) => { res.locals.path = req.path; next(); });

// ── Make io accessible in controllers ─────────────────────────────────────────
app.set('io', io);

// ── Web routes ─────────────────────────────────────────────────────────────────
app.use('/auth',     require('./routes/auth'));
app.use('/dashboard', require('./routes/dashboard'));
app.use('/patients', require('./routes/patients'));
app.use('/alerts',   require('./routes/alerts'));
app.use('/reports',  require('./routes/reports'));
app.use('/profile',  require('./routes/profile'));
app.use('/',         require('./routes/vitals'));   // /patients/:id/vitals + /api/iot/vitals
app.use('/',         require('./routes/iot'));       // /patients/:id/live

// ── REST API (JWT) ────────────────────────────────────────────────────────────
app.use('/api', require('./routes/api'));

// ── Root redirect ─────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.redirect(req.session.doctorId ? '/dashboard' : '/auth/login');
});

// ── Socket.IO rooms ───────────────────────────────────────────────────────────
io.on('connection', socket => {
  socket.on('join:patient', patientId => {
    socket.join(`patient:${patientId}`);
  });
  socket.on('join:doctor', doctorId => {
    socket.join(`doctor:${doctorId}`);
  });
});

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[ERROR]', err.message);
  if (req.path.startsWith('/api/')) {
    return res.status(500).json({ success: false, message: err.message });
  }
  req.flash('error', err.message || 'Something went wrong');
  res.redirect('back');
});

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
syncDatabase().then(() => {
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`\n  Medico running on http://localhost:${PORT}`);
    console.log(`  REST API:  http://localhost:${PORT}/api`);
    console.log(`  IoT POST:  http://localhost:${PORT}/api/iot/vitals`);
    console.log(`  Env: ${process.env.NODE_ENV || 'development'}\n`);
  });
});

module.exports = { app, server, io };
