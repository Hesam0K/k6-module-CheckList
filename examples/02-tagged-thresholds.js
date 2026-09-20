/**
 * examples/02-tagged-thresholds.js — ★ الگوی استاندارد تیم (نسخهٔ ۳ / تگ‌محور)
 * ----------------------------------------------------------------------------
 * قواعد طلایی این نمونه:
 *   ۱) تگ‌ها در «پیکربندی درخواست» ست می‌شوند:  { tags: { endpoint: 'health' } }
 *   ۲) آستانه‌ها روی همان متریک پیش‌فرض k6 و با فیلتر تگ بسته می‌شوند:
 *        'http_req_duration{endpoint:health}': ['p(95)<800']
 *   ۳) نیازی به ساختن چند Trend سفارشی نیست (یک متریک + چند تگ = چند SLA).
 *   ۴) Sample Guard و Error Budget همیشه حاضرند تا «سبز شدن کاذب» رخ ندهد.
 *
 * اجرا:
 *   k6 run examples/02-tagged-thresholds.js
 *   k6 run -e K6_SLO_PROFILE=strict examples/02-tagged-thresholds.js
 */

import http from 'k6/http';
import { sleep } from 'k6';
import {
  mergeThresholds,
  sampleGuard,
  errorBudget,
  scopeToTag,
  taggedSla,
  latencyBudget,
  checksReliability,
  runChecks,
  healthChecks,
  contractChecks,
  CHECK_TYPE,
  SEVERITY,
  ON_FAIL,
  baseUrl,
} from '../index.js';

const BASE = baseUrl();

export const options = {
  vus: 3,
  duration: '5s',
  thresholds: mergeThresholds(
    // گاردها: بدون این‌ها آستانه‌ها ممکن است روی «صفر نمونه» سبز شوند.
    sampleGuard(),
    errorBudget(),
    checksReliability(),
    latencyBudget(),
    // SLA اختصاصی هر Endpoint (هم آستانهٔ کلی و هم تگ‌دار):
    scopeToTag({ http_req_duration: ['p(95)<400'] }, { endpoint: 'health' }, 'both'),
    // SLA برای Endpoint پرترافیک‌تر با بودجهٔ متفاوت:
    taggedSla('http_req_duration', { 'endpoint:products': ['p(95)<1200', 'p(99)<2000'] }),
    // SLA روی «خانوادهٔ Check ها» بر اساس تگ استاندارد:
    taggedSla('checks', { 'type:contract': ['rate>0.99'] })
  ),
};

export default function () {
  // درخواست ۱: health با تگ endpoint
  const health = http.get(`${BASE}/health`, {
    tags: { endpoint: 'health', type: 'api' },
  });
  runChecks(health, healthChecks({ successStatuses: [200] }), {
    endpoint: 'health',
    type: CHECK_TYPE.availability,
    severity: SEVERITY.critical,
    onFail: ON_FAIL.warn,
  });

  // درخواست ۲: لیست محصولات با همان متریک اما تگ متفاوت
  const products = http.get(`${BASE}/products?page=1&size=5`, {
    tags: { endpoint: 'products', type: 'api' },
  });
  runChecks(
    products,
    contractChecks({
      schema: {
        type: 'object',
        required: ['page', 'size', 'total', 'items'],
        properties: {
          page: { type: 'integer' },
          size: { type: 'integer' },
          total: { type: 'integer', minimum: 0 },
          items: {
            type: 'array',
            minItems: 1,
            items: {
              type: 'object',
              required: ['id', 'title', 'price'],
              properties: {
                id: { type: 'string' },
                title: { type: 'string', minLength: 1 },
                price: { type: 'number', minimum: 0 },
                createdAt: { type: 'string' },
              },
            },
          },
        },
      },
      nonEmptyArrayPaths: ['items'],
      typedPaths: { total: 'integer' },
    }),
    {
      endpoint: 'products',
      flow: 'catalog',
      type: CHECK_TYPE.contract,
      severity: SEVERITY.critical,
      onFail: ON_FAIL.warn,
    }
  );

  sleep(0.5);
}
