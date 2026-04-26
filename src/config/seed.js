'use strict';
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { syncDatabase, Doctor, Patient, VitalReading, HealthAlert } = require('../models');

async function seed() {
  await syncDatabase();
  console.log('[SEED] Seeding...');

  const hash = await bcrypt.hash('password123', 10);
  let [doc, created] = await Doctor.findOrCreate({
    where: { email: 'demo@medico.com' },
    defaults: { password: hash, full_name: 'Dr. Sarah Johnson', specialization: 'Internal Medicine', license_number: 'LIC-2024-001', phone_number: '+1-555-0100' }
  });
  if (created) console.log('[SEED] Doctor created: demo@medico.com / password123');
  else console.log('[SEED] Doctor already exists');

  const patients = [
    { full_name: 'James Wilson',  date_of_birth: '1975-03-15', gender: 'Male',   blood_type: 'O+', phone_number: '+1-555-0201', device_id: 'ESP32-001' },
    { full_name: 'Maria Garcia',  date_of_birth: '1988-07-22', gender: 'Female', blood_type: 'A-', phone_number: '+1-555-0202', device_id: 'ESP32-002' },
    { full_name: 'Robert Chen',   date_of_birth: '1962-11-08', gender: 'Male',   blood_type: 'B+', phone_number: '+1-555-0203', device_id: null }
  ];

  for (const pd of patients) {
    const [p, c] = await Patient.findOrCreate({ where: { full_name: pd.full_name, doctor_id: doc.id }, defaults: { ...pd, doctor_id: doc.id } });
    if (c) {
      for (let i = 12; i >= 0; i--) {
        const hr = 72 + Math.floor(Math.random() * 30) - 10;
        const spo2 = 95 + Math.floor(Math.random() * 5);
        const temp = (36.4 + (Math.random() * 1.5)).toFixed(1);
        const d = new Date(); d.setHours(d.getHours() - i * 2);
        await VitalReading.create({ patient_id: p.id, device_id: pd.device_id || 'MANUAL', heart_rate: hr, spo2, temperature: temp, recorded_at: d });
      }
      await HealthAlert.create({ patient_id: p.id, alert_type: 'VITAL_ABNORMAL', message: `${pd.full_name}: Elevated heart rate detected — 105 bpm`, is_read: false });
      console.log(`[SEED] Patient created: ${pd.full_name}`);
    }
  }
  console.log('[SEED] Done!');
  process.exit(0);
}

seed().catch(e => { console.error('[SEED] Error:', e.message); process.exit(1); });
