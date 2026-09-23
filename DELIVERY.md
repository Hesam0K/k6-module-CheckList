# ایشو #335 — تحویل ماژول checks & thresholds (گزارش نهایی)

## خلاصهٔ تحویل

ماژول استاندارد «شروط تست» (Checks / Thresholds / Tags) برای k6، همراه با ویکی محلی و
مجموعهٔ تست خودکار. بدون وابستگی npm؛ k6 v1.2.1 + Node برای تستها.

- ریپو: `k6-module.checks`
- وضعیت تست: `node test/run-e2e.mjs` → **31/31 PASS** (inspect + self-test + مثالها + کیسهای منفی)

## ساختار تحویلشده

```
├── index.js                    نقطهٔ ورود کل ماژول
├── base-stress-test.js         ★ بویلرپلیت استاندارد (تسک ۲)
├── config/slo.js               تنها منبع اعداد + ۱۰ پروفایل بودجه
├── shared/tags.js              استاندارد تگها + اعتبارسنجی کاردینالیتی
├── thresholds/                 ۱۶ پریست + بلوکها + کارخانهها + helperها
├── checks/                     ~۶۰ predicate + schema + ۱۳ بسته + runner + گارد
├── examples/ (۱۰)              نمونههای اجرایی شماره‌دار (تسک ۲/۳)
├── test/                       mock server + self-test + e2e + ۳ کیس منفی
└── docs/ (۱۱) + docs/wiki (۵)  ★ ویکی محلی (تسک ۱) + راهنمای انتشار
```

## نگاشت به تسکهای ایشو

| تسک ایشو | تحویل |
|---|---|
| ۱- ویکی: «استانداردها و چکلیست شروط تست K6» | `docs/wiki/استانداردها-و-چکلیست-شروط-تست-K6.md` + ۳ صفحهٔ دیگر + `PUBLISHING.md` |
| ۱- راهنمای تحلیل تگ در CLI | `docs/06-cli-analysis.md` + بخش تحلیل در صفحهٔ Wiki تگها |
| ۲- بویلرپلیت `base-stress-test.js` | ریشهٔ مخزن؛ نسخهٔ ۳ (تگ در threshold + تگ در request + fail handling + handleSummary per-tag) |
| ۳- لینک متقابل Wiki↔کد | هدر همهٔ فایلها (`WIKI_URL` پلیسهولدر) + `PUBLISHING.md` (قاعدهٔ cross-link) |
| ۴- نهاییسازی | e2e سبز ۳۱/۳۱ + DoD در `docs/09-integration.md` |

## یافتههای فنی مهم (تأیید تجربی)

1. **Vacuous Pass**: آستانهٔ بدون نمونه «کاذب سبز» میشود؛ Sample Guard اجباری شد.
2. **aggregationها**: Rate فقط `rate` / Gauge فقط `value` / Trend بدون `count` / Counter با `count,rate`.
3. **فیلتر تگ فقط تطبیق دقیق** است؛ Regex (`{status:~5..}`) سبز کاذب میدهد.
4. **RPS متریک ندارد**؛ `rate` روی Counter یعنی نسبت ناصفر.
5. **درخواست ناموفق شبکه، نمونهٔ زمانی تولید نمیکند** (`duration` صفر میماند).
6. `abortOnFail` + `delayAbortEval` تست شد: توقف زودهنگام در ۲.۶s از 8s.

## دستورهای اجرا

```powershell
node test/run-e2e.mjs                       # کل مجموعه (≈۶۰-۸۰ ثانیه)
node test/mock-server.mjs                   # ترمینال ۱
k6 run base-stress-test.js                  # ترمینال ۲ (پروفایل پیشفرض)
k6 run -e K6_SLO_PROFILE=strict base-stress-test.js
k6 inspect <script.js>                      # اعتبارسنجی کانفیگ بدون اجرا
```

## ماندهٔ طرف تیم (خارج از مخزن)

1. ساخت ۴ صفحهٔ Wiki در گیتلب (`docs/wiki/PUBLISHING.md`)
2. جایگذاری آدرس نهایی Wiki در هدر فایلها (جستوجوی `k6-test-conditions-standard`)
3. کالیبراسیون اعداد `config/slo.js` بر اساس SLO واقعی سرویسها (فراشناسا/سفا)

---

## افزودنی (دور دوم تحویل) — تست واقعی سرویس gesture

### ۱) پیاده‌سازی اسکریپت تست دود واقعی — پوشهٔ `test-on-fara/smoke-test.js`

اسکریپت تست دود مستقل و تمیز بر اساس فریمورک `k6-module.checks` و منطق ارتباطی واقعی سرویس پیاده‌سازی شد:
- سناریوی بدون sleep و با ۵ کاربر مجازی برای اندازه‌گیری توان مداوم سرویس.
- تعریف آستانه‌های دوگانه کلیدی: `p(95) < 3000ms` و نرخ خطای `http_req_failed < 0.01`.
- اعتبارسنجی لایه انتقال (`healthChecks`) و قرارداد و ساختار داده‌ها (`contractChecks`) مطابق با ساختار پاسخ واقعی سرویس (`api response data.txt`).
- گزارش‌گیری ترکیبی شامل خلاصه پیش‌فرض k6، محاسبه توان عملیاتی لحظه‌ای (RPM) و بایگانی خودکار گزارش‌ها با برچسب زمان در پوشه `test-on-fara/reports/`.
- انتقال تمام لاگ‌ها و پیام‌های خروجی به زبان انگلیسی جهت جلوگیری از خطای یونیکد در محیط ترمینال ویندوز.

### ۲) رفع باگ در `base-stress-test.js` (باگ بی‌صدای تحویل قبلی)

`handleSummary` فرض می‌کرد `data.metrics[x].thresholds` آرایه است؛ در k6 v1.x این مقدار یک **مپ**
است (`{ 'p(95)<300': { ok: true } }`). نتیجه: خطای `Object has no member 'forEach'` در پایان تست،
عدم چاپ PASS/FAIL آستانه‌ها و عدم تولید `k6-summary.json` — و چون کد خروج `0` باقی می‌ماند،
تست‌های e2e قبلی آن را نگرفته بودند.

اصلاح:
- تابع `thresholdRowsOf()` که هم شکل مپ و هم آرایه را پشتیبانی می‌کند.
- تابع `ms()` برای قالب‌بندی امن آماره‌ها (مقاوم در برابر `--summary-trend-stats` سفارشی).

اعتبارسنجی مجدد: اجرای مستقیم `base-stress-test.js` (چاپ آستانه‌ها + تولید `k6-summary.json`)
و اجرای کل e2e: `total=31 passed=31 failed=0`.

### ۳) سخت‌سازی امنیتی

توکن هاردکدشده با `__ENV.API_KEY || 'MISSING-API-KEY'` جایگزین شد؛ هیچ فایل این پوشه توکن ندارد. توکنِ قبلی باید rotate شود.
پوشه و فایل‌های خروجی موقت تست نیز در `.gitignore` قرار گرفتند.
