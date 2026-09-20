/**
 * examples/08-breakpoint.js — کشف نقطهٔ شکست (Breakpoint Test)
 * ----------------------------------------------------------------------------
 * الگو: بار به‌صورت پله‌ای زیاد می‌شود و آستانه‌های SLO با abortOnFail فعال‌اند؛
 * یعنی لحظه‌ای که SLO نقض شود، اجرا متوقف و «نقطهٔ شکست» از خروجی استخراج می‌شود.
 *
 * اجرا:  k6 run examples/08-breakpoint.js
 * (برای اجرای بدون توقف در عیب‌یابی: k6 run --no-thresholds examples/08-breakpoint.js)
 */

import http from 'k6/http';
import { sleep } from 'k6';
import {
  breakpointThresholds,
  runChecks,
  healthChecks,
  CHECK_TYPE,
  SEVERITY,
  ON_FAIL,
  baseUrl,
} from '../index.js';

const BASE = baseUrl();

export const options = {
  scenarios: {
    breakpoint: {
      executor: 'ramping-arrival-rate',
      startRate: 5,
      timeUnit: '1s',
      preAllocatedVUs: 10,
      maxVUs: 40,
      stages: [
        { target: 10, duration: '2s' },
        { target: 20, duration: '2s' },
        { target: 30, duration: '2s' },
      ],
    },
  },
  thresholds: breakpointThresholds,
};

export default function () {
  const res = http.get(`${BASE}/products?page=1&size=3`, {
    tags: { endpoint: 'products', type: 'api' },
  });

  runChecks(res, healthChecks({ successStatuses: [200] }), {
    endpoint: 'products',
    type: CHECK_TYPE.availability,
    severity: SEVERITY.critical,
    onFail: ON_FAIL.warn,
  });
}
