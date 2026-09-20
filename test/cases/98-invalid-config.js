/**
 * test/cases/98-invalid-config.js — کیس منفی: باید با exit code 104 تمام شود
 * ----------------------------------------------------------------------------
 * 'checks' از نوع Rate است و aggregation «count» را پشتیبانی نمی‌کند؛ k6 باید
 * همان لحظهٔ init با خطای InvalidConfig (کد 104) متوقف شود.
 * این کیس، رگرسیونِ کلاسِ خطای «آستانهٔ نامعتبر» را در CI می‌گیرد.
 */

import http from 'k6/http';
import { baseUrl } from '../../index.js';

const BASE = baseUrl();

export const options = {
  vus: 1,
  iterations: 1,
  thresholds: {
    checks: ['count>0'], // ❌ نامعتبر: Rate فقط rate را پشتیبانی می‌کند
  },
};

export default function () {
  http.get(`${BASE}/health`);
}
