# شروط تست — دستهٔ Checks (نسخهٔ Wiki)

> خلاصهٔ مستند `docs/04-checks-catalog.md` و `docs/05-checks-presets.md`

## الگوی استاندارد اجرای Check

```js
import { runChecks, healthChecks, CHECK_TYPE, SEVERITY, ON_FAIL } from '../modules/checks/index.js';

runChecks(res, healthChecks({ successStatuses: [200] }), {
  endpoint: 'login',
  flow: 'auth',
  type: CHECK_TYPE.availability,     // برای 'checks{type:...}'
  severity: SEVERITY.critical,       // برای 'checks{severity:critical}'
  onFail: ON_FAIL.warn,              // none | log | warn | throw | abort
});
```

## جدول شرطهای استاندارد (فشرده)

| دسته | شرط | predicate آماده |
|---|---|---|
| HTTP | وضعیت خاص/چندگانه/کمتراز400 | `statusEquals(201)` / `statusIn([200,201])` / `statusBelow400` |
| Body | وجود/عدم وجود متن، Regex | `bodyContains('success')` / `bodyNotContains('Exception')` / `bodyMatches(/token/i)` |
| JSON | اعتبار، فیلد، مقدار، نوع | `isJsonResponse` / `jsonHasPath('data.userId')` / `jsonPathEquals('success',true)` / `jsonPathType('total','integer')` |
| Payload | خالی نبودن، حداقل/حداکثر حجم | `bodyNotEmpty` / `bodySizeAtLeast(100)` / `bodySizeAtMost(50000)` |
| Header | وجود/مقدار/امنیتی/کش | `hasHeader('Content-Type')` / `headerEquals(...)` / `hasSecurityHeaders()` / `cacheControlIncludes('no-store')` |
| Cookie | وجود/فلگهای امنیتی | `hasCookie('session_id')` / `cookieHasFlag('session_id','httpOnly')` |
| Timing | duration/TTFB/TCP/TLS | `durationUnder(500)` / `waitingUnder(300)` / `connectingUnder(100)` / `tlsUnder(200)` |
| Redirect | سقف redirect | `redirectCountAtMost(3)` |
| Security | عدم نشت/SQL/نسخهٔ سرور | `noInformationLeak` / `noSqlError` / `noServerHeaderDisclosure` |
| Auth | توکن/JWT/انقضا | `tokenPresent` / `jwtWellFormed` / `jwtNotExpired` |
| Business | تراکنش/صفحه‌بندی/ترتیب/یکتایی | `transactionSucceeded` / `jsonPaginationValid` / `jsonSortedBy` / `jsonFieldsUnique` |
| Schema | قرارداد JSON | `matchesSchema({...})` (بدون AJV) |
| ترکیب | همه/یکی/نفی/شرطی | `allOf` / `anyOf` / `not` / `when` / `whenStatus` |

## بستههای آمادهٔ ۱۳گانه

`healthChecks`, `strictHealthChecks`, `diagnosticChecks`, `payloadChecks`, `contractChecks`,
`securityChecks`, `authChecks`, `crudChecks`, `paginationAndSortChecks`, `uploadChecks`,
`performanceChecks`, `resilienceChecks`, `businessChecks`

(پیکربندی هر بسته: `docs/05-checks-presets.md`)

## آستانههای خانوادهٔ Check + گارد

```js
thresholds: {
  'checks{type:contract}':            ['rate>0.99'],
  'checks{severity:critical}':        ['rate>0.999'],
  'assert_total{type:contract}':      ['count>0'],
  'assert_failed{severity:critical}': ['count==0'],
}
```

## یادآوری مهم

Check بهتنهایی exit code را تغییر نمیدهد؛ بدون آستانهٔ `checks: ['rate>...']`،
شکست 100٪ Checkها هم تست را سبز میکند.
