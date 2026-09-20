/**
 * examples/07-custom-metrics-tagged.js — متریک سفارشی + تگ (Cache / تراکنش / صف)
 * ----------------------------------------------------------------------------
 * هر جا «متریک پیش‌فرض k6» کافی نباشد (مثل نسبت Cache Hit یا زمان Checkout)،
 * یک متریک سفارشی می‌سازیم و همان تگ‌های استاندارد را به آن می‌دهیم:
 *   checkoutDuration.add(value, { flow: 'checkout', endpoint: 'orders' })
 *   cacheHit.add(1, { cache: 'hit', endpoint: 'products' })
 * سپس آستانه را روی زیرمتریک تگ‌دار می‌بندیم (mergeThresholds + taggedSla).
 *
 * اجرا:  k6 run examples/07-custom-metrics-tagged.js
 */

import http from 'k6/http';
import { sleep } from 'k6';
import { Trend, Rate } from 'k6/metrics';
import {
  mergeThresholds,
  sampleGuard,
  errorBudget,
  customTrend,
  customRate,
  cacheAndQueueThresholds,
  runChecks,
  contractChecks,
  businessChecks,
  CHECK_TYPE,
  SEVERITY,
  ON_FAIL,
  baseUrl,
} from '../index.js';

const BASE = baseUrl();

// متریک‌های سفارشی (در سطح ماژول، یک‌بار برای همهٔ VU ها)
const checkoutDuration = new Trend('checkout_duration', true);
const cacheHit = new Rate('cache_hit');
const queueWait = new Trend('queue_wait', true);
const checkoutSuccess = new Rate('checkout_success');

export const options = {
  vus: 3,
  duration: '5s',
  thresholds: mergeThresholds(
    sampleGuard(),
    errorBudget(),
    // نمونهٔ کارخانهٔ آماده (Cache/Queue/Transaction):
    cacheAndQueueThresholds({
      cacheMetric: 'cache_hit',
      cacheHitRatio: 0.5,
      queueMetric: 'queue_wait',
      queueWaitP95Ms: 300,
      transactionMetric: 'checkout_success',
      transactionSuccessRate: 0.9,
    }),
    // SLA دقیق‌تر روی متریک سفارشی (فقط برای تراکنش Checkout):
    customTrend('checkout_duration', { p95: 2500, max: 5000 }),
    customRate('cache_hit', 0.5, { endpoint: 'products' })
  ),
};

export default function () {
  const headers = { 'Content-Type': 'application/json' };

  // ۱) لیست محصولات: کش Hit/Miss را با تگ ثبت می‌کنیم
  const list = http.get(`${BASE}/products?page=1&size=5`, {
    tags: { endpoint: 'products', flow: 'catalog', cache: 'miss' },
  });
  cacheHit.add(list.status === 200 ? 1 : 0, { endpoint: 'products', cache: 'hit' });
  runChecks(list, contractChecks({ requiredPaths: ['items'], nonEmptyArrayPaths: ['items'] }), {
    endpoint: 'products',
    flow: 'catalog',
    type: CHECK_TYPE.contract,
    severity: SEVERITY.normal,
    onFail: ON_FAIL.warn,
  });

  // ۲) ثبت سفارش: زمان تراکنش را اندازه می‌گیریم (Trend سفارشی + تگ flow)
  const started = Date.now();
  const order = http.post(`${BASE}/orders`, JSON.stringify({ productId: 'p-1', quantity: 1 }), {
    headers,
    tags: { endpoint: 'orders', flow: 'checkout' },
  });
  checkoutDuration.add(Date.now() - started, { endpoint: 'orders', flow: 'checkout' });
  checkoutSuccess.add(order.status === 201 ? 1 : 0, { flow: 'checkout' });

  runChecks(order, businessChecks({ successPath: 'success', idPath: 'orderId', statePath: 'state', expectedState: 'CREATED' }), {
    endpoint: 'orders',
    flow: 'checkout',
    type: CHECK_TYPE.business,
    severity: SEVERITY.critical,
    onFail: ON_FAIL.warn,
  });

  // ۳) شبیه‌سازی تأخیر صف (در پروژهٔ واقعی این عدد را از سرویس می‌گیرید)
  const queueStart = Date.now();
  http.get(`${BASE}/slow?ms=50`, { tags: { endpoint: 'slow', flow: 'checkout', async: 'true' } });
  queueWait.add(Date.now() - queueStart - 50, { flow: 'checkout', async: 'true' });

  sleep(0.4);
}
