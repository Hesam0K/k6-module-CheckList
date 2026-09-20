# ویکی محلی — استانداردها و چکلیست شروط تست K6

> این پوشه «ویکی محلی» ماژول است و صفحات آن برای کپی مستقیم به Wiki گیتلب آماده شده‌اند
> (راهنمای انتشار: [`wiki/PUBLISHING.md`](wiki/PUBLISHING.md)).
> Wiki: https://gitlab.partdp.ir/judicial-services/idadgar/backlog/-/wikis/k6-test-conditions-standard (TODO: آدرس نهایی)
> ایشو مرجع: https://gitlab.partdp.ir/judicial-services/idadgar/backlog/-/issues/335

## نقشهٔ راه مطالعه

| # | فایل | برای کی؟ | خروجی مورد انتظار |
|---|---|---|---|
| ۰ | [`00-concepts.md`](00-concepts.md) | همه | تفاوت Check / Threshold / Tag و قواعد pass/fail و exit code ها |
| ۱ | [`01-tags-standard.md`](01-tags-standard.md) | همه | استاندارد تگ‌گذاری، تاکسونومی ۸ دسته، قواعد کاردینالیتی |
| ۲ | [`02-thresholds-catalog.md`](02-thresholds-catalog.md) | تسترها | جدول کامل متریک‌ها: نوع، aggregationهای مجاز، نمونهٔ معتبر |
| ۳ | [`03-thresholds-presets.md`](03-thresholds-presets.md) | تسترها | شرح تک‌تک ۱۶ پریست: کِی استفاده کنیم، کِی نه، نمونه کد |
| ۴ | [`04-checks-catalog.md`](04-checks-catalog.md) | تسترها | دسته‌بندی کامل شرط‌های اعتبارسنجی + سینتکس معتبر k6 |
| ۵ | [`05-checks-presets.md`](05-checks-presets.md) | تسترها | شرح ۱۳ بستهٔ Check + قواعد نام‌گذاری و تگ |
| ۶ | [`06-cli-analysis.md`](06-cli-analysis.md) | همه | چطور تگ‌ها را در خروجی ترمینال بخوانیم و تحلیل کنیم |
| ۷ | [`07-recipes.md`](07-recipes.md) | تسترها | دستور پخت: سناریوی تست → انتخاب پریست + کد آماده |
| ۸ | [`08-pitfalls.md`](08-pitfalls.md) | همه | تله‌های واقعی با خروجی تست‌شده (سبز شدن کاذب و…) |
| ۹ | [`09-integration.md`](09-integration.md) | lead ها | نگاشت به ساختار فریمورک مادر و CI |

## سه قانون طلایی (خلاصهٔ ۱۰ صفحه)

1. **هیچ آستانه‌ای بدون Sample Guard**: اگر آستانه نمونه نگیرد، k6 آن را سبز اعلام می‌کند
   (تأیید تجربی در `docs/08-pitfalls.md`). همهٔ پریست‌های این ماژول گارد دارند.
2. **تگ‌گذاری استاندارد و کم‌کاردینالیتی**: از `shared/tags.js` استفاده کنید، تگ دست‌ساز نسازید.
3. **اعداد فقط از `config/slo.js`**: کالیبراسیون با `-e SLO_P95_MS=...`، نه با ویرایش پریست‌ها.

## نگاشت سریع «هدف تست → فایل مرجع»

| می‌خواهم… | برو به |
|---|---|
| تست دود در CI | `03` → `smokeThresholds` + `examples/01` |
| SLA جدا برای هر Endpoint | `03` → `scopeToTag/perEndpoint` + `examples/02` |
| کشف نقطهٔ شکست | `03` → `breakpointThresholds` + `examples/08` |
| عیب‌یابی سرویس ناشناس | `03`+`05` → `diagnosticThresholds` + `examples/05` |
| گیت CI با توقف زودهنگام | `03` → `abortOnFailThresholds` + `examples/04` |
| اعتبارسنجی قرارداد/Schema | `04`+`05` → `contractChecks` + `examples/02` |
| SLA روی خانوادهٔ Check | `05`+`06` → `checks{type:...}` + `examples/06` |
| تحلیل خروجی ترمینال | `06` |
