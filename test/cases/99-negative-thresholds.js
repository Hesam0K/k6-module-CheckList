/**
 * test/cases/99-negative-thresholds.js — کیس منفی: باید با exit code 99 تمام شود
 * ----------------------------------------------------------------------------
 * عمداً به مسیر خطادار درخواست می‌زنیم تا Error Budget نقض شود.
 * انتظار: k6 با کد 99 (thresholds crossed) خارج شود.
 */

import http from 'k6/http';
import { errorBudget, sampleGuard, mergeThresholds, checksReliability, runChecks, healthChecks, ON_FAIL, baseUrl } from '../../index.js';

const BASE = baseUrl();

export const options = {
  vus: 2,
  duration: '3s',
  thresholds: mergeThresholds(sampleGuard(), errorBudget(), checksReliability()),
};

export default function () {
  const res = http.get(`${BASE}/error/500`, { tags: { endpoint: 'error', type: 'api' } });
  // این Check پاس می‌شود (چون منتظر 500 هستیم) اما http_req_failed خودش Fail می‌شود
  runChecks(res, { 'expected 500 observed': (r) => r.status === 500 }, {
    endpoint: 'error',
    onFail: ON_FAIL.none,
  });
}
