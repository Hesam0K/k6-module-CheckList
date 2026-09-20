/**
 * thresholds/blocks.js — قطعات اتمی و قابل‌ترکیب threshold
 * ----------------------------------------------------------------------------
 * هر بلوک یک «تکهٔ کوچک» از یک پریست است؛ پریست‌ها از ترکیب همین‌ها ساخته می‌شوند
 * و با mergeThresholds قابل ترکیب‌اند (چون چند بلوک روی یک متریک مشترک‌اند).
 *
 * نکتهٔ کلیدی k6 (تأییدشده روی v1.2.1):
 *   Trend  → avg, min, max, med, p(N)      | Counter → count, rate
 *   Rate   → فقط rate                      | Gauge   → فقط value
 *   ⇒ هیچ‌گاه 'count>0' روی checks/http_req_failed بنویسید (خطای InvalidConfig).
 *
 * مستندات محلی : ../docs/02-thresholds-catalog.md
 * Wiki         : https://gitlab.partdp.ir/judicial-services/idadgar/backlog/-/wikis/k6-test-conditions-standard  (TODO)
 */

import { slo } from '../config/slo.js';
import { taggedKey } from '../shared/tags.js';

/**
 * Sample Guard — مهم‌ترین قطعهٔ این ماژول.
 * چرا لازم است؟ اگر یک آستانه هیچ نمونه‌ای نگیرد، k6 آن را «سبز» اعلام می‌کند
 * (vacuous pass). تنها راه امن ساختن گارد، استفاده از متریک‌های Counter است.
 */
export function sampleGuard(options) {
  const settings = options || {};
  const metric = settings.metric || 'http_reqs';
  const expression = settings.expression || 'count>0';
  const guard = {};
  guard[metric] = [expression];
  return guard;
}

/** گارد «تعداد Iteration» (برای سناریوهای کوتاه/بررسی اجرای واقعی). */
export function iterationsGuard() {
  return { iterations: ['count>0'] };
}

/** نرخ خطای مجاز (Error Budget) — متریک http_req_failed از نوع Rate است. */
export function errorBudget(budget) {
  const b = budget || slo();
  return { http_req_failed: [`rate<${b.failedRate}`] };
}

/** بودجهٔ تأخیر (Latency Budget) روی http_req_duration (Trend). */
export function latencyBudget(budget) {
  const b = budget || slo();
  return { http_req_duration: [`avg<${b.avg}`, `p(95)<${b.p95}`, `p(99)<${b.p99}`] };
}

/** سقف تأخیر (شکار درخواست‌های سرگردان/Hang). */
export function latencyCeiling(budget) {
  const b = budget || slo();
  return { http_req_duration: [`max<${b.max}`] };
}

/** نرخ موفقیت Check ها (متریک checks از نوع Rate است → فقط rate). */
export function checksReliability(budget) {
  const b = budget || slo();
  return { checks: [`rate>${b.checksRate}`] };
}

/** نرخ موفقیت Check های حیاتی (بر پایهٔ تگ استاندارد severity). */
export function criticalChecksReliability(budget) {
  const b = budget || slo();
  const key = taggedKey('checks', { severity: 'critical' });
  const result = {};
  result[key] = [`rate>${b.criticalChecksRate}`];
  return result;
}

/** نرخ موفقیت Check های قرارداد و امنیت (بر پایهٔ تگ استاندارد type). */
export function contractReliability(budget) {
  const b = budget || slo();
  const contractKey = taggedKey('checks', { type: 'contract' });
  const securityKey = taggedKey('checks', { type: 'security' });
  const result = {};
  result[contractKey] = [`rate>${b.criticalChecksRate}`];
  result[securityKey] = [`rate>${b.criticalChecksRate}`];
  return result;
}

/** لایهٔ بک‌اند: TTFB (http_req_waiting). */
export function backendLayer(budget) {
  const b = budget || slo();
  return {
    http_req_waiting: [`p(95)<${b.waitingP95}`, `p(99)<${b.waitingP99}`],
  };
}

/** لایهٔ شبکه: صف سوکت، اتصال TCP، دست‌دادن TLS، ارسال و دریافت. */
export function networkLayer(budget) {
  const b = budget || slo();
  return {
    http_req_blocked: [`avg<${b.blockedAvg}`],
    http_req_connecting: [`avg<${b.connectingAvg}`],
    http_req_tls_handshaking: [`avg<${b.tlsAvg}`],
    http_req_sending: [`avg<${b.sendingAvg}`],
    http_req_receiving: [`avg<${b.receivingAvg}`],
  };
}

/** گارد اشباع: هیچ Iteration ای نباید Drop شود (متریک Counter → count). */
export function saturationGuard() {
  return { dropped_iterations: ['count==0'] };
}

/** گارد بار داینامیک: ترکیب Drop + وجود Iteration. */
export function dynamicLoadGuard() {
  return { dropped_iterations: ['count==0'], iterations: ['count>0'] };
}

/** کف توان عملیاتی: حداقل تعداد درخواست در کل اجرا. */
export function throughputFloor(minCount) {
  return { http_reqs: [`count>${minCount}`] };
}

/** آستانهٔ متریک سفارشی از نوع Rate (مثل cache_hit یا payment_success). */
export function customRate(metric, minRate, tags) {
  const key = tags ? taggedKey(metric, tags) : metric;
  const result = {};
  result[key] = [`rate>${minRate}`];
  return result;
}

/** آستانهٔ متریک سفارشی از نوع Counter. */
export function customCounter(metric, expression, tags) {
  const key = tags ? taggedKey(metric, tags) : metric;
  const result = {};
  result[key] = [expression || 'count>0'];
  return result;
}

/** آستانهٔ متریک سفارشی از نوع Trend (زمان تراکنش کسب‌وکار). */
export function customTrend(metric, budgets, tags) {
  const b = budgets || {};
  const key = tags ? taggedKey(metric, tags) : metric;
  const expressions = [];
  if (b.avg !== undefined) {
    expressions.push(`avg<${b.avg}`);
  }
  if (b.p95 !== undefined) {
    expressions.push(`p(95)<${b.p95}`);
  }
  if (b.p99 !== undefined) {
    expressions.push(`p(99)<${b.p99}`);
  }
  if (b.max !== undefined) {
    expressions.push(`max<${b.max}`);
  }
  const result = {};
  result[key] = expressions;
  return result;
}

/** آستانهٔ روی یک متریک دلخواه با تگ دلخواه (بلوک پایه برای ساخت پریست سفارشی). */
export function tagBudget(metric, tags, expressions) {
  const key = taggedKey(metric, tags);
  const result = {};
  result[key] = [].concat(expressions);
  return result;
}
