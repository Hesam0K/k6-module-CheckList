# k6-module.checks — استاندارد Checks و Thresholds برای تست فشار k6

فریمورک قابل‌استفادهٔ مجدد برای «شروط تست» در k6: پریست‌های آمادهٔ آستانه (Thresholds)،
بسته‌های آمادهٔ Check، استاندارد تگ‌ها، گارد ضد «سبز شدن کاذب» و مستندات ویکی محلی.

> **Wiki**: https://gitlab.partdp.ir/judicial-services/idadgar/backlog/-/wikis/k6-test-conditions-standard
> (TODO: پس از ساخت صفحهٔ فارسی در Wiki گیت‌لب، آدرس نهایی را اینجا و در هدر فایل‌ها به‌روزرسانی کنید)
>
> مرجع ایشو: https://gitlab.partdp.ir/judicial-services/idadgar/backlog/-/issues/335

## چرا این ماژول؟

- **یک متریک + چند تگ به‌جای چند Trend سفارشی**: آستانه روی زیرمتریک تگ‌دار بسته می‌شود
  (`http_req_duration{endpoint:login}`) و به‌صورت خودکار در Grafana/Prometheus هم قابل تفکیک است.
- **Sample Guard**: اگر آستانه‌ای هیچ نمونه‌ای نگیرد، k6 آن را «سبز» اعلام می‌کند؛ همهٔ پریست‌های
  این ماژول گارد Counter دارند تا این اتفاق نیفتد.
- **پریست‌های آماده برای هر هدف**: smoke / default / strict / breakpoint / stress / soak /
  diagnostic / network / backend / contract و…
- **Check های تگ‌دار با مدیریت خطای مشخص**: `checks{type:contract}: ['rate>0.99']` بدون کد اضافه.

## ساختار

```
├── index.js               نقطهٔ ورود کل ماژول
├── base-stress-test.js    ★ بویلرپلیت استاندارد (الگوی رسمی تیم)
├── config/slo.js          تنها منبع اعداد (SLO) + انتخاب پروفایل با ENV
├── shared/tags.js         استاندارد تگ‌ها (TAG / CHECK_TYPE / SEVERITY / …)
├── thresholds/            blocks + presets (۱۶ پریست) + factories + helpers
├── checks/                predicates + schema + presets (۱۳ بسته) + runner + guard
├── examples/              ۱۰ نمونهٔ اجرایی شماره‌دار
├── test/                  mock server + self-test + e2e runner + کیس‌های منفی
└── docs/                  ★ ویکی محلی (آمادهٔ انتقال به Wiki گیت‌لب)
```

## شروع سریع

```powershell
# ۱) اجرای همهٔ تست‌های ماژول (mock server + e2e، بدون هیچ وابستگی npm)
node test/run-e2e.mjs

# ۲) اجرای بویلرپلیت روی mock server
node test/mock-server.mjs          # در یک ترمینال دیگر
k6 run base-stress-test.js

# ۳) انتخاب پروفایل SLO بدون تغییر کد
k6 run -e K6_SLO_PROFILE=strict base-stress-test.js
```

## استفاده در سناریوی خودتان

```js
import { defaultThresholds, runChecks, healthChecks, CHECK_TYPE, SEVERITY } from './index.js';

export const options = {
  vus: 10,
  duration: '1m',
  thresholds: defaultThresholds,          // پریست آماده + Sample Guard
};

export default function () {
  const res = http.get('https://api.example.com/login', {
    tags: { endpoint: 'login', flow: 'auth' },   // تگ‌ها اینجا ست می‌شوند
  });
  runChecks(res, healthChecks({ successStatuses: [200] }), {
    endpoint: 'login',
    type: CHECK_TYPE.availability,
    severity: SEVERITY.critical,
  });
}
```

## مستندات (ویکی محلی)

- [`docs/README.md`](docs/README.md) — ایندکس و نقشهٔ راه
- [`docs/03-thresholds-presets.md`](docs/03-thresholds-presets.md) — شرح تک‌تک پریست‌های آستانه
- [`docs/05-checks-presets.md`](docs/05-checks-presets.md) — شرح بسته‌های Check
- [`docs/06-cli-analysis.md`](docs/06-cli-analysis.md) — تحلیل تگ‌ها در خروجی ترمینال
- [`docs/08-pitfalls.md`](docs/08-pitfalls.md) — تله‌های واقعی (با خروجی تست‌شده)
- [`docs/wiki/`](docs/wiki) — صفحات آمادهٔ کپی/پیست به Wiki گیت‌لب

## تست و اعتبارسنجی

| دستور | کار |
|---|---|
| `node test/run-e2e.mjs` | کل مجموعه: inspect + self-test + مثال‌ها + کیس‌های منفی (assert روی exit code) |
| `k6 run test/00-config-integrity.js` | اعتبارسنجی ساختار همهٔ پریست‌ها (۹۱ چک) |
| `k6 run test/self-test-checks.js` | تست predicate/schema/runner با پاسخ ساختگی |
| `node test/mock-server.mjs` | سرویس ساختگی برای اجرای محلی |

تست‌ها وابستگی npm ندارند؛ فقط Node + باینری k6.

## قواعد تیمی (خلاصه)

1. هیچ آستانه‌ای بدون Sample Guard نوشته نشود.
2. تگ‌ها کم‌کاردینالیتی باشند؛ تگ روی شناسهٔ یکتا ممنوع (`docs/01-tags-standard.md`).
3. فیلتر تگ در k6 فقط تطبیق دقیق است؛ Regex در آستانه‌ها پشتیبانی نمی‌شود.
4. اعداد SLA فقط از `config/slo.js` و override با `-e SLO_...` تغییر کند.
