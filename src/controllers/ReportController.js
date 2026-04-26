'use strict';
const PDFDocument = require('pdfkit');
const { Patient, VitalReading, HealthAlert, PatientDiseaseHistory, Doctor } = require('../models');

exports.patientReport = async (req, res) => {
  const patient = await Patient.findOne({
    where: { id: req.params.id, doctor_id: req.session.doctorId }
  });
  if (!patient) { req.flash('error', 'Patient not found'); return res.redirect('/patients'); }

  const [doctor, vitals, diseases, alerts] = await Promise.all([
    Doctor.findByPk(req.session.doctorId),
    VitalReading.findAll({ where: { patient_id: patient.id }, order: [['recorded_at', 'DESC']], limit: 10 }),
    PatientDiseaseHistory.findAll({ where: { patient_id: patient.id }, order: [['detected_at', 'DESC']] }),
    HealthAlert.findAll({ where: { patient_id: patient.id }, order: [['created_at', 'DESC']], limit: 5 })
  ]);

  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=patient_report_${patient.id}.pdf`);
  doc.pipe(res);

  // ── Header ────────────────────────────────────────────────────────────────
  doc.rect(0, 0, 595, 80).fill('#0284c7');
  doc.fillColor('#fff').fontSize(24).font('Helvetica-Bold').text('MEDICO', 50, 25);
  doc.fontSize(10).font('Helvetica').text('Medical IoT Monitoring System', 50, 52);
  doc.fillColor('#000');

  // ── Patient Info ──────────────────────────────────────────────────────────
  let y = 100;
  doc.fontSize(16).font('Helvetica-Bold').text('Patient Report', 50, y);
  doc.fontSize(9).font('Helvetica').fillColor('#666')
    .text(`Generated: ${new Date().toLocaleString()}   |   Doctor: ${doctor.full_name} (${doctor.specialization || 'N/A'})`, 50, y + 22);
  y += 50;

  doc.rect(50, y, 495, 1).fill('#e2e8f0'); y += 12;
  doc.fontSize(13).font('Helvetica-Bold').fillColor('#1a202c').text('Patient Information', 50, y); y += 18;

  const info = [
    ['Full Name', patient.full_name],
    ['Date of Birth', patient.date_of_birth ? new Date(patient.date_of_birth).toLocaleDateString() : 'N/A'],
    ['Gender', patient.gender || 'N/A'],
    ['Blood Type', patient.blood_type || 'N/A'],
    ['Phone', patient.phone_number || 'N/A'],
    ['Emergency Contact', patient.emergency_contact || 'N/A'],
    ['Device ID', patient.device_id || 'Not assigned']
  ];
  for (const [lbl, val] of info) {
    doc.fontSize(9).font('Helvetica-Bold').fillColor('#4a5568').text(lbl + ':', 50, y);
    doc.font('Helvetica').fillColor('#000').text(val, 220, y);
    y += 16;
  }

  // ── Vitals Table ──────────────────────────────────────────────────────────
  if (vitals.length > 0) {
    y += 8; doc.rect(50, y, 495, 1).fill('#e2e8f0'); y += 12;
    doc.fontSize(13).font('Helvetica-Bold').fillColor('#1a202c').text('Recent Vital Readings', 50, y); y += 18;
    doc.rect(50, y, 495, 18).fill('#f1f5f9');
    doc.fontSize(8).font('Helvetica-Bold').fillColor('#4a5568');
    ['Date/Time', 'Heart Rate', 'SpO2', 'Temperature', 'Source'].forEach((h, i) => {
      doc.text(h, 50 + [0, 130, 220, 300, 390][i], y + 5);
    });
    y += 18;
    for (const v of vitals.slice(0, 8)) {
      doc.fontSize(8).font('Helvetica').fillColor('#000');
      doc.text(new Date(v.recorded_at).toLocaleString(), 50, y);
      doc.text(v.heart_rate ? `${v.heart_rate} bpm` : '--', 180, y);
      doc.text(v.spo2 ? `${v.spo2}%` : '--', 270, y);
      doc.text(v.temperature ? `${parseFloat(v.temperature).toFixed(1)}°C` : '--', 350, y);
      doc.text(v.device_id || '--', 440, y);
      y += 14; doc.rect(50, y, 495, 0.4).fill('#f1f5f9');
    }
  }

  // ── Disease History ───────────────────────────────────────────────────────
  if (diseases.length > 0) {
    y += 12; doc.rect(50, y, 495, 1).fill('#e2e8f0'); y += 12;
    doc.fontSize(13).font('Helvetica-Bold').fillColor('#1a202c').text('Disease History', 50, y); y += 16;
    for (const d of diseases) {
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#000').text(d.disease_name, 50, y);
      const badge = d.status === 'ACTIVE' ? '#dc2626' : d.status === 'RESOLVED' ? '#16a34a' : '#d97706';
      doc.roundedRect(300, y - 1, 60, 12, 3).fill(badge);
      doc.fillColor('#fff').fontSize(7).text(d.status, 305, y + 2);
      doc.fillColor('#4a5568').fontSize(8).font('Helvetica')
        .text(`Detected: ${new Date(d.detected_at).toLocaleDateString()}`, 370, y + 1);
      y += 14;
      if (d.possible_causes) { doc.fontSize(8).fillColor('#6b7280').text(`Causes: ${d.possible_causes}`, 55, y, { width: 480 }); y += 12; }
      if (d.doctor_notes) { doc.fontSize(8).fillColor('#374151').text(`Notes: ${d.doctor_notes}`, 55, y, { width: 480 }); y += 12; }
      y += 4;
    }
  }

  // ── Medical Notes ─────────────────────────────────────────────────────────
  if (patient.medical_notes) {
    y += 8; doc.rect(50, y, 495, 1).fill('#e2e8f0'); y += 12;
    doc.fontSize(13).font('Helvetica-Bold').fillColor('#1a202c').text('Medical Notes', 50, y); y += 16;
    doc.fontSize(9).font('Helvetica').fillColor('#000').text(patient.medical_notes, 50, y, { width: 495 });
  }

  // ── Footer ────────────────────────────────────────────────────────────────
  doc.fontSize(7).font('Helvetica').fillColor('#9ca3af')
    .text('Generated by Medico IoT System. This report is for clinical reference only. Consult a physician for medical advice.', 50, 800, { align: 'center', width: 495 });

  doc.end();
};
