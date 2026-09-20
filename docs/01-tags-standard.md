# ۰۱) استاندارد تگ‌ها (Tags Standard)

> Wiki: https://gitlab.partdp.ir/judicial-services/idadgar/backlog/-/wikis/k6-test-conditions-standard (TODO)
> کد مرجع: [`shared/tags.js`](../shared/tags.js)

## چرا تگ بهتر از چند Trend سفارشی است؟

| نسخه | رویکرد | مشکل / مزیت |
|---|---|---|
| ۱ (قدیمی) | یک Trend سفارشی برای هر Endpoint | انفجار متریک، thresholdهای پراکنده، تحلیل سخت |
| ۲ (استاندارد ما) | **یک متریک + تگ** و آستانه روی زیرمتریک تگ‌دار | مقیاس‌پذیر، تحلیل per-tag در ترمینال و Grafana |

```js
// نسخهٔ استاندارد:
const res = http.get(url, { tags: { endpoint: 'login' } });
thresholds: { 'http_req_duration{endpoint:login}': ['p(95)<400'] }
```

## تگهای سیستمی k6 (پیشفرض فعال)

`proto, subproto, status, method, url, name, group, check, error, error_code,
tls_version, scenario, service, expected_response`

- تگ‌های `vu`, `iter`, `ip` به‌صورت پیشفرض **فعال نیستند**؛ با `--system-tags` اضافه می‌شوند.
- تگ `group` مقدارش مسیر کامل گروه است (با پیشوند `::`) → فیلتر صحیح: `{group:::Login}`.
- تگ `name` با URL Grouping ست می‌شود و بهترین جایگزین برای تگ‌کردن URLهای پارامتری است:

```js
import http from 'k6/http';
http.get(`https://api.example.com/products/${id}`, {
  tags: { name: 'GET /products/:id' },   // یک نام پایدار به‌جای id یکتا
});
```

## تاکسونومی ۸گانهٔ تگها (استاندارد تیم)

| دسته | تگ‌ها | مثال مقدار | کاربرد |
|---|---|---|---|
| Technical | `method, status, host, name, group, protocol` | `POST`, `auth-service` | خودکار توسط k6 |
| Business | `flow, transaction, journey, endpoint` | `checkout`, `login` | SLA تراکنش |
| Environment | `env, region, cluster` | `staging`, `eu-west` | مقایسهٔ اجراها |
| User | `user_type, tenant` | `premium`, `enterprise` | مسیرهای متفاوت کاربر |
| SLA | `priority, severity` | `critical` | آستانهٔ سخت‌گیرانه‌تر |
| Architecture | `service, dependency, channel` | `payment`, `stripe` | جداسازی سرویس |
| Execution | `scenario, phase, step` | `peak`, `warmup` | تحلیل فاز اجرا |
| Monitoring | `retry, cache, async` | `hit`, `true` | تحلیل پایداری/کش |

ثابت‌های آماده در `shared/tags.js`: `TAG`, `CHECK_TYPE`, `SEVERITY`, `PHASE`, `TAG_CATEGORIES`.

## قاعدهٔ طلایی: کاردینالیتی پایین

هر مقدارِ جدیدِ یک تگ = یک زیرمتریک جدید. پس:

| مجاز ✅ | ممنوع ❌ |
|---|---|
| `endpoint: login` | `user_id: 48213` |
| `flow: checkout` | `request_id: 8f3a-…` |
| `phase: steady` | `url: /products/48213` (بهجایش `tags.name`) |
| `status: 500` | `timestamp: 2026-…` |

`validateTags()`/`warnOnRiskyTags()` در `shared/tags.js` همین قواعد را به‌صورت خودکار چک می‌کنند
(الگوهای UUID/Hex طولانی را هشدار میدهند).

## قواعد فیلتر تگ در آستانهها (تأییدشده روی v1.2.1)

1. فقط **تطبیق دقیق** `{key:value}` و چند تگ با کاما: `'http_req_duration{endpoint:login,env:staging}'`
2. **Regex پشتیبانی نمیشود.** عبارت `{status:~5..}` به‌صورت رشتهٔ لیترال مقایسه میشود و
   نتیجه یک زیرمتریکِ بدون نمونه است که **کاذب سبز میشود**. جایگزین‌های درست:
   - ذکر صریح: `'http_reqs{status:500}'`, `'http_reqs{status:503}'`
   - استفاده از `expected_response:false` (تگ سیستمی) برای «همهٔ پاسخهای ناخواسته»
   - متریک سفارشی با تگ کلاس خطا (`error_class: timeout`)
3. اگر تگ هیچ نمونه‌ای نداشته باشد، زیرمتریک سبز میشود → **Sample Guard** اجباری است
   (جزئیات در `08-pitfalls.md`).

## تگگذاری در سه لایه

```js
// ۱) سطح تست (همهٔ نمونهها) — برای env/region/version در مقایسهٔ اجراها
export const options = {
  tags: { env: 'staging', api_version: 'v2' },
};

// ۲) سطح درخواست/Check — برای SLA تگ‌دار (استاندارد اصلی ما)
http.get(url, { tags: { endpoint: 'login', flow: 'auth' } });
check(res, preds, { endpoint: 'login', type: 'contract' });

// ۳) سطح متریک سفارشی — همان تگهای استاندارد
const trend = new Trend('checkout_duration');
trend.add(value, { flow: 'checkout' });
```

## چکلیست review تگها

- [ ] همهٔ کلیدها از `TAG` آمده‌اند؟ (تگ دستساز ممنوع)
- [ ] هیچ مقداری id یکتا/UUID/timestamp نیست؟ (`validateTags`)
- [ ] برای هر تگِ استفادهشده در آستانه، **Sample Guard** وجود دارد؟
- [ ] برای URLهای پارامتری از `tags.name` استفاده شده؟
- [ ] تگهای سطح تست (env/region) برای مقایسهٔ اجراها ست شده؟
