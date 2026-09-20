# ۰۳) پریستهای آمادهٔ آستانه (Thresholds Presets)

> Wiki: https://gitlab.partdp.ir/judicial-services/idadgar/backlog/-/wikis/k6-test-conditions-standard (TODO)
> کد مرجع: [`thresholds/presets.js`](../thresholds/presets.js) — اعداد: [`config/slo.js`](../config/slo.js)

## نحوهٔ استفادهٔ سراسری

```js
import { defaultThresholds } from '../thresholds/index.js';
export const options = { thresholds: defaultThresholds };
```

```powershell
# انتخاب پریست بدون تغییر کد:
k6 run -e K6_SLO_PROFILE=strict base-stress-test.js

# کالیبراسیون عددی بدون تغییر کد:
k6 run -e SLO_P95_MS=350 -e SLO_ERROR_RATE=0.005 base-stress-test.js
```

هر پریست شامل **Sample Guard** است (`http_reqs: ['count>0']`) تا اگر اجرا هیچ نمونه‌ای
نگرفت، آستانه‌ها سبز کاذب نشوند (مستندات کامل: `08-pitfalls.md`).

## جدول انتخاب سریع

| پریست | دسته | سختگیری | بهترین کاربرد | ممنوع در |
|---|---|---|---|---|
| `devThresholds` | Profile | ⭐ | اجرای محلی، صحت‌سنجی اولیه | PR gate |
| `smokeThresholds` | Profile | ⭐⭐ | تست دود سریع در CI | استرس |
| `defaultThresholds` ★ | Profile | ⭐⭐⭐ | پیشفرض تیم، اکثر سناریوها | — |
| `strictThresholds` | Profile | ⭐⭐⭐⭐⭐ | پذیرش نهایی/پروداکشن‌گرید | محیط ضعیف |
| `relaxedThresholds` | Profile | ⭐ | سرویس قدیمی/مرحلهٔ اول | gate رسمی |
| `abortOnFailThresholds` ★ | Profile | ⭐⭐⭐ | گیت CI با توقف زودهنگام | تست اکتشافی |
| `ciGateThresholds` | Profile | ⭐⭐⭐ | نام مستعار abort preset | — |
| `breakpointThresholds` | Objective | SLO=خط قطع | کشف نقطهٔ شکست | تست کوتاه |
| `stressThresholds` | Objective | ⭐⭐ | فشار پایدار بالای ظرفیت | smoke |
| `spikeThresholds` | Objective | ⭐⭐ | جهش ناگهانی | تست طولانی |
| `soakThresholds` | Objective | ⭐⭐⭐ | اجرای طولانی/نشتی | CI (کوتاه است) |
| `diagnosticThresholds` | Objective | گشاده | عیب‌یابی سرویس ناشناس | gate |
| `networkThresholds` | Layer | ⭐⭐⭐ | مشکل زیرساخت/شبکه | بهتنهایی |
| `backendThresholds` | Layer | ⭐⭐⭐ | کندی بک‌اند (TTFB) | بهتنهایی |
| `saturationThresholds` | Layer | سخت | اشباع مولد بار | بهتنهایی |
| `contractThresholds` | Domain | ⭐⭐⭐⭐ | قرارداد/Schema/امنیت | اجرای بدون Check |
| `businessSlaThresholds(...)` | Domain | دلخواه | SLA هر Flow/Endpoint | — |
| `cacheAndQueueThresholds(...)` | Domain | دلخواه | Cache/صف/تراکنش | بدون متریک سفارشی |

★ = پریست‌های پایهٔ درخواستی ایشو (`defaultThresholds`, `strictThresholds`, `abortOnFailThresholds`)

// __CONTINUE__

## A) پروفایلهای اجرا (Base Profiles)

### `devThresholds` — اجرای محلی
- **هدف:** فقط مطمئن شویم سرویس بالا و پاسخگو است؛ سختگیری حداقلی.
- **محتوا:** `http_reqs count>0` + `http_req_failed rate<0.05` + `p(95)<3000` + `checks rate>0.9`
- **کِی استفاده کنیم:** توسعهٔ اسکریپت، اجرای اول روی سرویس جدید.
- **کِی نه:** بهعنوان gate رسمی (بسیار شل است).
- **نمونه:** `examples/01-smoke.js` با `-e K6_SLO_PROFILE=dev`.

### `smokeThresholds` — تست دود CI
- **هدف:** در ۳۰ ثانیه بفهمیم build سرویس را نشکسته؛ ریسک فلزِ مثبت کم.
- **محتوا:** `rate<0.01` + `p(95)<1500` + `max<6000` + `checks>0.95` + `dropped_iterations==0`
- **کِی:** بعد از هر deploy، قبل از تستهای سنگین.
- **کِی نه:** برای قضاوت دربارهٔ ظرفیت (نمونهٔ بسیار کمی دارد).
- **نمونه:** `examples/01-smoke.js`.

