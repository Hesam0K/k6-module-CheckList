/**
 * examples/10-negative-and-chaos.js — تست‌های منفی و رفتار آشوب‌گونه
 * ----------------------------------------------------------------------------
 * دو تکنیک مهم:
 *   ۱) http.setResponseCallback(http.expectedStatuses(...)) → خطاهای «عمدی»
 *      (401/429/500) به‌عنوان شکست سرویس شمرده نمی‌شوند؛ پس http_req_failed
 *      آلوده نمی‌شود و همان آستانهٔ rate<0.01 معنادار می‌ماند.
 *   ۲) resilienceChecks → پذیرش 429/503 به‌شرط وجود هدر Retry-After.
 *
 * اجرا:  k6 run examples/10-negative-and-chaos.js
 */

import http from 'k6/http';
import { sleep } from 'k6';
import {
  mergeThresholds,
  sampleGuard,
  errorBudget,
  latencyBudget,
  checksReliability,
  taggedSla,
  guardThreshold,
  runChecks,
  healthChecks,
  resilienceChecks,
  unauthorizedResponse,
  CHECK_TYPE,
  SEVERITY,
  ON_FAIL,
  baseUrl,
} from '../index.js';

const BASE = baseUrl();

// پاسخ‌های 401/429/500 برای این تست «مورد انتظار» هستند:
http.setResponseCallback(http.expectedStatuses(200, 201, 204, 401, 429, 500));

export const options = {
  vus: 2,
  duration: '5s',
  thresholds: mergeThresholds(
    sampleGuard(),
    errorBudget(),
    latencyBudget(),
    checksReliability(),
    taggedSla('checks', { 'type:resilience': ['rate>0.99'], 'type:security': ['rate>0.99'] }),
    guardThreshold({ type: 'resilience' }),
    guardThreshold({ type: 'security' })
  ),
};

export default function () {
  // ۱) بدون توکن → انتظار 401 داریم (سناریوی امنیتی)
  const unauthorized = http.get(`${BASE}/profile`, {
    tags: { endpoint: 'profile', type: 'security' },
  });
  runChecks(unauthorized, { 'unauthenticated access is rejected': unauthorizedResponse }, {
    endpoint: 'profile',
    type: CHECK_TYPE.security,
    severity: SEVERITY.critical,
    onFail: ON_FAIL.warn,
  });

  // ۲) Rate Limit → انتظار 429 + Retry-After داریم
  const limited = http.get(`${BASE}/limited`, {
    tags: { endpoint: 'limited', type: 'resilience' },
  });
  runChecks(limited, resilienceChecks({ toleratedStatuses: [429], requireRetryAfter: true }), {
    endpoint: 'limited',
    type: CHECK_TYPE.availability,
    severity: SEVERITY.normal,
    onFail: ON_FAIL.warn,
  });

  // ۳) خطای سرور بیرونی → انتظار 500 قابل‌مشاهده (بدون نشت اطلاعات)
  const broken = http.get(`${BASE}/error/500`, {
    tags: { endpoint: 'error', type: 'resilience' },
  });
  runChecks(
    broken,
    {
      'server error surfaces as 500': (res) => res.status === 500,
      'error payload is JSON': (res) => {
        try {
          JSON.parse(res.body);
          return true;
        } catch (error) {
          return false;
        }
      },
      'no stacktrace leaked': (res) => res.body.indexOf('stacktrace') === -1,
    },
    {
      endpoint: 'error',
      type: CHECK_TYPE.resilience,
      severity: SEVERITY.critical,
      onFail: ON_FAIL.warn,
    }
  );

  // ۴) مسیر سالم تا گارد نمونه همیشه پر شود
  const health = http.get(`${BASE}/health`, { tags: { endpoint: 'health', type: 'api' } });
  runChecks(health, healthChecks({ successStatuses: [200] }), {
    endpoint: 'health',
    type: CHECK_TYPE.availability,
    severity: SEVERITY.normal,
    onFail: ON_FAIL.warn,
  });

  sleep(0.4);
}
