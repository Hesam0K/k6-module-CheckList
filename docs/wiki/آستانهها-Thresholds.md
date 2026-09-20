# آستانه‌ها — Thresholds (نسخهٔ Wiki)

> خلاصهٔ مستند `docs/02-thresholds-catalog.md` و `docs/03-thresholds-presets.md`

## جدول متریکها (تأییدشده روی k6 v1.2.1)

| متریک | نوع | aggregationهای مجاز | مثال معتبر |
|---|---|---|---|
| `http_req_duration` | Trend | avg,min,max,med,p(N) | `['avg<300','p(95)<800','p(99)<1500','max<3000']` |
| `http_req_waiting` | Trend | همان | `['p(95)<300']` (TTFB) |
| `http_req_connecting` | Trend | همان | `['avg<100']` |
| `http_req_tls_handshaking` | Trend | همان | `['avg<200']` |
| `http_req_blocked` | Trend | همان | `['avg<50']` |
| `http_req_sending` / `receiving` | Trend | همان | `['avg<50']` / `['avg<100']` |
| `iteration_duration` | Trend | همان | `['p(95)<5000']` |
| `group_duration` | Trend | همان | `'group_duration{group:::Login}':['avg<400']` |
| `http_req_failed` | Rate | فقط rate | `['rate<0.01']` |
| `checks` | Rate | فقط rate | `['rate>0.99']` / `'checks{type:contract}':['rate>0.99']` |
| `http_reqs` | Counter | count,rate | `['count>0']` (گارد) |
| `iterations` | Counter | count,rate | `['count>0']` / `['count>1000']` |
| `dropped_iterations` | Counter | count,rate | `['count==0']` ★ |
| `data_sent/received` | Counter | count,rate | `['count>1000']` |
| `vus` / `vus_max` | Gauge | فقط value | `['value>0']` / `['value<500']` |

> `checks_total/succeeded/failed` فقط در summary هستند و در آستانه قابل استفاده نیستند.

## فرم کوتاه و فرم بلند

```js
thresholds: {
  http_req_duration: ['avg<300', 'p(95)<800', 'p(99)<1500'],
  http_req_failed: [{ threshold: 'rate<0.01', abortOnFail: true, delayAbortEval: '60s' }],
}
```

## پریستهای ۱۶گانهٔ ماژول

| پریست | کاربرد |
|---|---|
| `devThresholds` | اجرای محلی، کمریسک |
| `smokeThresholds` | تست دود CI |
| `defaultThresholds` ★ | پیشفرض تیم |
| `strictThresholds` ★ | SLA سختگیرانه/پروداکشن‌گرید |
| `relaxedThresholds` | سرویس قدیمی/محیط ضعیف |
| `abortOnFailThresholds` ★ (`ciGateThresholds`) | گیت CI با توقف زودهنگام |
| `breakpointThresholds` | کشف نقطهٔ شکست (SLO=خط قطع) |
| `stressThresholds` / `spikeThresholds` / `soakThresholds` | فشار/جهش/پایداری |
| `diagnosticThresholds` | عیب‌یابی (بدون حساسیت به کندی) |
| `networkThresholds` / `backendThresholds` / `saturationThresholds` | لایهٔ شبکه/TTFB/اشباع مولد بار |
| `contractThresholds` | قرارداد و امنیت |
| کارخانهها: `businessSlaThresholds(...)`, `cacheAndQueueThresholds(...)` | SLA تگدار کسبوکار |

★ = پریست‌های پایهٔ مصوب ایشو. شرح کامل هر پریست («کِی استفاده / کِی نه»):
`docs/03-thresholds-presets.md`

## نرمالسازیهای مهم نسبت به فهرست اولیه

| عبارت رایج (نادرست در k6) | معتبر |
|---|---|
| `http_req_failed < 1%` | `http_req_failed: ['rate<0.01']` |
| `checks > 99%` | `checks: ['rate>0.99']` |
| `iterations > 1000` | `iterations: ['count>1000']` |
| `dropped_iterations == 0` | `dropped_iterations: ['count==0']` |
| `vus < 500` | `vus: ['value<500']` |
| RPS: `rate > 100` | متریک ندارد → `http_reqs: ['count>N']` + duration |
| `{status:~5..}` (Regex) | پشتیبانی نمیشود → ذکر صریح کدها یا `expected_response:false` |

## انتخاب پریست با ENV (برای CI)

```powershell
k6 run -e K6_SLO_PROFILE=strict base-stress-test.js
k6 run -e SLO_P95_MS=350 -e SLO_ERROR_RATE=0.005 base-stress-test.js
```
