'use strict';
const { PatientDiseaseHistory, VitalReading } = require('../models');

// ── Disease Knowledge Base (mirrors Java DiseaseKnowledgeBase exactly) ────────
const DISEASES = [
  {
    id: 1, name: 'Fever / Hyperthermia',
    possibleCauses: 'Infection, inflammation, heat exposure, immune response',
    symptoms: ['High temperature (>38°C)', 'Sweating', 'Chills', 'Headache', 'Muscle aches'],
    recommendations: ['Rest and stay hydrated', 'Use fever-reducing medication (e.g., paracetamol)', 'Consult doctor if fever persists >3 days or exceeds 39.5°C', 'Monitor for additional symptoms'],
    check: v => v.temperature >= 38.0 || v.heartRate >= 100
  },
  {
    id: 2, name: 'Hypothermia',
    possibleCauses: 'Cold exposure, hypothyroidism, sepsis, malnutrition',
    symptoms: ['Low body temperature (<35°C)', 'Shivering', 'Confusion', 'Slow breathing'],
    recommendations: ['Move to warm environment immediately', 'Remove wet clothing', 'Seek emergency medical attention for severe cases', 'Monitor core temperature regularly'],
    check: v => v.temperature < 35.0 || v.heartRate < 50
  },
  {
    id: 3, name: 'Tachycardia',
    possibleCauses: 'Stress, anxiety, fever, dehydration, heart disease, stimulants',
    symptoms: ['Rapid heart rate (>100 bpm)', 'Palpitations', 'Shortness of breath', 'Dizziness'],
    recommendations: ['Practice relaxation techniques', 'Avoid caffeine and stimulants', 'Consult cardiologist if persistent', 'Monitor blood pressure'],
    check: v => v.heartRate > 100
  },
  {
    id: 4, name: 'Bradycardia',
    possibleCauses: 'Heart block, hypothyroidism, medication side effects, athletic conditioning',
    symptoms: ['Slow heart rate (<60 bpm)', 'Fatigue', 'Dizziness', 'Fainting', 'Shortness of breath'],
    recommendations: ['Avoid medications that slow heart rate', 'Consult cardiologist', 'Consider pacemaker evaluation for severe cases', 'Regular cardiac monitoring'],
    check: v => v.heartRate < 60
  },
  {
    id: 5, name: 'Hypoxemia / Low Blood Oxygen',
    possibleCauses: 'Asthma, pneumonia, COPD, pulmonary embolism, sleep apnea',
    symptoms: ['Low SpO2 (<95%)', 'Shortness of breath', 'Rapid breathing', 'Cyanosis', 'Confusion'],
    recommendations: ['Seek immediate medical attention if SpO2 <90%', 'Supplemental oxygen may be required', 'Identify and treat underlying cause', 'Avoid high-altitude environments'],
    check: v => v.spo2 < 95
  },
  {
    id: 6, name: 'Heat Stroke',
    possibleCauses: 'Prolonged heat exposure, dehydration, physical exertion in hot environment',
    symptoms: ['Very high temperature (>40°C)', 'Rapid heart rate', 'Confusion', 'No sweating'],
    recommendations: ['Emergency: call 911 immediately', 'Move to cool environment', 'Apply cold compresses to neck, armpits, groin', 'Do NOT give fluids if unconscious'],
    check: v => v.temperature >= 40.0 && v.heartRate > 110
  },
  {
    id: 7, name: 'Respiratory Distress',
    possibleCauses: 'Asthma, COPD, pneumonia, anxiety, pulmonary conditions',
    symptoms: ['Low SpO2 (<92%)', 'Elevated heart rate', 'Rapid shallow breathing'],
    recommendations: ['Seek immediate medical attention', 'Use prescribed bronchodilators', 'Sit upright to ease breathing', 'Supplemental oxygen as directed'],
    check: v => v.spo2 < 92 && v.heartRate > 100
  }
];

