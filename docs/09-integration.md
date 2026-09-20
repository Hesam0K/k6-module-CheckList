# ۰۹) یکپارچهسازی با فریمورک مادر و CI

> Wiki: https://gitlab.partdp.ir/judicial-services/idadgar/backlog/-/wikis/k6-test-conditions-standard (TODO)

## نگاشت فایلها به ساختار `k6/` فریمورک مادر

طبق قاعدهٔ Merge تیم («منطق reusable → modules/») :

| در این مخزن | مقصد در فریمورک مادر |
|---|---|
| `thresholds/` | `k6/modules/thresholds/` (یا `k6/config/thresholds/`) |
| `checks/` | `k6/modules/checks/` |
| `shared/tags.js` | `k6/modules/shared/tags.js` |
| `config/slo.js` | `k6/config/slo.js` |
| `base-stress-test.js` | `k6/base-stress-test.js` (ریشهٔ k6) |
| `examples/` | `k6/examples/` |
| `test/` | `k6/test/` |
| `docs/` | Wiki گیتلب + `k6/docs/` |

## قاعدهٔ ایمپورت پس از ادغام

```js
// در سناریوهای فریمورک مادر:
import { defaultThresholds } from '../modules/thresholds/index.js';
import { runChecks, healthChecks, CHECK_TYPE } from '../modules/checks/index.js';
```

## الگوی CI (GitLab CI)

```yaml
k6-smoke:
  stage: test
  script:
    - k6 run -e K6_SLO_PROFILE=smoke -e BASE_URL=$STAGE_URL base-stress-test.js
  artifacts:
    when: always
    paths: [k6-summary.json]

k6-e2e-module:
  stage: test
  script:
    - node test/run-e2e.mjs
```

- معیار pass/fail = **exit code** k6 (0 سبز / 99 نقض آستانه / 104 کانفیگ نامعتبر).
- `k6-summary.json` از `handleSummary` بویلرپلیت برای Artifact تولید میشود.

## گردش کار «افزودن پریست جدید»

1. عدد را در `config/slo.js` اضافه کنید (نه داخل پریست).
2. پریست را در `thresholds/presets.js` از ترکیب بلوکها بسازید.
3. آن را به `THRESHOLD_PRESETS` اضافه کنید تا self-test پوشش دهد.
4. یک مثال شماره‌دار در `examples/` بسازید.
5. در `docs/03-thresholds-presets.md` یک بخش با قالب ثابت اضافه کنید.
6. `node test/run-e2e.mjs` را سبز کنید.

## گردش کار «افزودن بستهٔ Check جدید»

1. predicateهای لازم در `checks/predicates.js` (خالص، بدون k6).
2. بسته در `checks/presets.js` + ثبت در `CHECK_PRESETS`.
3. تست در `test/self-test-checks.js` (حالت مثبت و منفی).
4. بخش مستند در `docs/05-checks-presets.md`.

## چکلیست Definition of Done ماژول

- [ ] `node test/run-e2e.mjs` → `total=31 passed=31 failed=0`
- [ ] هیچ پریستی بدون Sample Guard نیست (تأیید `auditPreset`)
- [ ] هر پریست/بستهٔ Check در docs دارای بخش اختصاصی است
- [ ] اعداد جدید فقط از `config/slo.js` آمدهاند
- [ ] تگهای جدید از `TAG` آمده و `validateTags` پاس میشوند
- [ ] هدر فایلها لینک Wiki و docs محلی دارند

## نسخهٔ سازگاری

| ابزار | نسخهٔ تستشده |
|---|---|
| k6 | v1.2.1 (ویندوز/amd64) |
| Node | v22.15.0 (فقط برای تستها/mock server) |
| وابستگی npm | هیچ |
