require('dotenv').config();
const mysql2 = require('mysql2/promise');

async function migrate() {
  const conn = await mysql2.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true
  });

  console.log('[MIGRATE] Connected to MySQL');

  await conn.query(`CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME || 'medico_db'}\``);
  await conn.query(`USE \`${process.env.DB_NAME || 'medico_db'}\``);
  console.log('[MIGRATE] Database selected');

  const schema = `
    CREATE TABLE IF NOT EXISTS doctors (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      email VARCHAR(255) NOT NULL UNIQUE,
      password VARCHAR(255) NOT NULL,
      full_name VARCHAR(255) NOT NULL,
      specialization VARCHAR(255),
      license_number VARCHAR(100),
      phone_number VARCHAR(50),
      push_token TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS patients (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      doctor_id BIGINT NOT NULL,
      full_name VARCHAR(255) NOT NULL,
      date_of_birth DATE,
      gender VARCHAR(20),
      blood_type VARCHAR(10),
      phone_number VARCHAR(50),
      address TEXT,
      emergency_contact VARCHAR(255),
      medical_notes TEXT,
      device_id VARCHAR(100),
      device_assigned_at TIMESTAMP NULL,
      device_expires_at TIMESTAMP NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE,
      INDEX idx_device_id (device_id)
    );

    CREATE TABLE IF NOT EXISTS vital_readings (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      patient_id BIGINT NOT NULL,
      device_id VARCHAR(100),
      heart_rate INT,
      spo2 INT,
      temperature DECIMAL(5,2),
      recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
      INDEX idx_patient_recorded (patient_id, recorded_at)
    );

    CREATE TABLE IF NOT EXISTS health_alerts (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      patient_id BIGINT NOT NULL,
      alert_type VARCHAR(50) NOT NULL,
      message TEXT NOT NULL,
      is_read BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
      INDEX idx_patient_read (patient_id, is_read)
    );

    CREATE TABLE IF NOT EXISTS ai_analysis_results (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      patient_id BIGINT NOT NULL,
      vital_reading_id BIGINT,
      possible_conditions JSON,
      severity VARCHAR(50),
      recommendation TEXT,
      disclaimer TEXT,
      analyzed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
      FOREIGN KEY (vital_reading_id) REFERENCES vital_readings(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS patient_disease_history (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      patient_id BIGINT NOT NULL,
      disease_id INT,
      disease_name VARCHAR(255) NOT NULL,
      possible_causes TEXT,
      status ENUM('ACTIVE','RESOLVED','MONITORING') DEFAULT 'ACTIVE',
      detection_confidence DECIMAL(5,2),
      detected_temperature DECIMAL(5,2),
      detected_heart_rate INT,
      detected_spo2 INT,
      observed_symptoms TEXT,
      doctor_notes TEXT,
      detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      cleared_at TIMESTAMP NULL,
      clearance_notes TEXT,
      FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
    );
  `;

  await conn.query(schema);
  console.log('[MIGRATE] All tables created successfully');
  await conn.end();
  console.log('[MIGRATE] Migration complete!');
}

migrate().catch(err => {
  console.error('[MIGRATE] Error:', err.message);
  process.exit(1);
});
