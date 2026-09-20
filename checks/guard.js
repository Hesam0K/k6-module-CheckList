/**
 * checks/guard.js — گارد نمونهٔ تگ‌محور برای بسته‌های Check
 * ----------------------------------------------------------------------------
 * مسئله: متریک checks از نوع Rate است و k6 برای Rate فقط aggregation «rate» را
 * قبول می‌کند؛ پس نمی‌توان نوشت 'checks{type:contract}': ['count>0'].
 * راه‌حل استاندارد این ماژول: یک Counter سبک (assert_total) با همان تگ‌ها.
 * نتیجه: 'assert_total{type:contract}': ['count>0'] → دیگر «سبز شدن کاذب»
 * برای خانوادهٔ Check هایی که هیچ‌وقت اجرا نشده‌اند رخ نمی‌دهد.
 *
 * مستندات محلی : ../docs/08-pitfalls.md و ../docs/02-thresholds-catalog.md
 * Wiki         : https://gitlab.partdp.ir/judicial-services/idadgar/backlog/-/wikis/k6-test-conditions-standard  (TODO)
 */

import { Counter } from 'k6/metrics';
import { buildTags, taggedKey } from '../shared/tags.js';

/** تعداد کل assertion های اجراشده به‌ازای هر گروه تگ. */
export const assertTotal = new Counter('assert_total');

/** تعداد assertion های شکست‌خورده به‌ازای هر گروه تگ. */
export const assertFailed = new Counter('assert_failed');

/**
 * ثبت آمار بستهٔ Check (برای گاردها).
 * @param {number} total تعداد کل check های اجراشده
 * @param {Record<string, string>} tags تگ‌های همان گروه
 * @param {number} [failedCount] تعداد check های شکست‌خورده
 */
export function countAsserts(total, tags, failedCount) {
  const clean = buildTags(tags);
  assertTotal.add(total, clean);
  if (failedCount !== undefined) {
    assertFailed.add(failedCount, clean);
  }
}

/**
 * آستانهٔ گارد برای یک گروه تگ‌دار.
 *   ...guardThreshold({ type: 'contract' })  ⇒ { 'assert_total{type:contract}': ['count>0'] }
 */
export function guardThreshold(tags, options) {
  const settings = options || {};
  const key = taggedKey(settings.metric || 'assert_total', tags);
  const result = {};
  result[key] = [settings.expression || 'count>0'];
  return result;
}

/** گارد سخت‌گیرانه: هیچ Check ای در این گروه نباید شکست بخورد. */
export function strictFailureGuard(tags, options) {
  const settings = options || {};
  const key = taggedKey(settings.metric || 'assert_failed', tags);
  const result = {};
  result[key] = [settings.expression || 'count==0'];
  return result;
}

/** گارد ترکیبی: هم «اجرا شده» و هم «بدون شکست» (برای Check های حیاتی). */
export function criticalGuard(tags) {
  return Object.assign({}, guardThreshold(tags), strictFailureGuard(tags));
}
