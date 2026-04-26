'use strict';
require('dotenv').config();
const { syncDatabase } = require('../models');

console.log('[MIGRATE] Running Sequelize sync...');
syncDatabase()
  .then(() => { console.log('[MIGRATE] Done'); process.exit(0); })
  .catch(e => { console.error('[MIGRATE] Error:', e.message); process.exit(1); });
