# ۰۰) مفاهیم پایه: Check در برابر Threshold در برابر Tag

> Wiki: https://gitlab.partdp.ir/judicial-services/idadgar/backlog/-/wikis/k6-test-conditions-standard (TODO)

## سه لایهٔ «شروط تست» در k6

| لایه | چه می‌کند | روی چه داده‌ای | اثر بر exit code |
|---|---|---|---|
| **Check** | اعتبارسنجی نقطه‌ای روی هر پاسخ (assertion) | آبجکت پاسخ (`res.status`, `res.body`, …) | ❌ هیچ (فقط ثبت آمار) |
| **Threshold** | تعریف معیار pass/fail برای کل تست | متریک‌ها (پیش‌فرض یا سفارشی) | ✅ کد ۹۹ در صورت نقض |
| **Tag** | برچسب‌گذاری برای تفکیک/فیلتر | روی Check، درخواست، متریک و آستانه | — (ابزار تفکیک) |

نکتهٔ کلیدی: **Check بهتنهایی تست را fail نمی‌کند.** برای fail شدن باید آستانهٔ `checks` داشته باشید:

```js
export const options = {
  thresholds: { checks: ['rate>0.99'] },   // نرخ موفقیت Check ها
};
```

## ساختار متریک‌ها (برای نوشتن آستانهٔ درست)

هر متریک یک **نوع** دارد و هر نوع فقط aggregationهای مشخصی را قبول می‌کند
(تأیید تجربی روی k6 v1.2.1؛ در صورت خطا k6 با exit code 104 متوقف می‌شود):

| نوع | aggregationهای مجاز | مثال متریک |
|---|---|---|
| **Trend** | `avg`, `min`, `max`, `med`, `p(N)` | `http_req_duration`, `http_req_waiting`, `iteration_duration` |
| **Counter** | `count`, `rate` | `http_reqs`, `iterations`, `dropped_iterations`, `data_sent` |
| **Rate** | فقط `rate` | `checks`, `http_req_failed` |
| **Gauge** | فقط `value` | `vus`, `vus_max` |

خطای واقعی k6 (برای اطمینان):

```text
ERRO[0000] invalid threshold "count>0" applied on metric checks;
reason: unsupported aggregation method count on metric of type rate.
supported aggregation methods for this metric are: rate
```

نکتهٔ مهم دربارهٔ `rate` روی Counter: معنی آن «نسبت نمونه‌های ناصفر» است، **نه «بر ثانیه»**.
پس «RPS» را نمی‌توان مستقیم با آستانه بست؛ جایگزین: `http_reqs: ['count>1000']` (کل اجرا).

## آستانه روی متریک پیشفرض در برابر متریک سفارشی

```js
export const options = {
  thresholds: {
    // متریک‌های پیش‌فرض (بدون کد اضافه):
    http_req_failed:  ['rate<0.01'],
    http_req_duration: ['p(95)<800', 'p(99)<1500'],
    checks: ['rate>0.99'],
    dropped_iterations: ['count==0'],
    // متریک سفارشی (وقتی چیزی را اندازه می‌گیریم که k6 نمی‌داند):
    checkout_duration: ['p(95)<2000'],
    cache_hit: ['rate>0.8'],
  },
};
```

## فرم کوتاه و فرم بلند آستانه

```js
thresholds: {
  // فرم کوتاه
  http_req_duration: ['p(95)<500', 'p(99)<1000'],
  // فرم بلند: توقف زودهنگام برای گیت CI
  http_req_failed: [
    { threshold: 'rate<0.01', abortOnFail: true, delayAbortEval: '60s' },
  ],
}
```

- `abortOnFail: true` → به‌محض نقض، اجرا متوقف می‌شود (صرفه‌جویی منابع CI).
- `delayAbortEval` → چند ثانیه اول را نادیده بگیر تا نمونه کافی جمع شود.

## exit code های k6 (تأییدشده در همین مخزن)

| کد | معنی | کِی می‌بینیم |
|---|---|---|
| `0` | تست موفق | همهٔ آستانه‌ها پاس |
| `99` | نقض آستانه | `thresholds on metrics '…' have been crossed` |
| `104` | کانفیگ نامعتبر | aggregation نامعتبر / متریک ناموجود / خطای init |
| غیرصفر دیگر | خطای اسکریپت/اجرا | exception در init یا حین اجرا |

در CI همین کدها «گیت» می‌شوند؛ `examples/04` و `test/cases/*` الگوی آن هستند.

## رابطهٔ Check و Threshold و Tag در این ماژول

```js
// ۱) Check با تگ استاندارد (runner خودش تگ می‌زند):
runChecks(res, healthChecks(), { endpoint: 'login', type: CHECK_TYPE.contract, severity: SEVERITY.critical });

// ۲) آستانه روی همان خانوادهٔ Check با فیلتر تگ:
thresholds: {
  'checks{type:contract}':   ['rate>0.99'],
  'checks{severity:critical}': ['rate>0.999'],
  'assert_total{type:contract}': ['count>0'],   // گارد نمونه (بخش ۰۸ را ببینید)
}
```

یعنی همان «نسخهٔ ۳» ایشو مرجع: **تگ در درخواست، آستانه روی متریک تگ‌دار، Check با مدیریت خطا.**

## ادامهٔ مسیر

- برای استاندارد تگ‌ها → [`01-tags-standard.md`](01-tags-standard.md)
- برای جدول کامل متریک‌ها → [`02-thresholds-catalog.md`](02-thresholds-catalog.md)
