require('dotenv').config();
const express = require('express');
const session = require('express-session');
const flash = require('connect-flash');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const path = require('path');
const methodOverride = require('method-override');

const app = express();
const PORT = process.env.PORT || 3000;

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(methodOverride('_method'));
app.use(express.static(path.join(__dirname, 'public')));

// Sessions
app.use(session({
  secret: process.env.SESSION_SECRET || 'medico-session-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  }
}));

// Flash messages
app.use(flash());

// Load doctor into all views
const { loadDoctor } = require('./middleware/auth');
app.use(loadDoctor);

// Global template vars
app.use((req, res, next) => {
  res.locals.path = req.path;
  next();
});

// Routes
const authRouter = require('./routes/auth');
const dashboardRouter = require('./routes/dashboard');
const patientsRouter = require('./routes/patients');
const vitalsRouter = require('./routes/vitals');
const alertsRouter = require('./routes/alerts');
const reportsRouter = require('./routes/reports');
const profileRouter = require('./routes/profile');

app.use('/auth', authRouter);
app.use('/dashboard', dashboardRouter);
app.use('/patients', patientsRouter);
app.use('/', vitalsRouter);        // handles /patients/:id/vitals and /api/iot/vitals
app.use('/alerts', alertsRouter);
app.use('/reports', reportsRouter);
app.use('/profile', profileRouter);

// Root redirect
app.get('/', (req, res) => {
  if (req.session.doctorId) return res.redirect('/dashboard');
  res.redirect('/auth/login');
});

// 404 handler
app.use((req, res) => {
  res.status(404).render('auth/login', {
    title: 'Page Not Found',
    error: ['Page not found'],
    success: [],
    values: {}
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Internal Server Error');
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n  Medico server running`);
  console.log(`  Local: http://localhost:${PORT}`);
  console.log(`  Env:   ${process.env.NODE_ENV || 'development'}\n`);
});

module.exports = app;
