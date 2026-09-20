/**
 * examples/05-diagnostic.js — عیب‌یابی سرویس ناشناس (بدون Fail شدن به‌خاطر کندی)
 * ----------------------------------------------------------------------------
 * هدف: «آیا پاسخ سالم می‌گیریم؟» — نه SLA.
 *   - پریست diagnosticThresholds (بودجه‌های گشاده) → اجرا بهدلیل کندی قرمز نمی‌شود
 *   - ولی اگر هیچ نمونه‌ای ثبت نشود یا Check ها بشکنند، قرمز می‌شود
 *   - runChecks با verbose: true → در لحظهٔ شکست، خلاصهٔ پاسخ لاگ می‌شود
 *
 * اجرا:  k6 run examples/05-diagnostic.js
 */

import http from 'k6/http';
import { sleep } from 'k6';
import {
  diagnosticThresholds,
  runChecks,
  diagnosticChecks,
  ON_FAIL,
  CHECK_TYPE,
  SEVERITY,
  baseUrl,
  HTTP_TIMEOUT,
} from '../index.js';

const BASE = baseUrl();

export const options = {
  vus: 2,
  duration: '5s',
  thresholds: diagnosticThresholds,
};

export default function () {
  // ۱) مسیر سالم
  const health = http.get(`${BASE}/health`, {
    timeout: HTTP_TIMEOUT,
    tags: { endpoint: 'health', type: 'api' },
  });
  runChecks(health, diagnosticChecks({ watchdogMs: 5000, watchdogTtfbMs: 3000 }), {
    endpoint: 'health',
    type: CHECK_TYPE.availability,
    severity: SEVERITY.normal,
    onFail: ON_FAIL.warn,
    verbose: true,
    includeHeaders: true,
  });

  // ۲) مسیر کند: می‌خواهیم ببینیم TTFB چقدر است (شکست نمی‌خواهیم، فقط اطلاع)
  const slow = http.get(`${BASE}/slow?ms=400`, {
    timeout: HTTP_TIMEOUT,
    tags: { endpoint: 'slow', type: 'api' },
  });
  runChecks(slow, { 'slow endpoint responded': (res) => res.status === 200 }, {
    endpoint: 'slow',
    type: CHECK_TYPE.http,
    severity: SEVERITY.low,
    onFail: ON_FAIL.warn,
    verbose: true,
  });

  // ۳) مسیر خطادار: اگر سرویس خطا بدهد، می‌خواهیم جزئیاتش را ببینیم
  const failing = http.get(`${BASE}/error/500`, { tags: { endpoint: 'error', type: 'api' } });
  runChecks(failing, { 'server error is observable': (res) => res.status === 500 }, {
    endpoint: 'error',
    type: CHECK_TYPE.http,
    severity: SEVERITY.low,
    onFail: ON_FAIL.warn,
    verbose: true,
    maxBodyLength: 300,
  });

  sleep(0.5);
}
