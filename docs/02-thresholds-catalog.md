# ۰۲) کاتالوگ متریکها و آستانهها (Thresholds Catalog)

> Wiki: https://gitlab.partdp.ir/judicial-services/idadgar/backlog/-/wikis/k6-test-conditions-standard (TODO)
> کد مرجع: [`thresholds/blocks.js`](../thresholds/blocks.js)

این جدول، نسخهٔ «نرمالسازی‌شده و تستشده» همان فهرست اولیهٔ ایشو است؛ ستون «مثال معتبر» دقیقاً
سینتکس قابل استفاده در k6 v1.2.1 است (aggregationهای نامعتبر با exit code 104 رد می‌شوند).

## متریکهای استاندارد k6

| متریک | نوع | Aggregation مجاز | مثال معتبر | توضیح |
|---|---|---|---|---|
| `http_req_duration` | Trend | `avg,min,max,med,p(N)` | `['p(95)<800','p(99)<1500','max<3000']` | زمان کل پاسخ |
| `http_req_waiting` | Trend | همان بالا | `['p(95)<300']` | TTFB (زمان فکر سرور) |
| `http_req_connecting` | Trend | همان بالا | `['avg<100']` | اتصال TCP |
| `http_req_tls_handshaking` | Trend | همان بالا | `['avg<200']` | دست‌دادن TLS |
| `http_req_blocked` | Trend | همان بالا | `['avg<50']` | انتظار برای سوکت آزاد |
| `http_req_sending` | Trend | همان بالا | `['avg<50']` | ارسال درخواست |
| `http_req_receiving` | Trend | همان بالا | `['avg<100']` | دریافت پاسخ |
| `iteration_duration` | Trend | همان بالا | `['p(95)<5000']` | زمان یک iteration کامل |
| `group_duration` | Trend | همان بالا | `['group_duration{group:::Login}':['avg<400']]` | زمان هر گروه |
| `http_req_failed` | Rate | فقط `rate` | `['rate<0.01']` | نرخ درخواست ناموفق (۲xx/۳xx نباشد) |
| `checks` | Rate | فقط `rate` | `['rate>0.99']`, `'checks{type:contract}':['rate>0.99']` | نرخ موفقیت Checkها |
| `http_reqs` | Counter | `count`, `rate` | `['count>0']` | تعداد/گارد نمونه |
| `iterations` | Counter | `count`, `rate` | `['count>0']`, `['count>1000']` | تعداد iteration |
| `dropped_iterations` | Counter | `count`, `rate` | `['count==0']` | ★ تشخیص اشباع |
| `data_received` / `data_sent` | Counter | `count`, `rate` | `['count>1000']` | حجم انتقال (بایت) |
| `vus` / `vus_max` | Gauge | فقط `value` | `['value>0']`, `['value<500']` | تعداد VU |

> `checks_total / checks_succeeded / checks_failed` فقط در summary نمایش داده میشوند و
> **در آستانهها قابل استفاده نیستند** (مستندات رسمی k6).

## متریکهای سفارشی (وقتی k6 چیزی را نمیداند)

| نیاز | نوع متریک | مثال آستانه | محل تعریف |
|---|---|---|---|
| نسبت Cache Hit | `Rate` | `'cache_hit':['rate>0.8']` | `examples/07` |
| زمان تراکنش Checkout | `Trend` | `'checkout_duration{flow:checkout}':['p(95)<2000']` | `examples/07` |
| موفقیت پرداخت | `Rate` | `'payment_success':['rate>0.995']` | `thresholds/presets.js` |
| تأخیر صف (Async) | `Trend` | `'queue_wait':['p(95)<100']` | `thresholds/presets.js` |
| گارد نمونهٔ خانوادهٔ Check | `Counter` | `'assert_total{type:contract}':['count>0']` | `checks/guard.js` |
| گارد «هیچ شکست حیاتی» | `Counter` | `'assert_failed{severity:critical}':['count==0']` | `checks/guard.js` |

## «در دسترس نبودن» مقیاسهایی که معمولاً درخواست میشود

| خواسته | واقعیت در k6 | راهکار استاندارد ما |
|---|---|---|
| RPS (`rate>100`) | `rate` روی Counter یعنی نسبت ناصفر، نه برثانیه | `http_reqs:['count>1000']` + duration مشخص |
| Timeout rate | متریک timeout وجود ندارد | تگ سیستمی `error`/`error_code` + متریک سفارشی با `error_class` |
| Retry rate | متریک retry وجود ندارد | شمارندهٔ سفارشی در منطق retry (`{retry:true}`) |
| Availability % | متریک آماده نیست | `http_req_failed:['rate<0.001']` (معادل 99.9٪) |
| DB query time | متریک آماده نیست | Trend سفارشی از response (اگر سرویس زمان را برگرداند) |

## ترفندهای کاربردی

**آستانه فقط روی پاسخهای موفق (بدون آلودگی خطاها):**

```js
'http_req_duration{expected_response:true}': ['p(95)<500']
```

**آستانه فقط روی یک گروه Business:**

```js
'group_duration{group:::Login}': ['avg<400']
'checks{group:::Login}':        ['rate>0.99']
```

**آستانهٔ گیت CI با توقف زودهنگام:**

```js
http_req_failed: [{ threshold: 'rate<0.01', abortOnFail: true, delayAbortEval: '60s' }]
```

## فرم بلند (abortOnFail)

```js
thresholds: {
  http_req_duration: [
    { threshold: 'p(95)<500', abortOnFail: true, delayAbortEval: '30s' },
  ],
}
```

هشدار: در اجرای k6 Cloud، ارزیابی آستانهها هر ۶۰ ثانیه است؛ یعنی توقف ممکن است تا ۶۰ ثانیه تأخیر بخورد.

## چه چیزی را خودکار چک کنیم؟

تابع `auditPreset(preset, name)` در `thresholds/helpers.js` این خطاها را قبل از اجرا پیدا میکند
(در `test/00-config-integrity.js` روی همهٔ پریستها اجرا میشود):

- نبود Sample Guard → هشدار «سبز شدن کاذب»
- نبود Error Budget → هشدار «خطاهای HTTP دیده نمیشوند»
- `count` روی `checks`/`http_req_failed` (Rate) → نامعتبر
- `p(N)` روی `http_req_failed` → نامعتبر
- غیر از `value` روی `vus` (Gauge) → نامعتبر
- `count` روی Trend → نامعتبر