class DiseaseService {
  /** Match diseases against a vitals snapshot */
  matchDiseases({ heartRate, spo2, temperature }) {
    const vitals = {
      heartRate: parseInt(heartRate),
      spo2: parseInt(spo2),
      temperature: parseFloat(temperature)
    };
    const results = [];
    for (const disease of DISEASES) {
      if (disease.check(vitals)) {
        // Compute confidence: how many individual params are abnormal
        let abnormal = 0;
        let total = 3;
        if (vitals.heartRate > 100 || vitals.heartRate < 50) abnormal++;
        if (vitals.spo2 < 95) abnormal++;
        if (vitals.temperature >= 38 || vitals.temperature < 35) abnormal++;
        const confidence = Math.min(0.5 + (abnormal / total) * 0.5, 0.99);
        const matchedParameters = [];
        if (vitals.heartRate > 100 || vitals.heartRate < 50) matchedParameters.push('heart_rate');
        if (vitals.spo2 < 95) matchedParameters.push('spo2');
        if (vitals.temperature >= 38 || vitals.temperature < 35) matchedParameters.push('temperature');
        results.push({ disease, confidence: parseFloat(confidence.toFixed(2)), matchedParameters });
      }
    }
    return results.sort((a, b) => b.confidence - a.confidence);
  }

  /** Auto-detect diseases from patient's latest reading and persist them */
  async autoRecordFromMatches(patientId) {
    const latest = await VitalReading.findOne({
      where: { patient_id: patientId },
      order: [['recorded_at', 'DESC']]
    });
    if (!latest) throw new Error('No vital readings found for patient');

    const matches = this.matchDiseases({
      heartRate:   latest.heart_rate,
      spo2:        latest.spo2,
      temperature: latest.temperature
    });

    const recorded = [];
    for (const m of matches) {
      const exists = await PatientDiseaseHistory.findOne({
        where: { patient_id: patientId, disease_name: m.disease.name, status: 'ACTIVE' }
      });
      if (!exists) {
        const entry = await PatientDiseaseHistory.create({
          patient_id:          patientId,
          disease_id:          m.disease.id,
          disease_name:        m.disease.name,
          possible_causes:     m.disease.possibleCauses,
          status:              'ACTIVE',
          detection_confidence: m.confidence,
          detected_temperature: latest.temperature,
          detected_heart_rate:  latest.heart_rate,
          detected_spo2:        latest.spo2,
          observed_symptoms:    m.disease.symptoms.join(', ')
        });
        recorded.push(entry);
      }
    }
    return recorded;
  }

  /** Manually record a disease */
  async recordDiseaseManually(patientId, { disease_name, possible_causes, status, doctor_notes, detected_temperature, detected_heart_rate, detected_spo2 }) {
    return PatientDiseaseHistory.create({
      patient_id: patientId,
      disease_name,
      possible_causes: possible_causes || null,
      status: status || 'ACTIVE',
      doctor_notes: doctor_notes || null,
      detected_temperature: detected_temperature || null,
      detected_heart_rate: detected_heart_rate || null,
      detected_spo2: detected_spo2 || null
    });
  }

  /** Resolve / clear a disease */
  async clearDisease(historyId, clearanceNotes) {
    const entry = await PatientDiseaseHistory.findByPk(historyId);
    if (!entry) throw new Error('Disease record not found');
    await entry.update({ status: 'RESOLVED', cleared_at: new Date(), clearance_notes: clearanceNotes || null });
    return entry;
  }

  /** Update disease status */
  async updateDiseaseStatus(historyId, status, notes) {
    const entry = await PatientDiseaseHistory.findByPk(historyId);
    if (!entry) throw new Error('Disease record not found');
    const update = { status };
    if (status === 'RESOLVED') update.cleared_at = new Date();
    if (notes) update.doctor_notes = notes;
    await entry.update(update);
    return entry;
  }

  getAllDiseases() {
    return DISEASES.map(({ id, name, possibleCauses, symptoms, recommendations }) => ({
      id, name, possibleCauses, symptoms, recommendations
    }));
  }

  /** Summary of patient disease history */
  async getDiseaseSummary(patientId) {
    const all = await PatientDiseaseHistory.findAll({ where: { patient_id: patientId } });
    return {
      total:      all.length,
      active:     all.filter(d => d.status === 'ACTIVE').length,
      resolved:   all.filter(d => d.status === 'RESOLVED').length,
      monitoring: all.filter(d => d.status === 'MONITORING').length
    };
  }
}

module.exports = new DiseaseService();
