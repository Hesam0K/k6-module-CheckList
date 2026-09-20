# تگ‌ها و تحلیل خروجی CLI (نسخهٔ Wiki)

> خلاصهٔ مستند `docs/01-tags-standard.md` و `docs/06-cli-analysis.md`

## چرا تگ به‌جای چند Trend؟

| | چند Trend سفارشی | یک متریک + تگ |
|---|---|---|
| تعریف | هر Endpoint یک Trend | یک متریک، چند تگ |
| آستانه | N آستانهٔ مستقل | آستانه روی زیرمتریک تگ‌دار |
| تحلیل در Grafana/Prometheus | سخت (متریک پراکنده) | آسان (فیلتر تگ) |
| مقیاس‌پذیری | ضعیف | عالی |

## تاکسونومی ۸گانه

| دسته | تگ‌ها |
|---|---|
| Technical | `method, status, host, name, group, protocol` |
| Business | `flow, transaction, journey, endpoint` |
| Environment | `env, region, cluster` |
| User | `user_type, tenant` |
| SLA | `priority, severity` |
| Architecture | `service, dependency, channel` |
| Execution | `scenario, phase, step` |
| Monitoring | `retry, cache, async` |

## قواعد الزامی

1. کلید تگ فقط از `shared/tags.js` (ثابت `TAG`).
2. کاردینالیتی پایین؛ شناسهٔ یکتا/UUID/تایم‌استمپ ممنوع.
3. URL پارامتری → `tags.name` (URL Grouping)، نه تگ URL.
4. فیلتر در آستانه فقط تطبیق دقیق `{key:value}` (چند تگ با کاما)؛ **Regex ندارد**.
5. هر تگِ استفاده‌شده در آستانه باید Sample Guard داشته باشد.

```js
// استاندارد:
http.get(url, { tags: { endpoint: 'login', flow: 'auth' } });
thresholds: { 'http_req_duration{endpoint:login}': ['p(95)<400'] }
```

## تحلیل خروجی ترمینال

```text
  █ THRESHOLDS
    http_req_duration{endpoint:login}
    ✓ 'p(95)<600' p(95)=88.12ms
    http_req_failed
    ✗ 'rate<0.01' rate=33.33%

    http_req_duration........: avg=301ms p(95)=610ms
      { endpoint:login }.....: avg=95ms      ← زیرمتریک تگ‌دار
      { endpoint:products }..: avg=540ms
```

- `✓/✗` = پاس/نقض (نقض ⇒ exit 99)
- ردیفهای `{...}` همان زیرمتریک‌های تگ‌دار هستند
- **اگر ردیف تگ‌دار اصلاً دیده نشد** یعنی آن تگ نمونه‌ای نداشته و آستانه کاذب سبز است

## پرچمهای CLI پرکاربرد

```powershell
k6 run --summary-mode full script.js                     # جزئیات کامل
k6 run --summary-trend-stats "avg,p(95),p(99),max" ...   # انتخاب آماره‌ها
k6 run --summary-export result.json ...                  # خروجی JSON برای CI
k6 run --tag env=staging ...                             # تگ سطح تست
k6 run --system-tags vu,iter,url ...                     # تگ‌های سیستمی اضافه
k6 inspect script.js                                     # اعتبارسنجی بدون اجرا
```

## تله‌های مرتبط با تگ

| تله | نتیجه | راهحل |
|---|---|---|
| Regex در فیلتر (`{status:~5..}`) | زیرمتریک بدون نمونه → سبز کاذب | ذکر صریح کد وضعیت |
| تگ با کاردینالیتی بالا | انفجار زیرمتریک | تگ کم‌مقدار + `tags.name` |
| آستانهٔ تگ‌دار بدون گارد | سبز کاذب | `assert_total{tag}: ['count>0']` |
