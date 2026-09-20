/**
 * examples/09-compose-and-scope.js — ترکیب و مقیاس‌دهی پریست‌ها
 * ----------------------------------------------------------------------------
 * نشان می‌دهد چطور بدون تکرار کد، ترکیب‌های دلخواه بسازیم:
 *   mergeAll            → ادغام چند پریست (بدون بازنویسی، با dedupe)
 *   perEndpoint         → اعمال یک بودجه روی چند Endpoint
 *   scopeToMany         → اعمال روی چند مقدار از هر تگی
 *   adHocThresholds     → پریست سریع از چند عدد
 *   resolvePreset / explainPreset → انتخاب پویا و گزارش ساختار
 *
 * اجرا:  k6 run examples/09-compose-and-scope.js
 *        k6 run -e K6_SLO_PROFILE=strict examples/09-compose-and-scope.js
 */

import http from 'k6/http';
import { sleep } from 'k6';
import {
  mergeAll,
  perEndpoint,
  scopeToMany,
  adHocThresholds,
  resolvePreset,
  explainPreset,
  THRESHOLD_PRESETS,
  networkThresholds,
  saturationThresholds,
  runChecks,
  healthChecks,
  CHECK_TYPE,
  SEVERITY,
  ON_FAIL,
  baseUrl,
} from '../index.js';

const BASE = baseUrl();

const selectedPreset = resolvePreset(__ENV.K6_SLO_PROFILE, THRESHOLD_PRESETS, 'defaultThresholds');

export const options = {
  vus: 3,
  duration: '5s',
  thresholds: mergeAll([
    selectedPreset,
    networkThresholds,
    saturationThresholds,
    // SLA اختصاصی چند Endpoint با یک خط کد:
    perEndpoint({ http_req_duration: ['p(95)<350'] }, ['health', 'profile'], 'tagged'),
    // بودجهٔ سخت‌گیرانه برای ترافیک مسیر «کاتالوگ» (تگ flow):
    scopeToMany({ http_req_duration: ['p(90)<900'] }, 'flow', ['catalog', 'checkout'], 'both'),
    // پریست سریع از اعداد خام:
    adHocThresholds({ failedRate: 0.02, p95: 1500, checksRate: 0.95 }),
  ]),
};

export default function () {
  const res = http.get(`${BASE}/products?page=1&size=5`, {
    tags: { endpoint: 'products', flow: 'catalog', type: 'api' },
  });

  runChecks(res, healthChecks({ successStatuses: [200] }), {
    endpoint: 'products',
    flow: 'catalog',
    type: CHECK_TYPE.http,
    severity: SEVERITY.normal,
    onFail: ON_FAIL.warn,
  });

  sleep(0.5);
}

/** گزارش ساختار آستانه‌ها در init (برای بازبینی سریع در CI/لاگ). */
export function setup() {
  const rows = explainPreset('composed', options.thresholds);
  console.log(`composed thresholds → ${rows.length} expressions across ${Object.keys(options.thresholds).length} metrics`);
  rows.forEach((row) => {
    const abort = row.abortOnFail ? ` (abortOnFail, delay=${row.delayAbortEval})` : '';
    console.log(`  ${row.metric} → ${row.expression}${abort}`);
  });
  return { rows: rows.length };
}
