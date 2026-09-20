# ۰۵) بستههای آمادهٔ Check (Checks Presets) و قواعد اجرا

> Wiki: https://gitlab.partdp.ir/judicial-services/idadgar/backlog/-/wikis/k6-test-conditions-standard (TODO)
> کد مرجع: [`checks/presets.js`](../checks/presets.js) و [`checks/runner.js`](../checks/runner.js)

## الگوی استفادهٔ استاندارد

```js
import { runChecks, healthChecks, CHECK_TYPE, SEVERITY, ON_FAIL } from '../checks/index.js';

const res = http.get(url, { tags: { endpoint: 'login', flow: 'auth' } });

runChecks(res, healthChecks({ successStatuses: [200] }), {
  endpoint: 'login',                 // ← در نام Check میآید: "login · status in [200]"
  flow: 'auth',                      // ← تگ flow (برای SLA کسبوکار)
  type: CHECK_TYPE.availability,     // ← تگ type (برای checks{type:...})
  severity: SEVERITY.critical,       // ← تگ severity (برای آستانهٔ حیاتی)
  onFail: ON_FAIL.warn,              // ← مدیریت خطا
});
```

## حالتهای مدیریت خطا (onFail)

| حالت | رفتار | کِی استفاده کنیم |
|---|---|---|
| `ON_FAIL.none` (پیشفرض) | فقط ثبت آمار | حالت عادی بارگذاری |
| `ON_FAIL.log` / `warn` | لاگ خلاصهٔ پاسخ در شکست | عیب‌یابی |
| `ON_FAIL.throw` | `fail()` → قطع iteration جاری | مسیرهای وابسته (بدون توکن ادامه بیهوده است) |
| `ON_FAIL.abort` | `exec.test.abort()` → توقف کل تست | خطای فاحش (setup ناموفق/آلودگی داده) |

با `verbose: true`، در لحظهٔ شکست، خلاصهٔ امن پاسخ (status/ttfb/bytes/url + بخشی از body)
لاگ میشود — بدون لاگکردن کل بدنه.

## قواعد نامگذاری و تگ (بسیار مهم)

- نام نهایی Check: `endpoint · prefix · نام` مثلاً `login · status in [200]`
  → در summary و در فیلتر `{check:...}` خوانا و فیلترپذیر است.
- تگهای استاندارد: `endpoint, flow, step, type, severity, phase, journey`
  (از `shared/tags.js`) + `extraTags` برای موارد خاص.
- اگر میخواهید آستانه روی یک خانوادهٔ Check ببندید، حتماً `type` را ست کنید.

## بستههای آماده (۱۳ بسته)

| بسته | هدف | Checkهای داخل |
|---|---|---|
| `healthChecks` | حداقلِ همهجا | پاسخ دریافتی، وضعیت مجاز، بدون خطای شبکه، بدنهٔ غیرخالی |
| `strictHealthChecks` | حالت سختگیرانه | سلامت + JSON معتبر + عدم نشت + هدرهای امنیتی + بازهٔ حجم |
| `diagnosticChecks` | عیب‌یابی | سلامت + بدون 5xx + عدم نشت + watchdog (duration/TTFB) |
| `payloadChecks` | محتوا | Content-Type، charset، بازهٔ حجم، Cache-Control |
| `contractChecks` | قرارداد | Schema + فیلدهای الزامی + نوع فیلدها + مقادیر مورد انتظار |
| `securityChecks` | امنیت | عدم نشت + هدرهای امنیتی + فلگهای کوکی + افشای نسخهٔ سرور |
| `authChecks` | احراز هویت | وجود توکن + ساختار JWT + عدم انقضا + کوکی نشست |
| `crudChecks` | CRUD | وضعیت create/read/update/delete + id + Location + بدنهٔ خالی حذف |
| `paginationAndSortChecks` | لیستها | صفحهبندی معتبر + یکتایی + ترتیب |
| `uploadChecks` | آپلود | وضعیت + fileId + MIME + سقف حجم |
| `performanceChecks` | کارایی تکی | بودجهٔ duration/TTFB + سقف redirect |
| `resilienceChecks` | آشوب/تست منفی | پذیرش 429/503 + Retry-After + بدون خطای شبکه |
| `businessChecks` | کسبوکار | فیلد موفقیت + شناسهٔ تراکنش + وضعیت مورد انتظار + عدم نشت |

## نمونههای پیکربندی هر بسته

```js
// قرارداد:
contractChecks({
  schema: { type: 'object', required: ['items'], properties: { items: { type: 'array' } } },
  requiredPaths: ['page', 'total'],
  nonEmptyArrayPaths: ['items'],
  typedPaths: { page: 'integer', total: 'integer' },
  expectedValues: { page: 1 },
})

// امنیت:
securityChecks({ cookieName: 'session_id', sameSite: 'Strict', requireSecureCookie: true })

// CRUD:
crudChecks({ createdStatus: 201, readStatus: 200, updateStatus: 200, deleteStatus: 204,
             idPath: 'id', locationHeader: true, notFoundStatus: 404, expectedId: 'p-1' })

// صفحهبندی:
paginationAndSortChecks({ itemsPath: 'items', uniqueField: 'id',
                          sortField: 'createdAt', direction: 'desc', expectedPage: 1 })

// استقامت:
resilienceChecks({ toleratedStatuses: [429, 503], requireRetryAfter: true })
```

## گاردهای خانوادهٔ Check (assert_total / assert_failed)

متریک `checks` از نوع Rate است و `count` را قبول نمیکند؛ برای «گارد اجراشدن» و
«گارد بدون شکست» یک خانوادهٔ Check، از شمارندههای خودکار runner استفاده کنید:

```js
import { guardThreshold, strictFailureGuard, criticalGuard } from '../checks/index.js';

thresholds: {
  'checks{type:contract}':        ['rate>0.99'],
  'assert_total{type:contract}':  ['count>0'],      // این خانواده واقعاً اجرا شد؟
  'assert_failed{severity:critical}': ['count==0'], // هیچ Check حیاتی نشکست؟
}
```

`examples/06-checks-with-guards.js` الگوی کامل + تأیید e2e.

## ترکیب بستهها

```js
import { combineChecks, healthChecks, securityChecks } from '../checks/index.js';

const bundle = combineChecks(healthChecks(), securityChecks({ cookieName: 'session_id' }));
runChecks(res, bundle, { endpoint: 'login', type: CHECK_TYPE.security });
```


