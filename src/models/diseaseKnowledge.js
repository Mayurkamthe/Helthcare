// Disease knowledge base - translated from Java DiseaseKnowledgeBase
const DISEASES = [
  {
    id: 1,
    name: 'Fever / Hyperthermia',
    possibleCauses: 'Infection, inflammation, heat exposure, immune response',
    symptoms: ['High temperature (>38°C)', 'Sweating', 'Chills', 'Headache', 'Muscle aches'],
    recommendations: [
      'Rest and stay hydrated',
      'Use fever-reducing medication (e.g., paracetamol)',
      'Consult doctor if fever persists >3 days or exceeds 39.5°C',
      'Monitor for additional symptoms'
    ],
    check: (vitals) => {
      const conditions = [];
      if (vitals.temperature >= 38.0) conditions.push({ matched: true, param: 'temperature' });
      if (vitals.heartRate >= 100) conditions.push({ matched: true, param: 'heart_rate' });
      return conditions;
    },
    minConfidence: 0.6
  },
  {
    id: 2,
    name: 'Hypothermia',
    possibleCauses: 'Cold exposure, hypothyroidism, sepsis, malnutrition',
    symptoms: ['Low body temperature (<35°C)', 'Shivering', 'Confusion', 'Slow breathing'],
    recommendations: [
      'Move to warm environment immediately',
      'Remove wet clothing',
      'Seek emergency medical attention for severe cases',
      'Monitor core temperature regularly'
    ],
    check: (vitals) => {
      const conditions = [];
      if (vitals.temperature < 35.0) conditions.push({ matched: true, param: 'temperature' });
      if (vitals.heartRate < 50) conditions.push({ matched: true, param: 'heart_rate' });
      return conditions;
    },
    minConfidence: 0.7
  },
  {
    id: 3,
    name: 'Tachycardia',
    possibleCauses: 'Stress, anxiety, fever, dehydration, heart disease, stimulants',
    symptoms: ['Rapid heart rate (>100 bpm)', 'Palpitations', 'Shortness of breath', 'Dizziness'],
    recommendations: [
      'Practice relaxation techniques',
      'Avoid caffeine and stimulants',
      'Consult cardiologist if persistent',
      'Monitor blood pressure'
    ],
    check: (vitals) => {
      const conditions = [];
      if (vitals.heartRate > 100) conditions.push({ matched: true, param: 'heart_rate' });
      return conditions;
    },
    minConfidence: 0.7
  },
  {
    id: 4,
    name: 'Bradycardia',
    possibleCauses: 'Heart block, hypothyroidism, medication side effects, athletic conditioning',
    symptoms: ['Slow heart rate (<60 bpm)', 'Fatigue', 'Dizziness', 'Fainting', 'Shortness of breath'],
    recommendations: [
      'Avoid medications that slow heart rate',
      'Consult cardiologist',
      'Consider pacemaker evaluation for severe cases',
      'Regular cardiac monitoring'
    ],
    check: (vitals) => {
      const conditions = [];
      if (vitals.heartRate < 60) conditions.push({ matched: true, param: 'heart_rate' });
      return conditions;
    },
    minConfidence: 0.6
  },
  {
    id: 5,
    name: 'Hypoxemia / Low Blood Oxygen',
    possibleCauses: 'Asthma, pneumonia, COPD, pulmonary embolism, sleep apnea',
    symptoms: ['Low SpO2 (<95%)', 'Shortness of breath', 'Rapid breathing', 'Cyanosis', 'Confusion'],
    recommendations: [
      'Seek immediate medical attention if SpO2 <90%',
      'Supplemental oxygen may be required',
      'Identify and treat underlying cause',
      'Avoid high-altitude environments'
    ],
    check: (vitals) => {
      const conditions = [];
      if (vitals.spo2 < 95) conditions.push({ matched: true, param: 'spo2' });
      return conditions;
    },
    minConfidence: 0.8
  },
  {
    id: 6,
    name: 'Heat Stroke',
    possibleCauses: 'Prolonged heat exposure, dehydration, physical exertion in hot environment',
    symptoms: ['Very high temperature (>40°C)', 'Rapid heart rate', 'Confusion', 'No sweating'],
    recommendations: [
      'Emergency: call 911 immediately',
      'Move to cool environment',
      'Apply cold compresses to neck, armpits, groin',
      'Do NOT give fluids if unconscious'
    ],
    check: (vitals) => {
      const conditions = [];
      if (vitals.temperature >= 40.0) conditions.push({ matched: true, param: 'temperature' });
      if (vitals.heartRate > 110) conditions.push({ matched: true, param: 'heart_rate' });
      return conditions;
    },
    minConfidence: 0.75
  },
  {
    id: 7,
    name: 'Respiratory Distress',
    possibleCauses: 'Asthma, COPD, pneumonia, anxiety, pulmonary conditions',
    symptoms: ['Low SpO2 (<92%)', 'Elevated heart rate', 'Rapid shallow breathing'],
    recommendations: [
      'Seek immediate medical attention',
      'Use prescribed bronchodilators',
      'Sit upright to ease breathing',
      'Supplemental oxygen as directed'
    ],
    check: (vitals) => {
      const conditions = [];
      if (vitals.spo2 < 92) conditions.push({ matched: true, param: 'spo2' });
      if (vitals.heartRate > 100) conditions.push({ matched: true, param: 'heart_rate' });
      return conditions;
    },
    minConfidence: 0.7
  }
];

function matchDiseases(vitals) {
  const matches = [];
  for (const disease of DISEASES) {
    const conditions = disease.check(vitals);
    const matched = conditions.filter(c => c.matched);
    if (matched.length > 0) {
      const confidence = Math.min(matched.length / Math.max(conditions.length, 1) * 1.2, 1.0);
      if (confidence >= (disease.minConfidence - 0.1)) {
        matches.push({
          disease,
          confidence: parseFloat(confidence.toFixed(2)),
          matchedParameters: matched.map(c => c.param)
        });
      }
    }
  }
  return matches.sort((a, b) => b.confidence - a.confidence);
}

function getAllDiseases() {
  return DISEASES.map(d => ({
    id: d.id,
    name: d.name,
    possibleCauses: d.possibleCauses,
    symptoms: d.symptoms,
    recommendations: d.recommendations
  }));
}

module.exports = { matchDiseases, getAllDiseases, DISEASES };
