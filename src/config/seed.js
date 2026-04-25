require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('./db');

async function seed() {
  console.log('[SEED] Starting seed...');

  // Create demo doctor
  const hash = await bcrypt.hash('password123', 10);
  const [existing] = await db.query('SELECT id FROM doctors WHERE email = ?', ['demo@medico.com']);

  let doctorId;
  if (existing.length === 0) {
    const [result] = await db.query(
      `INSERT INTO doctors (email, password, full_name, specialization, license_number, phone_number)
       VALUES (?, ?, ?, ?, ?, ?)`,
      ['demo@medico.com', hash, 'Dr. Sarah Johnson', 'Internal Medicine', 'LIC-2024-001', '+1-555-0100']
    );
    doctorId = result.insertId;
    console.log('[SEED] Demo doctor created: demo@medico.com / password123');
  } else {
    doctorId = existing[0].id;
    console.log('[SEED] Demo doctor already exists');
  }

  // Create sample patients
  const patients = [
    { name: 'James Wilson', dob: '1975-03-15', gender: 'Male', blood: 'O+', phone: '+1-555-0201', device: 'ESP32-001' },
    { name: 'Maria Garcia', dob: '1988-07-22', gender: 'Female', blood: 'A-', phone: '+1-555-0202', device: 'ESP32-002' },
    { name: 'Robert Chen', dob: '1962-11-08', gender: 'Male', blood: 'B+', phone: '+1-555-0203', device: null },
  ];

  for (const p of patients) {
    const [exists] = await db.query('SELECT id FROM patients WHERE full_name = ? AND doctor_id = ?', [p.name, doctorId]);
    if (exists.length === 0) {
      const [res] = await db.query(
        `INSERT INTO patients (doctor_id, full_name, date_of_birth, gender, blood_type, phone_number, device_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [doctorId, p.name, p.dob, p.gender, p.blood, p.phone, p.device]
      );

      // Add some vitals for this patient
      const patientId = res.insertId;
      for (let i = 10; i >= 0; i--) {
        const hr = 72 + Math.floor(Math.random() * 20) - 10;
        const spo2 = 96 + Math.floor(Math.random() * 4);
        const temp = 36.5 + (Math.random() * 2 - 0.5);
        await db.query(
          `INSERT INTO vital_readings (patient_id, device_id, heart_rate, spo2, temperature, recorded_at)
           VALUES (?, ?, ?, ?, ?, DATE_SUB(NOW(), INTERVAL ? HOUR))`,
          [patientId, p.device || 'MANUAL', hr, spo2, temp.toFixed(1), i * 2]
        );
      }

      // Add an alert
      await db.query(
        `INSERT INTO health_alerts (patient_id, alert_type, message, is_read) VALUES (?, ?, ?, ?)`,
        [patientId, 'VITAL_ABNORMAL', `Elevated heart rate detected for ${p.name}: ${72 + 20} bpm`, false]
      );

      console.log(`[SEED] Patient created: ${p.name}`);
    }
  }

  console.log('[SEED] Seeding complete!');
  process.exit(0);
}

seed().catch(err => {
  console.error('[SEED] Error:', err.message);
  process.exit(1);
});
