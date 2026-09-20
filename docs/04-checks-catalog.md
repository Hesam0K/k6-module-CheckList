# ۰۴) کاتالوگ شرطهای اعتبارسنجی (Checks Catalog)

> Wiki: https://gitlab.partdp.ir/judicial-services/idadgar/backlog/-/wikis/k6-test-conditions-standard (TODO)
> کد مرجع: [`checks/predicates.js`](../checks/predicates.js)

هر ردیف این کاتالوگ یک predicate آماده در ماژول است؛ همه به شکل `(res) => boolean`.

## ۱) وضعیت HTTP (Status)

| شرط | predicate آماده | مثال دستی معادل |
|---|---|---|
| وضعیت خاص | `statusEquals(201)` | `r.status === 201` |
| چند وضعیت مجاز | `statusIn([200,201,204])` | `[200,201,204].includes(r.status)` |
| موفق (2xx) | `statusOk` | `r.status >= 200 && r.status < 300` |
| بدون خطای کلاینت | `statusBelow400` | `r.status < 400` |
| بدون خطای سرور | `statusNoServerError` | `r.status < 500` |
| خطای سرور (برای تست منفی) | `statusIsServerError` | `r.status >= 500` |
| خطای شبکه/تایماوت | `hasTransportError` / `noTransportError` | `r.error === ''` |

## ۲) بدنه و محتوا (Response Body / Payload)

| شرط | predicate | مثال دستی |
|---|---|---|
| وجود متن | `bodyContains('success')` | `r.body.includes('success')` |
| عدم وجود متن خطا | `bodyNotContains('Exception')` | `!r.body.includes(...)` |
| الگوی Regex | `bodyMatches(/token/i)` | `/token/i.test(r.body)` |
| خالی نبودن | `bodyNotEmpty` | `r.body.length > 0` |
| حداقل/حداکثر حجم | `bodySizeAtLeast(100)` / `bodySizeAtMost(50000)` | `r.body.length > 100` |
| بازهٔ حجم | `bodySizeBetween(100, 50000)` | — |
| JSON معتبر | `isJsonResponse` | `JSON.parse(r.body)` |
| وجود فیلد | `jsonHasPath('data.userId')` | `data.userId !== undefined` |
| مقدار فیلد | `jsonPathEquals('success', true)` | `data.success === true` |
| نوع فیلد | `jsonPathType('total', 'integer')` | `typeof data.total` |
| مقدار عددی | `jsonPathAbove('total', 0)` | `data.total > 0` |
| آرایهٔ غیرخالی | `jsonArrayNotEmpty('items')` | `data.items.length > 0` |

## ۳) لیستها، ترتیب و صفحهبندی (API Logic)

| شرط | predicate | سناریو |
|---|---|---|
| یکتایی فیلد | `jsonFieldsUnique('items','id')` | جلوگیری از داده تکراری |
| ترتیب نزولی/صعودی | `jsonSortedBy('items','createdAt','desc')` | Search/List API |
| صفحهبندی معتبر | `jsonPaginationValid({itemsPath,pagePath,sizePath,totalPath,expectedPage})` | Pagination |

## ۴) هدرها و کوکیها (Headers / Cookies)

| شرط | predicate | مثال دستی |
|---|---|---|
| وجود هدر | `hasHeader('Content-Type')` | `r.headers['Content-Type']` |
| مقدار هدر | `headerEquals('Content-Type','application/json')` | `===` |
| شامل مقدار | `headerIncludes('Cache-Control','no-store')` | — |
| نوع محتوا | `contentTypeIncludes('json')` / `contentTypeIncludes('application/pdf')` | MIME |
| Encoding | `charsetIsUtf8` | `charset=utf-8` |
| هدرهای امنیتی | `hasSecurityHeaders()` (پیشفرض: X-Content-Type-Options, X-Frame-Options, Referrer-Policy) | Security Headers |
| کنترل کش | `cacheControlIncludes('no-store')` | Cache Headers |
| وجود کوکی | `hasCookie('session_id')` | Session |
| فلگ کوکی | `cookieHasFlag('session_id','httpOnly')` / `('…','secure')` / `('…','sameSite','Strict')` | امنیت Session |

## ۵) زمانبندی (Timing)

| شرط | predicate | معادل متریک |
|---|---|---|
| زمان کل | `durationUnder(500)` | `r.timings.duration < 500` |
| TTFB | `waitingUnder(300)` | `r.timings.waiting < 300` |
| اتصال TCP | `connectingUnder(100)` | `r.timings.connecting` |
| TLS | `tlsUnder(200)` | `r.timings.tls_handshaking` |
| ارسال/دریافت | `sendingUnder(50)` / `receivingUnder(100)` | — |
| تعداد Redirect | `redirectCountAtMost(3)` / `redirectCountAtLeast(1)` | `r.redirects` |

## ۶) امنیت (Security Validation)

| شرط | predicate | چی را میگیرد |
|---|---|---|
| عدم نشت اطلاعات | `noInformationLeak` | stacktrace، مسیر سرور، `SQLException`، `ORA-`، … |
| بدون Stack Trace | `noStackTrace` | Traceback/stacktrace |
| بدون خطای SQL | `noSqlError` | SQLSTATE/SQLException/syntax error |
| بدون افشای نسخهٔ سرور | `noServerHeaderDisclosure` | `Server: Apache/2.4`, `X-Powered-By` |

## ۷) احراز هویت و کسبوکار (Auth / Business)

| شرط | predicate | سناریو |
|---|---|---|
| وجود توکن | `tokenPresent('token')` | Login |
| ساختار JWT | `jwtWellFormed('token')` | ۳ بخش Base64URL |
| انقضای JWT | `jwtNotExpired('token', skew)` | Token Refresh |
| وضعیت 401/403 | `unauthorizedResponse` | تست امنیتی منفی |
| وضعیت 404 / 409 / 429 | `notFoundResponse` / `conflictResponse` / `tooManyRequestsResponse` | CRUD/Rate-limit |
| وجود یکی از فیلدها | `hasAnyField(['orderId','paymentId'])` | تراکنش |
| موفقیت تراکنش | `transactionSucceeded({successPath,idPath})` | Checkout |

## ۸) ترکیبکنندهها

```js
import { allOf, anyOf, not, when, whenStatus } from '../checks/index.js';

allOf(statusOk, bodyContains('ok'))
anyOf(statusEquals(200), statusEquals(201))
not(statusIsServerError)
when(statusEquals(200), jsonHasPath('token'))
whenStatus(201, jsonHasPath('id'))
```

## قرارداد (Schema) — بدون AJV

`checks/schema.js` یک JSON-Schema مینیمال را پوشش میدهد:
`type, nullable, required, properties, additionalProperties, items, enum,
minLength/maxLength, pattern, minimum/maximum, minItems/maxItems, uniqueItems,
minProperties/maxProperties`.

```js
import { matchesSchema } from '../checks/index.js';

const predicates = {
  'response matches contract': matchesSchema({
    type: 'object',
    required: ['items'],
    properties: { items: { type: 'array', minItems: 1 } },
  }),
};
```

> نکته: AJV در k6 بهصورت پیشفرض موجود نیست؛ این validator وابستگی ندارد و در
> `test/self-test-checks.js` با چند حالت مثبت/منفی تست شده است.
