# ۰۸) تلههای واقعی (Pitfalls) — با خروجی تستشده

> Wiki: https://gitlab.partdp.ir/judicial-services/idadgar/backlog/-/wikis/k6-test-conditions-standard (TODO)
> همهٔ موارد این صفحه روی k6 v1.2.1 (همین مخزن) بازتولید و تأیید شده‌اند.

## ۱) سبز شدن کاذب: آستانه روی «صفر نمونه» (Vacuous Pass) ★

اجرای یک اسکریپت بدون هیچ درخواست با این آستانهها:

```text
  █ THRESHOLDS
    checks
    ✓ 'rate>0.99' rate=0.00%          ← سبز شد با صفر نمونه!
    http_req_duration{endpoint:login}
    ✓ 'p(95)<1' p(95)=0s              ← سبز شد با صفر نمونه!
    http_reqs
    ✗ 'count>0' count=0               ← فقط Counter قرمز شد
```

- چرا؟ اگر زیرمتریک نمونهای نداشته باشد، ارزیابی آستانه «رد» میشود و pass تلقی میگردد.
- خروجی نهایی: `thresholds on metrics 'http_reqs' have been crossed` با exit code 99.
- **راهحل استاندارد ما:** Sample Guard روی Counter (`http_reqs count>0`) در همهٔ پریستها +
  گارد تگمحور `assert_total{tag}: ['count>0']` برای خانوادههای Check.

## ۲) درخواست ناموفق شبکه، نمونهٔ زمانی تولید نمیکند

با `connection refused`:

```text
    http_req_duration{endpoint:login}
    ✓ 'p(95)<5000' p(95)=0s     ← سبز کاذب
    http_req_failed.............: 100.00% 1 out of 1
```

- یعنی کندی/تایماوت را در `http_req_duration` «نمیبینید»؛ نتیجهٔ درست از
  `http_req_failed` و Checkهای `noTransportError` میآید.
- در `diagnosticThresholds` این ترکیب (گارد + خطای شبکه) پیشفرض است.

## ۳) Regex در فیلتر تگ پشتیبانی نمیشود

`{status:~5..}` در k6 معنی «همهٔ 5xx» ندارد؛ بهصورت **رشتهٔ لیترال** مقایسه میشود و
یک زیرمتریک بدون نمونه میسازد که کاذب سبز میشود. راهحل:

```js
'http_reqs{status:500}': ['count>0'],          // ذکر صریح
'http_reqs{status:503}': ['count>0'],
// یا:
'http_req_duration{expected_response:false}': ['p(95)<5000']
```

## ۴) `rate` روی Counter «بر ثانیه» نیست

```js
http_reqs: ['rate>0.5']   // یعنی 50٪ نمونهها ناصفر بوده‌اند، نه RPS!
```
برای توان عملیاتی: `http_reqs: ['count>1000']` کنار duration مشخص.

## ۵) چند Trend سفارشی بهجای تگ

```js
const loginTime = new Trend('login_time');
const productsTime = new Trend('products_time');   // ❌ انفجار متریک
```
استاندارد ما: **یک متریک + تگ**:

```js
const responseTime = new Trend('response_time');
responseTime.add(res.timings.duration, { endpoint: 'login' });
thresholds: { 'response_time{endpoint:login}': ['p(95)<400'] }
```

## ۶) p95 روی نمونهٔ کم

با ۵۰ نمونه، یک کندی ۳تایی، p95 را خراب میکند؛ با ۵۰ هزار نمونه معنا ندارد.
- برای gateهای رسمی حداقل چند هزار نمونه بگیرید (duration/vus را متناسب کنید).
- `max` را هم ببندید تا «درخواست سرگردان» از قلم نیفتد (`latencyCeiling`).

## ۷) کاردینالیتی بالا در تگها

تگ روی شناسهٔ یکتا (userId/requestId/URL پارامتری) = هزاران زیرمتریک =
کندی و بیمعنایی آستانه‌ها. راهحل: تگ کم‌کاردینالیتی + `tags.name` برای URL.
`warnOnRiskyTags()` هشدار میدهد.

## ۸) abortOnFail بیموقع

با `abortOnFail:true` بدون `delayAbortEval`، در چند ثانیهٔ اول (قبل از گرمشدن کش/اتصالها)
تست قطع میشود. همیشه delay بگذارید (پریستها این کار را خودکار انجام میدهند).

## ۹) آلودگی http_req_failed در تستهای منفی

اگر در تست منفی 401/500 «مورد انتظار» است، `http_req_failed` آلوده میشود:

```js
http.setResponseCallback(http.expectedStatuses(200, 401, 429, 500));
```
(نمونه: `examples/10-negative-and-chaos.js` — بدون این خط، مثال ۰۶ با 33% خطا قرمز میشد.)

## ۱۰) Check بهتنهایی تست را fail نمیکند

`check()` فقط آمار میسازد؛ بدون `thresholds: { checks: ['rate>0.99'] }` حتی 100٪ شکست
هم exit code 0 میدهد. (منبع رسمی k6: "checks do not affect the exit status")

## ۱۱) اجرای local پشت پروکسی سازمانی

اگر `HTTP_PROXY/HTTPS_PROXY` ست باشد، درخواستهای loopback ممکن است از پروکسی بروند
و به 502/timeout برسند. راهحل:

```powershell
$env:NO_PROXY='127.0.0.1,localhost'; k6 run examples/01-smoke.js
```
(`test/run-e2e.mjs` این کار را خودکار میکند.)

## ۱۲) `spawnSync` + سرور درهمان پروسه (درس تست این مخزن)

اگر mock server در همان پروسهٔ Node اجرا شود و k6 را با `spawnSync` اجرا کنید،
event loop قفل میشود و سرور به درخواستها پاسخ نمیدهد (تایماوت ۳۰ ثانیه).
راهحل: اجرای غیرهمزمان (`spawn`). این دقیقاً باگی بود که تست e2e گرفت.