### `defaultThresholds` ★ — پیشفرض تیم
- **هدف:** SLO متعادل برای اکثر سناریوها.
- **محتوا:** `rate<0.01` + `avg<300` + `p(95)<800` + `p(99)<1500` + `max<3000`
  + `checks>0.99` + `checks{severity:critical}>0.999` + `dropped_iterations==0`
- **کِی:** تست منظم پس از هر release، پروفایل پایهٔ base-stress-test.
- **کِی نه:** روی سرویس با SLA رسمی متفاوت (عدد را از `config/slo.js` کالیبره کنید).

### `strictThresholds` — SLA سختگیرانه
- **هدف:** پذیرش نهایی/پروداکشن‌گرید؛ همهٔ لایه‌ها.
- **محتوا:** `rate<0.001` + `avg<200` + `p(95)<400` + `p(99)<800` + `checks>0.999`
  + `waiting p(95)<300` + شبکه (`blocked<20/connecting<50/tls<100/sending<20/receiving<50`)
  + `dropped_iterations==0`
- **کِی:** پذیرش release، سرویس با SLA رسمی.
- **کِی نه:** اولین بار روی محیط ضعیف/VPN (همیشه قرمز میشود؛ اول `relaxed` بعد سختگیر شوید).
- **نمونه:** `base-stress-test.js -e K6_SLO_PROFILE=strict`.

### `relaxedThresholds` — تحمل بیشتر
- **هدف:** مرحلهٔ اول پذیرش، سرویس قدیمی، محیط ضعیف.
- **محتوا:** `rate<0.05` + `p(95)<2000` + `checks>0.9`.

### `abortOnFailThresholds` ★ / `ciGateThresholds` — گیت CI
- **هدف:** اگر نرخ خطا از بودجه عبور کرد، تست **متوقف** شود (صرفه‌جویی زمان/منابع CI).
- **محتوا:** `http_req_failed` با `{abortOnFail:true, delayAbortEval:'60s'}` + بودجهٔ تأخیر + گاردها.
- **کِی:** job شبانه/گیت merge؛ سناریوهای طولانی.
- **کِی نه:** تست اکتشافی (میخواهیم همهٔ دادهها را ببینیم حتی وقتی خراب است).
- **نمونه:** `examples/04-ci-gate-abort.js`.

```js
// معادل دستی همین پریست (برای درک بهتر):
thresholds: {
  http_req_failed: [{ threshold: 'rate<0.01', abortOnFail: true, delayAbortEval: '60s' }],
  http_req_duration: ['avg<300', 'p(95)<800', 'p(99)<1500'],
  checks: ['rate>0.99'],
  dropped_iterations: ['count==0'],
  http_reqs: ['count>0'],
}
```

## B) پروفایلهای هدف (Test Objectives)

### `breakpointThresholds` — کشف نقطهٔ شکست
- **هدف:** بار پلهای بالا میرود؛ SLO به «خط قطع» تبدیل میشود. لحظهٔ توقف = نقطهٔ شکست.
- **محتوا:** `http_req_failed{abortOnFail}` + `http_req_duration p(95){abortOnFail}` + `checks>0.99`
- **کِی:** capacity planning؛ کنار executor `ramping-arrival-rate`.
- **کِی نه:** duration کوتاه (تا `delayAbortEval` نرسیده تمام میشود).
- **نمونه:** `examples/08-breakpoint.js`.

### `stressThresholds` / `spikeThresholds` / `soakThresholds`
| پریست | تفاوت کلیدی | هشدار |
|---|---|---|
| `stressThresholds` | تحمل خطای بیشتر (`rate<0.05`, `p95<1500`) اما بدون Drop | برای «حداکثر ظرفیت قابل قبول» |
| `spikeThresholds` | تحمل خطای لحظه‌ای (`rate<0.1`) + بدون Drop | برای جهش؛ duration کوتاه |
| `soakThresholds` | بودجهٔ طولانی (`delayAbortEval:120s`) + پایش افت تدریجی | k6 روند «رشد» را نمیسنجد؛ دو اجرای مقایسهای بگیرید (بخش ۰۷) |

### `diagnosticThresholds` — عیب‌یابی
- **هدف:** «آیا پاسخ سالم میگیریم؟» — تقریباً هرگز بهخاطر کندی fail نمیشود،
  اما اگر **هیچ درخواستی** ثبت نشود یا Checkها کاملاً بشکنند، قرمز میشود.
