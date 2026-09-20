# ۰۶) تحلیل تگها در خروجی ترمینال (CLI)

> Wiki: https://gitlab.partdp.ir/judicial-services/idadgar/backlog/-/wikis/k6-test-conditions-standard (TODO)

راهنمای خواندن خروجی k6 برای اعضای تیم؛ همهٔ نمونهها از اجرای واقعی همین مخزن هستند.

## ۱) بخش THRESHOLDS

```text
  █ THRESHOLDS
    http_req_duration
    ✓ 'p(95)<800' p(95)=312.44ms
    http_req_duration{endpoint:login}
    ✓ 'p(95)<600' p(95)=88.12ms
    http_req_failed
    ✗ 'rate<0.01' rate=33.33%
```

- `✓` = پاس، `✗` = نقض (نقض ⇒ exit code 99).
- ردیفهای دندار `{...}` = **زیرمتریک تگدار**؛ فقط نمونههای با آن تگ.
- عبارت آستانه در کوتیشن همان چیزی است که در options نوشتید.

## ۲) بخش TOTAL RESULTS

```text
    http_req_duration........: avg=301ms min=88ms med=240ms max=1.2s p(90)=450ms p(95)=610ms
      { endpoint:login }.....: avg=95ms  ...
      { endpoint:products }..: avg=540ms ...
    http_req_failed..........: 0.00%  ✓ 0 ✗ 12
    http_reqs................: 120  4.1/s
    checks_total.............: 360
    checks_succeeded.........: 99.44%  ✓ 358 ✗ 2
```

نکات خواندن:

- ردیفهای `{ tag }` دقیقاً همان چیزی هستند که آستانهٔ تگدار روی آنها بسته میشود؛
  همیشه اول همین ردیفها را ببینید.
- `http_req_failed` دو شمارنده دارد: `✓ موفق / ✗ ناموفق`.
- `checks_succeeded` فقط نمایش است؛ در آستانه از `checks: ['rate>...']` استفاده کنید.
- اگر ردیف تگدار **اصلاً ظاهر نشد** یعنی آن تگ هیچ نمونه‌ای نداشته → آستانهٔ شما
  کاذب سبز است (بخش ۰۸ را ببینید و Sample Guard بگذارید).

## ۳) خروجی Checkها

```text
    ✓ login · status in [200]
      ↳  99% — ✓ 297 / ✗ 3
    ✓ products · matches response schema
      ↳  100% — ✓ 120 / ✗ 0
```

- نامها با قالب `endpoint · شرط` از `runChecks` میآیند → فیلتر در ترمینال آسان است.
- در حالت `--summary-mode full` جزئیات بیشتری از هر Check میبینید.

## ۴) پرچمهای مفید برای تحلیل

| دستور | کاربرد |
|---|---|
| `k6 run --summary-mode full script.js` | جزئیات کامل (شامل زیرمتریکهای تگدار حتی بدون آستانه) |
| `k6 run --summary-trend-stats "avg,p(95),p(99),max" ...` | انتخاب آمارههای trend در خروجی |
| `k6 run --summary-export result.json ...` | خروجی JSON برای مقایسهٔ اجراها/CI |
| `k6 run --tag env=staging ...` | تگ سطح تست از CLI (برای تمایز اجراها) |
| `k6 run --system-tags vu,iter,url ...` | فعالسازی تگهای سیستمی غیرپیشفرض |
| `k6 run --no-thresholds ...` | اجرای اکتشافی بدون fail شدن (مشاهدهٔ صرف) |
| `k6 inspect script.js` | اعتبارسنجی کانفیگ/آستانهها **بدون اجرا** |

## ۵) گزارش per-tag سفارشی (handleSummary)

بویلرپلیت `base-stress-test.js` خروجی زیر را چاپ میکند:

```text
نتیجهٔ آستانه‌ها (Thresholds):
  PASS  http_req_duration{endpoint:login} : p(95)<600
  FAIL  http_req_failed : rate<0.01
تفکیک تگ‌دار (Tag sub-metrics):
  http_req_duration{endpoint:login} → avg=92.3ms p(95)=130.1ms p(99)=201.7ms max=305.2ms
```

و یک فایل `k6-summary.json` برای Artifact در CI تولید میکند.

## ۶) خطاهای متداول ترمینال و معنی آنها

| پیام | معنی | راهحل |
|---|---|---|
| `unsupported aggregation method count on metric of type rate` | آستانهٔ نامعتبر (مثلاً `checks:['count>0']`) | از `rate` استفاده کنید؛ برای گارد از `assert_total` |
| `thresholds on metrics '...' have been crossed` (exit 99) | نقض آستانه | طبیعی؛ بررسی بخش THRESHOLDS |
| `no metric name "..." found` (exit 104) | آستانه روی متریک تعریفنشده | متریک سفارشی را تعریف/ثبت کنید |
| `thresholds on tags ... deprecated` | آستانه روی تگ غیرقابل فهرست | تگ کم‌کاردینالیتی استاندارد استفاده کنید |
| `Request Failed ... request timeout` | خطای شبکه/تایماوت | نمونهٔ زمانی تولید نمیشود؛ سراغ `http_req_failed` بروید |
