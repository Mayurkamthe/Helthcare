const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const PDFDocument = require('pdfkit');

// GET /reports/patient/:id - Download PDF
router.get('/patient/:id', requireAuth, async (req, res) => {
  const doctorId = req.session.doctorId;
  try {
    const [[patient]] = await db.query('SELECT * FROM patients WHERE id = ? AND doctor_id = ?', [req.params.id, doctorId]);
    if (!patient) { req.flash('error', 'Patient not found'); return res.redirect('/patients'); }

    const [[doctor]] = await db.query('SELECT * FROM doctors WHERE id = ?', [doctorId]);
    const [vitals] = await db.query(
      'SELECT * FROM vital_readings WHERE patient_id = ? ORDER BY recorded_at DESC LIMIT 10', [patient.id]
    );
    const [diseases] = await db.query(
      'SELECT * FROM patient_disease_history WHERE patient_id = ? ORDER BY detected_at DESC', [patient.id]
    );
    const [alerts] = await db.query(
      'SELECT * FROM health_alerts WHERE patient_id = ? ORDER BY created_at DESC LIMIT 5', [patient.id]
    );

    // Generate PDF
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=patient_report_${patient.id}.pdf`);
    doc.pipe(res);

    // Header
    doc.fontSize(22).font('Helvetica-Bold').text('MEDICO', 50, 50);
    doc.fontSize(10).font('Helvetica').fillColor('#666').text('Medical IoT Monitoring System', 50, 78);
    doc.moveTo(50, 95).lineTo(545, 95).strokeColor('#e2e8f0').stroke();

    // Patient Info
    doc.fillColor('#000').fontSize(16).font('Helvetica-Bold').text('Patient Report', 50, 110);
    doc.fontSize(11).font('Helvetica');
    doc.text(`Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, 50, 132);
    doc.text(`Doctor: ${doctor.full_name} - ${doctor.specialization || 'N/A'}`, 50, 148);

    doc.rect(50, 170, 495, 1).fill('#e2e8f0');
    doc.fontSize(13).font('Helvetica-Bold').fillColor('#1a202c').text('Patient Information', 50, 180);

    const info = [
      ['Full Name', patient.full_name],
      ['Date of Birth', patient.date_of_birth ? new Date(patient.date_of_birth).toLocaleDateString() : 'N/A'],
      ['Gender', patient.gender || 'N/A'],
      ['Blood Type', patient.blood_type || 'N/A'],
      ['Phone', patient.phone_number || 'N/A'],
      ['Device ID', patient.device_id || 'Not assigned'],
    ];

    let y = 200;
    for (const [label, value] of info) {
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#4a5568').text(label + ':', 50, y);
      doc.font('Helvetica').fillColor('#000').text(value, 200, y);
      y += 18;
    }

    // Vitals
    if (vitals.length > 0) {
      y += 10;
      doc.rect(50, y, 495, 1).fill('#e2e8f0');
      y += 10;
      doc.fontSize(13).font('Helvetica-Bold').fillColor('#1a202c').text('Recent Vital Readings', 50, y);
      y += 20;

      // Table header
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#4a5568');
      doc.text('Date/Time', 50, y);
      doc.text('Heart Rate', 180, y);
      doc.text('SpO2', 280, y);
      doc.text('Temp (°C)', 360, y);
      doc.text('Device', 450, y);
      y += 15;
      doc.rect(50, y, 495, 0.5).fill('#e2e8f0');
      y += 8;

      for (const v of vitals.slice(0, 8)) {
        doc.fontSize(9).font('Helvetica').fillColor('#000');
        doc.text(new Date(v.recorded_at).toLocaleString(), 50, y);
        doc.text(v.heart_rate ? `${v.heart_rate} bpm` : '-', 180, y);
        doc.text(v.spo2 ? `${v.spo2}%` : '-', 280, y);
        doc.text(v.temperature ? `${v.temperature}` : '-', 360, y);
        doc.text(v.device_id || '-', 450, y);
        y += 16;
      }
    }

    // Disease History
    if (diseases.length > 0) {
      y += 10;
      doc.rect(50, y, 495, 1).fill('#e2e8f0');
      y += 10;
      doc.fontSize(13).font('Helvetica-Bold').fillColor('#1a202c').text('Disease History', 50, y);
      y += 20;

      for (const d of diseases) {
        doc.fontSize(10).font('Helvetica-Bold').fillColor('#000').text(d.disease_name, 50, y);
        doc.fontSize(9).font('Helvetica').fillColor('#4a5568')
          .text(`Status: ${d.status} | Detected: ${new Date(d.detected_at).toLocaleDateString()}`, 50, y + 14);
        if (d.possible_causes) {
          doc.text(`Causes: ${d.possible_causes}`, 50, y + 26, { width: 495 });
          y += 42;
        } else {
          y += 30;
        }
      }
    }

    // Medical Notes
    if (patient.medical_notes) {
      y += 10;
      doc.rect(50, y, 495, 1).fill('#e2e8f0');
      y += 10;
      doc.fontSize(13).font('Helvetica-Bold').fillColor('#1a202c').text('Medical Notes', 50, y);
      y += 18;
      doc.fontSize(10).font('Helvetica').fillColor('#000').text(patient.medical_notes, 50, y, { width: 495 });
    }

    // Footer
    doc.fontSize(8).font('Helvetica').fillColor('#999')
      .text('This report is generated automatically by the Medico system. Consult your physician for medical advice.', 50, 780, { align: 'center', width: 495 });

    doc.end();
  } catch (e) {
    console.error('PDF error:', e);
    req.flash('error', 'Failed to generate report');
    res.redirect(`/patients/${req.params.id}`);
  }
});

module.exports = router;