- **محتوا:** `http_reqs count>0` + `iterations count>0` + `rate<0.999` + `max<120000` + `checks>0.5`
- **کِی:** سرویس ناشناس، شروع عیب‌یابی، محیط بیتثبیت.
- **کِی نه:** gate (عمداً شل است).
- **نمونه:** `examples/05-diagnostic.js` (با `verbose` در runChecks).

## C) لایهها (Layers)

### `networkThresholds` — لایهٔ شبکه
- **هدف:** تشخیص مشکل زیرساخت (DNS/اتصال/TLS) جدا از بکاند.
- **محتوا:** `blocked avg<50` + `connecting avg<100` + `tls avg<200` + `sending avg<50` + `receiving avg<100`
- **کِی:** سرور برونمرزی/VPN/TLS کند؛ مقایسهٔ datacenter ها.
- **کِی نه:** بهتنهایی بهعنوان gate (عمداً فقط لایهٔ شبکه را میبندد).

### `backendThresholds` — لایهٔ بکاند (TTFB)
- **هدف:** کندی «کد/دیتابیس» را جدا از شبکه ببینیم (`http_req_waiting`).
- **محتوا:** `waiting p(95)<500, p(99)<1000` + بودجهٔ کل duration.

### `saturationThresholds` — اشباع مولد بار
- **هدف:** مطمئن شویم «مولد بار» خودش گلوگاه نشده (قبل از قضاوت سرویس).
- **محتوا:** `dropped_iterations count==0` + `iterations count>0` + `vus value>0` + `http_reqs count>1`
- **کِی:** با arrival-rate executor و تستهای سنگین؛ همیشه قبل از تحلیل نتیجه ببینید.
- **نکته:** اگر این پریست قرمز شود، **عددهای تست معتبر نیستند** (بار تولید نشده).

## D) دامنه (Domain)

### `contractThresholds` — قرارداد و امنیت
- **هدف:** SLA سختگیرانه روی «خانوادهٔ Checkهای قرارداد/امنیت».
- **پیشنیاز:** Checkهای خود را با `type: contract|security` اجرا کنید (runner خودکار میزند).
- **محتوا:** `checks{type:contract}>0.999` + `checks{type:security}>0.999`
  + `checks{severity:critical}>0.999` + `rate<0.01` + گارد.

### `businessSlaThresholds(options)` — SLA کسبوکار (کارخانه)

```js
import { businessSlaThresholds } from '../thresholds/index.js';

export const options = {
  thresholds: businessSlaThresholds({
    latency: {
      'flow:checkout':  ['p(95)<2000', 'p(99)<4000'],
      'endpoint:login': ['p(95)<400'],
    },
    success: {
      'flow:checkout': ['rate>0.995'],
      'flow:login':    ['rate>0.999'],
    },
  }),
};
```

- کلیدها باید **رشتهٔ تگ** باشند (`'flow:checkout'`).
- هر کلید روی دو متریک (duration و checks) همان تگ را میگیرد.
- `examples/03-api-flow.js` نمونهٔ کامل است.

### `cacheAndQueueThresholds(options)` — Cache/صف/تراکنش

```js
cacheAndQueueThresholds({
  cacheMetric: 'cache_hit',       cacheHitRatio: 0.8,
  queueMetric: 'queue_wait',      queueWaitP95Ms: 100,
  transactionMetric: 'payment_success', transactionSuccessRate: 0.995,
})
```

- متریک‌های سفارشی را باید در اسکریپت تعریف و **نمونه ثبت** کنید (`examples/07`).
- اگر متریک تعریف نشده باشد، k6 با exit 104 خطای «no metric name found» میدهد (خوب است!).

## helperهای ترکیب (خانوادهٔ scope)

```js
mergeThresholds(a, b)                    // ادغام امن + dedupe (نسخهٔ abort برنده است)
scopeToTag(preset, {endpoint:'login'})   // هم کلی و هم تگ‌دار
perEndpoint(preset, ['login','checkout'])// یک بودجه برای چند Endpoint
perScenario(preset, ['browse','buy'])    // تفکیک سناریو
perFlow(preset, ['auth','checkout'])     // تفکیک جریان کسبوکار
adHocThresholds({ p95: 900, failedRate: 0.02 })  // پریست سریع از اعداد خام
resolvePreset(name, registry)            // انتخاب پویا (پشتیبانی ENV)
```

- `examples/09-compose-and-scope.js` همهٔ اینها را نشان میدهد.
- `describePreset/explainPreset` برای چاپ ساختار آستانه در setup به کار میرود.


