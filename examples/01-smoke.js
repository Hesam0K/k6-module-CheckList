/**
 * examples/01-smoke.js — نمونهٔ «تست دود» در CI
 * ----------------------------------------------------------------------------
 * هدف: سریع بفهمیم سرویس بالاست و پاسخ سالم می‌دهد.
 * پریست: smokeThresholds (کم‌ریسک‌ترین پروفایل) — مناسب همهٔ گیت‌های CI.
 *
 * اجرا:
 *   node test/mock-server.mjs                  (در یک ترمینال دیگر)
 *   k6 run examples/01-smoke.js
 *   k6 run -e BASE_URL=https://stage.example.com examples/01-smoke.js
 */

import http from 'k6/http';
import { sleep } from 'k6';
import {
  smokeThresholds,
  runChecks,
  healthChecks,
  CHECK_TYPE,
  SEVERITY,
  ON_FAIL,
  baseUrl,
  HTTP_TIMEOUT,
} from '../index.js';

const BASE = baseUrl();

export const options = {
  vus: 2,
  duration: '3s',
  thresholds: smokeThresholds,
};

export default function () {
  const target = `${BASE}/health`;
  const res = http.get(target, {
    timeout: HTTP_TIMEOUT,
    tags: { endpoint: 'health', type: 'api' },
  });

  runChecks(res, healthChecks({ successStatuses: [200] }), {
    endpoint: 'health',
    type: CHECK_TYPE.availability,
    severity: SEVERITY.normal,
    onFail: ON_FAIL.warn,
  });

  sleep(0.5);
}
