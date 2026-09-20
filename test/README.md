# تستهای ماژول (`test/`)

همهٔ تستها بدون وابستگی npm هستند؛ فقط **Node** و **باینری k6** لازم است.

## اجرای همهچیز با یک دستور

```powershell
node test/run-e2e.mjs
```

خروجی این دستور:

| گروه | کار | معیار سبز بودن |
|---|---|---|
| `inspect` (۱۵ مورد) | اعتبارسنجی کانفیگ همهٔ مثالها/تستها بدون اجرا | exit code = 0 |
| self-test (۲ مورد) | `00-config-integrity` و `self-test-checks` | exit code = 0 |
| مثالها (۱۰ مورد) | اجرای واقعی روی mock server با بار سبک | exit code = 0 |
| بویلرپلیت | `base-stress-test.js` با پروفایل `strict` | exit code = 0 |
| کیسهای منفی (۳ مورد) | نقض عمدی آستانه / کانفیگ نامعتبر / abortOnFail | exit code = 99 / 104 / 99 |

## اجزا

| فایل | توضیح |
|---|---|
| `mock-server.mjs` | سرویس ساختگی (بدون وابستگی) با مسیرهای سالم/خطادار/کند/نشت. اجرای مستقیم: `node test/mock-server.mjs` (پورت پیشفرض ۸۰۸۰، با `-e` یا env `PORT` قابل تغییر) |
| `run-e2e.mjs` | هماهنگکننده: سرور را بالا میآورد، k6 را اجرا و exit code را assert میکند. پروکسی سازمانی را هم برای loopback خنثی میکند (`NO_PROXY`) |
| `00-config-integrity.js` | همهٔ پریستها/کارخانهها/بستههای check را میسازد و اعتبار aggregationها را میسنجد (۹۱ چک) |
| `self-test-checks.js` | تست predicate/schema/runner با پاسخهای ساختگی (بدون شبکه) |
| `cases/97-abort-on-fail.js` | باید **زودتر** از duration متوقف شود (exit 99) |
| `cases/98-invalid-config.js` | aggregation نامعتبر → خطای InvalidConfig (exit 104) |
| `cases/99-negative-thresholds.js` | نقض Error Budget → exit 99 |

## نکتههای مهم محیطی

- **پروکسی سازمانی**: اگر `HTTP_PROXY/HTTPS_PROXY` تنظیم است، برای اجرای دستی روی mock server
  از `NO_PROXY=127.0.0.1,localhost` استفاده کنید (در `run-e2e.mjs` بهصورت خودکار انجام میشود).
- **وقت اجرا**: کل مجموعه حدود ۶۰ تا ۸۰ ثانیه طول میکشد.
- برای اجرای یک مثال بهتنهایی:

```powershell
node test/mock-server.mjs          # ترمینال ۱
k6 run examples/02-tagged-thresholds.js   # ترمینال ۲
```

- عیبیابی خروجی: از `--summary-mode full` یا `--summary-export result.json` استفاده کنید
  (شرح کامل: `../docs/06-cli-analysis.md`).
