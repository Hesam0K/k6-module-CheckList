# ۰۷) دستور پخت (Recipes) — سناریو → پریست → کد

> Wiki: https://gitlab.partdp.ir/judicial-services/idadgar/backlog/-/wikis/k6-test-conditions-standard (TODO)

## ۱) تست دود در CI (پس از هر deploy)

```js
import { smokeThresholds, runChecks, healthChecks } from './index.js';
export const options = { vus: 2, duration: '30s', thresholds: smokeThresholds };
```
- نمونهٔ کامل: `examples/01-smoke.js`
- معیار سبز: exit code 0 در کمتر از ۱ دقیقه.

## ۲) SLA جداگانه برای هر Endpoint (الگوی «نسخهٔ ۳»)

```js
import { mergeThresholds, sampleGuard, errorBudget, scopeToTag, taggedSla } from './index.js';

export const options = {
  thresholds: mergeThresholds(
    sampleGuard(), errorBudget(),
    scopeToTag({ http_req_duration: ['p(95)<400'] }, { endpoint: 'health' }, 'both'),
    taggedSla('http_req_duration', { 'endpoint:products': ['p(95)<1200'] })
  ),
};
// و روی درخواست‌ها: { tags: { endpoint: 'products' } }
```
- نمونه: `examples/02-tagged-thresholds.js`

## ۳) جریان کسبوکار (Login → Profile → Catalog)

```js
thresholds: businessSlaThresholds({
  latency:  { 'flow:login': ['p(95)<800'], 'flow:catalog': ['p(95)<1200'] },
  success:  { 'flow:login': ['rate>0.99'], 'flow:catalog': ['rate>0.99'] },
});
// و تگ flow روی هر درخواست + onFail='throw' در وابستهترین مرحله
```
- نمونه: `examples/03-api-flow.js`

## ۴) گیت CI با توقف زودهنگام

```js
import { abortOnFailThresholds } from './index.js';
export const options = { vus: 4, duration: '5m', thresholds: abortOnFailThresholds };
```
- exit code 99 = نقض؛ 0 = سبز. `delayAbortEval` از هدررفت منابع جلوگیری میکند.
- نمونه: `examples/04-ci-gate-abort.js`

## ۵) عیب‌یابی سرویس ناشناس

```js
import { diagnosticThresholds, runChecks, diagnosticChecks } from './index.js';
export const options = { vus: 2, duration: '2m', thresholds: diagnosticThresholds };
// runChecks(..., { onFail: ON_FAIL.warn, verbose: true, includeHeaders: true })
```
- نمونه: `examples/05-diagnostic.js`

## ۶) SLA روی خانوادهٔ Check + گارد

```js
thresholds: {
  'checks{type:contract}':        ['rate>0.99'],
  'assert_total{type:contract}':  ['count>0'],
  'assert_failed{severity:critical}': ['count==0'],
}
```
- نمونه: `examples/06-checks-with-guards.js`

## ۷) Cache / صف / تراکنش با متریک سفارشی

```js
const cacheHit = new Rate('cache_hit');
const checkoutDuration = new Trend('checkout_duration');

thresholds: cacheAndQueueThresholds({
  cacheMetric: 'cache_hit',  cacheHitRatio: 0.8,
  queueMetric: 'queue_wait', queueWaitP95Ms: 100,
  transactionMetric: 'checkout_success', transactionSuccessRate: 0.995,
})
```
- نمونه: `examples/07-custom-metrics-tagged.js`

## ۸) کشف نقطهٔ شکست

```js
export const options = {
  scenarios: { breakpoint: {
    executor: 'ramping-arrival-rate',
    startRate: 5, timeUnit: '1s', preAllocatedVUs: 20, maxVUs: 100,
    stages: [{ target: 20, duration: '5m' }, { target: 60, duration: '10m' }],
  }},
  thresholds: breakpointThresholds,   // SLO + abortOnFail
};
```
- نقطهٔ شکست = `startTime + elapsed` در لحظهٔ توقف؛ نمونه: `examples/08-breakpoint.js`

## ۹) Soak (پایداری طولانی) و مقایسهٔ فازها

```js
thresholds: soakThresholds,
// در حلقهٔ سناریو فاز را تگ کنید تا warmup از steady جدا شود:
http.get(url, { tags: { endpoint: 'x', phase: elapsed < 600 ? 'warmup' : 'steady' } });
```
- در پایان، p95 دو فاز را با `--summary-export` مقایسه کنید؛ افت تدریجی = نشتی/گرمشدن کش.

## ۱۰) تستهای منفی و آشوب

```js
http.setResponseCallback(http.expectedStatuses(200, 401, 429, 500));
// سپس resilienceChecks + چک‌های امنیتی (بدون آلوده شدن http_req_failed)
```
- نمونه: `examples/10-negative-and-chaos.js`

## جدول انتخاب سریع پریست (چکلیست تصمیم)

| سؤال | اگر بله | اگر نه |
|---|---|---|
| آیا هدف gate رسمی است؟ | `default` یا `strict` یا `abortOnFail` | `dev` / `diagnostic` |
| آیا duration > 10 دقیقه است؟ | `soak` + تگ phase | `smoke` / `default` |
| آیا بار arrival-rate پلهای است؟ | `breakpoint` + `saturationThresholds` | `stress` |
| آیا SLA هر Endpoint متفاوت است؟ | `scopeToTag/perEndpoint` | یک بودجهٔ کلی |
| آیا شمار تراکنش کسبوکار مهم است؟ | `businessSlaThresholds` | پریست پایه |
| آیا محیط ضعیف/قدیمی است؟ | `relaxed` | `strict` |
