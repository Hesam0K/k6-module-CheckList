/**
 * checks/messages.js — پیام‌ها و خلاصهٔ پاسخ برای عیب‌یابی
 * ----------------------------------------------------------------------------
 * در اجرای «diagnostic» مهم است که در لحظهٔ شکست Check، بدانیم سرویس چه
 * برگردانده است. این ماژول خلاصهٔ امن و کوتاه می‌سازد (بدون لاگ کردن داده حساس).
 *
 * مستندات محلی : ../docs/05-checks-presets.md و ../docs/06-cli-analysis.md
 * Wiki         : https://gitlab.partdp.ir/judicial-services/idadgar/backlog/-/wikis/k6-test-conditions-standard  (TODO)
 */

import { bodyLength, truncate } from './internals.js';

const DEFAULT_MAX_BODY = 500;

/**
 * خلاصهٔ یک‌خطی از پاسخ برای لاگ.
 * @param {object} res پاسخ k6
 * @param {{maxBodyLength?: number, includeHeaders?: boolean}} [options]
 */
export function summarizeResponse(res, options) {
  const settings = options || {};
  const maxBody = settings.maxBodyLength || DEFAULT_MAX_BODY;

  if (!res) {
    return 'response=<null>';
  }

  const parts = [];
  parts.push(`status=${res.status}`);
  parts.push(`duration=${res.timings && res.timings.duration !== undefined ? Math.round(res.timings.duration) : '?'}ms`);
  parts.push(`ttfb=${res.timings && res.timings.waiting !== undefined ? Math.round(res.timings.waiting) : '?'}ms`);
  parts.push(`bytes=${bodyLength(res)}`);
  parts.push(`url=${res.url || '?'}`);

  if (res.error) {
    parts.push(`error="${truncate(res.error, 120)}"`);
  }
  if (settings.includeHeaders && res.headers) {
    const keys = Object.keys(res.headers).slice(0, 12);
    parts.push(`headers={${keys.map((key) => `${key}:${truncate(res.headers[key], 60)}`).join(', ')}}`);
  }
  if (typeof res.body === 'string' && res.body.length > 0) {
    parts.push(`body="${truncate(res.body, maxBody)}"`);
  }

  return parts.join(' ');
}

/**
 * لاگ شکست یک Check (یا یک بستهٔ Check).
 * @param {string} name نام Check
 * @param {object} res پاسخ
 * @param {{maxBodyLength?: number, includeHeaders?: boolean, logger?: Function}} [options]
 */
export function logCheckFailure(name, res, options) {
  const settings = options || {};
  const logger = settings.logger || console.warn;
  logger(`CHECK FAILED → ${name} | ${summarizeResponse(res, settings)}`);
}

/** لاگ شکست یک بستهٔ Check به‌همراه اسامی شکست‌خورده. */
export function logBundleFailure(failedNames, res, options) {
  const settings = options || {};
  const logger = settings.logger || console.warn;
  logger(`CHECK BUNDLE FAILED → [${failedNames.join(' | ')}] | ${summarizeResponse(res, settings)}`);
}
