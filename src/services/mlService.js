'use strict';

const ML_URL = process.env.ML_SERVICE_URL; // e.g. https://medico-ml.onrender.com

class MLService {
  async predict({ heartRate, spo2, temperature }) {
    if (!ML_URL) return null;
    try {
      const res = await fetch(`${ML_URL}/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ heart_rate: heartRate, spo2, temperature }),
        signal: AbortSignal.timeout(8000)
      });
      if (!res.ok) return null;
      return await res.json(); // { predictions: [{disease, confidence}] }
    } catch (e) {
      console.error('[ML] predict failed:', e.message);
      return null;
    }
  }

  async triggerRetrain() {
    if (!ML_URL) return;
    try {
      await fetch(`${ML_URL}/train`, {
        method: 'POST',
        headers: { 'X-API-Key': process.env.ML_API_KEY || 'medico-ml-key' },
        signal: AbortSignal.timeout(5000)
      });
      console.log('[ML] Retrain triggered');
    } catch (e) {
      console.error('[ML] retrain trigger failed:', e.message);
    }
  }
}

module.exports = new MLService();
