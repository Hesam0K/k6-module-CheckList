/**
 * thresholds/factories.js — کارخانه‌های ساخت آستانهٔ سفارشی/تگ‌دار
 * ----------------------------------------------------------------------------
 * وقتی SLA هر Endpoint یا هر Business Flow متفاوت است، به‌جای ساختن چند Trend
 * سفارشی، همین پریست‌ها را با تگ مقیاس می‌کنیم.
 *
 * مستندات محلی : ../docs/03-thresholds-presets.md و ../docs/07-recipes.md
 * Wiki         : https://gitlab.partdp.ir/judicial-services/idadgar/backlog/-/wikis/k6-test-conditions-standard  (TODO)
 */

import { taggedKey } from '../shared/tags.js';
import { toEntryList, mergeThresholds, scopeToTag } from './helpers.js';

/**
 * SLA سفارشی روی یک متریک با چند تگ:
 *   taggedSla('http_req_duration', { 'flow:checkout': ['p(95)<2000'] })
 *   ⇒ { 'http_req_duration{flow:checkout}': ['p(95)<2000'] }
 */
export function taggedSla(metric, pairs) {
  const source = pairs || {};
  const result = {};

  Object.keys(source).forEach((tagSpec) => {
    result[`${metric}{${tagSpec}}`] = toEntryList(source[tagSpec]);
  });

  return result;
}

/** SLA تأخیر کسب‌وکار (http_req_duration). */
export function businessSla(pairs) {
  return taggedSla('http_req_duration', pairs);
}

/** SLA موفقیت کسب‌وکار (checks). */
export function checkSla(pairs) {
  return taggedSla('checks', pairs);
}

/** SLA روی هر متریک دلخواه. */
export function customSla(metric, pairs) {
  return taggedSla(metric, pairs);
}

/** اعمال یک پریست روی چند مقدار از یک تگ (مثلاً چند Endpoint یا چند Flow). */
export function scopeToMany(preset, tagName, values, mode) {
  const list = [].concat(values || []);
  const scoped = list.map((value) => {
    const tags = {};
    tags[tagName] = value;
    return scopeToTag(preset, tags, mode);
  });
  return mergeThresholds.apply(null, scoped);
}

/** SLA جداگانه برای هر Endpoint. */
export function perEndpoint(preset, endpoints, mode) {
  return scopeToMany(preset, 'endpoint', endpoints, mode);
}

/** SLA جداگانه برای هر Scenario. */
export function perScenario(preset, scenarios, mode) {
  return scopeToMany(preset, 'scenario', scenarios, mode);
}

/** SLA جداگانه برای هر Business Flow. */
export function perFlow(preset, flows, mode) {
  return scopeToMany(preset, 'flow', flows, mode);
}

/**
 * گارد نمونهٔ تگ‌محور (Counter-based).
 * برای گروهی از Check ها که با تگ مشخص می‌شوند، مطمئن می‌شویم حداقل یک نمونه
 * ثبت شده است؛ چون خودِ متریک checks (از نوع Rate) قابلیت count ندارد.
 */
export function tagScopedGuard(tags, options) {
  const settings = options || {};
  const metric = settings.metric || 'assert_total';
  const key = taggedKey(metric, tags);
  const result = {};
  result[key] = [settings.expression || 'count>0'];
  return result;
}

/**
 * پریست سریع از اعداد خام (برای کالیبراسیون موقت، بدون دست‌زدن به config/slo.js).
 *   adHocThresholds({ failedRate: 0.02, p95: 900, checksRate: 0.98 })
 */
export function adHocThresholds(numbers) {
  const n = numbers || {};
  const preset = { http_reqs: ['count>0'] };

  if (n.failedRate !== undefined) {
    preset.http_req_failed = [`rate<${n.failedRate}`];
  }
  if (n.avg !== undefined || n.p95 !== undefined || n.p99 !== undefined || n.max !== undefined) {
    const expressions = [];
    if (n.avg !== undefined) {
      expressions.push(`avg<${n.avg}`);
    }
    if (n.p95 !== undefined) {
      expressions.push(`p(95)<${n.p95}`);
    }
    if (n.p99 !== undefined) {
      expressions.push(`p(99)<${n.p99}`);
    }
    if (n.max !== undefined) {
      expressions.push(`max<${n.max}`);
    }
    preset.http_req_duration = expressions;
  }
  if (n.checksRate !== undefined) {
    preset.checks = [`rate>${n.checksRate}`];
  }
  if (n.allowDroppedIterations !== true) {
    preset.dropped_iterations = ['count==0'];
  }
  return preset;
}
