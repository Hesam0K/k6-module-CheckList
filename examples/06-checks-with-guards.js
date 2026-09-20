/**
 * examples/06-checks-with-guards.js — آستانه روی «خانوادهٔ Check ها» + گارد نمونه
 * ----------------------------------------------------------------------------
 * دو مکانیزم مهم:
 *   ۱) 'checks{type:security}': ['rate>0.99']  → SLA روی یک گروه از Check ها
 *   ۲) 'assert_total{type:security}': ['count>0'] → گارد: این گروه واقعاً اجرا شد؟
 *      (چون checks از نوع Rate است و count را قبول نمی‌کند، گارد باید روی شمارنده باشد)
 *   ۳) 'assert_failed{severity:critical}': ['count==0'] → هیچ Check حیاتی نباید بشکند
 *
 * اجرا:  k6 run examples/06-checks-with-guards.js
 */

import http from 'k6/http';
import { sleep } from 'k6';
import {
  mergeThresholds,
  sampleGuard,
  errorBudget,
  checksReliability,
  guardThreshold,
  strictFailureGuard,
  taggedSla,
  runChecks,
  healthChecks,
  securityChecks,
  contractChecks,
  CHECK_TYPE,
  SEVERITY,
  ON_FAIL,
  baseUrl,
} from '../index.js';

const BASE = baseUrl();

// در این مثال، پاسخ 401 «مورد انتظار» است (تست امنیتی بدون توکن)؛ پس نباید
// http_req_failed را آلوده کند. با expectedStatuses به k6 اعلام می‌کنیم.
http.setResponseCallback(http.expectedStatuses(200, 401));

export const options = {
  vus: 3,
  duration: '5s',
  thresholds: mergeThresholds(
    sampleGuard(),
    errorBudget(),
    checksReliability(),
    // SLA روی گروه‌های Check (تگ‌محور):
    taggedSla('checks', {
      'type:security': ['rate>0.99'],
      'type:contract': ['rate>0.99'],
      'severity:critical': ['rate>0.999'],
    }),
    // گاردهای نمونه/شکست برای همان گروه‌ها:
    guardThreshold({ type: 'security' }),
    guardThreshold({ type: 'contract' }),
    strictFailureGuard({ severity: 'critical' })
  ),
};

export default function () {
  const health = http.get(`${BASE}/health`, {
    tags: { endpoint: 'health', type: 'api' },
  });
  runChecks(health, healthChecks({ successStatuses: [200] }), {
    endpoint: 'health',
    type: CHECK_TYPE.availability,
    severity: SEVERITY.critical,
    onFail: ON_FAIL.warn,
  });

  const security = http.get(`${BASE}/profile`, {
    tags: { endpoint: 'profile', type: 'security' },
  });
  runChecks(security, securityChecks({ securityHeaders: true, requireSecureCookie: false }), {
    endpoint: 'profile',
    type: CHECK_TYPE.security,
    severity: SEVERITY.critical,
    onFail: ON_FAIL.warn,
  });

  const contract = http.get(`${BASE}/products?page=1&size=3`, {
    tags: { endpoint: 'products', type: 'contract' },
  });
  runChecks(
    contract,
    contractChecks({
      requiredPaths: ['page', 'size', 'total', 'items'],
      nonEmptyArrayPaths: ['items'],
      typedPaths: { page: 'integer', total: 'integer' },
    }),
    {
      endpoint: 'products',
      type: CHECK_TYPE.contract,
      severity: SEVERITY.critical,
      onFail: ON_FAIL.warn,
    }
  );

  sleep(0.5);
}
