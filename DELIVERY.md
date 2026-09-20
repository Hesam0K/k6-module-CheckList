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
