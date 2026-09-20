/**
 * checks/runner.js — لایهٔ اجرای Check ها روی k6 (تنها فایلی که k6 را import می‌کند)
 * ----------------------------------------------------------------------------
 *   import { runChecks } from '../checks/index.js';
 *   const ok = runChecks(res, healthChecks({ successStatuses: [200] }), {
 *     endpoint: 'login',
 *     flow: 'auth',
 *     type: CHECK_TYPE.http,
 *     severity: SEVERITY.critical,
 *     onFail: ON_FAIL.warn,
 *   });
 *
 * قابلیت‌ها:
 *   - نام‌گذاری استاندارد Check ها (endpoint/prefix) برای فیلترپذیری در threshold
 *   - الصاق تگ استاندارد به Check ها (تا 'checks{type:contract}' قابل ساخت باشد)
 *   - شمارش خودکار در assert_total/assert_failed برای گاردهای تگ‌محور
 *   - مدیریت خطا: none | log | warn | throw (fail) | abort (exec.test.abort)
 *
 * مستندات محلی : ../docs/05-checks-presets.md و ../docs/08-pitfalls.md
 * Wiki         : https://gitlab.partdp.ir/judicial-services/idadgar/backlog/-/wikis/k6-test-conditions-standard  (TODO)
 */

import { check, fail } from 'k6';
import exec from 'k6/execution';
import { buildTags, warnOnRiskyTags } from '../shared/tags.js';
import { countAsserts } from './guard.js';
import { logBundleFailure, logCheckFailure } from './messages.js';

/** حالت‌های مدیریت خطا در صورت شکست Check. */
export const ON_FAIL = {
  none: 'none',
  log: 'log',
  warn: 'warn',
  throw: 'throw',
  abort: 'abort',
};

/** ساخت نام‌های نهایی Check (مثل «login · status in [200]»). */
export function buildCheckNames(predicates, ctx) {
  const settings = ctx || {};
  const parts = [];
  if (settings.endpoint) {
    parts.push(settings.endpoint);
  }
  if (settings.prefix) {
    parts.push(settings.prefix);
  }
  const label = parts.join(' · ');
  const names = {};

  Object.keys(predicates || {}).forEach((key) => {
    names[label ? `${label} · ${key}` : key] = predicates[key];
  });

  return names;
}

/** ساخت مجموعه تگ‌های استاندارد Check از ctx. */
export function checkTagsFrom(ctx) {
  const settings = ctx || {};
  const tags = buildTags(settings.tags);

  if (settings.endpoint) {
    tags.endpoint = String(settings.endpoint);
  }
  if (settings.flow) {
    tags.flow = String(settings.flow);
  }
  if (settings.step) {
    tags.step = String(settings.step);
  }
  if (settings.type) {
    tags.type = String(settings.type);
  }
  if (settings.severity) {
    tags.severity = String(settings.severity);
  }
  if (settings.phase) {
    tags.phase = String(settings.phase);
  }
  if (settings.journey) {
    tags.journey = String(settings.journey);
  }
  if (settings.extraTags) {
    const extra = buildTags(settings.extraTags);
    Object.keys(extra).forEach((key) => {
      tags[key] = extra[key];
    });
  }

  return tags;
}

/**
 * اجرای یک بستهٔ Check روی یک پاسخ.
 * @param {object} res پاسخ k6
 * @param {Record<string, (res: object) => boolean>} predicates بستهٔ Check
 * @param {object} [ctx] تنظیمات: endpoint, flow, step, type, severity, prefix, tags,
 *                      onFail, verbose, failMessage, validateTags
 * @returns {boolean} نتیجهٔ کلی بسته
 */
export function runChecks(res, predicates, ctx) {
  const settings = ctx || {};
  const names = buildCheckNames(predicates, settings);
  const tags = checkTagsFrom(settings);

  if (settings.validateTags === true) {
    warnOnRiskyTags(tags, settings.endpoint || 'checks');
  }

  const ok = check(res, names, tags);
  const failedNames = ok
    ? []
    : Object.keys(names).filter((name) => {
      try {
        return !names[name](res);
      } catch (error) {
        return true;
      }
    });

  countAsserts(Object.keys(names).length, tags, failedNames.length);

  const mode = settings.onFail || ON_FAIL.none;
  const shouldLog = (failedNames.length > 0 && settings.verbose === true) || mode === ON_FAIL.log || mode === ON_FAIL.warn;
  const logOptions = {
    maxBodyLength: settings.maxBodyLength,
    includeHeaders: settings.includeHeaders === true,
    logger: settings.logger,
  };

  if (shouldLog && failedNames.length > 0) {
    if (settings.verbose === true && failedNames.length === 1) {
      logCheckFailure(failedNames[0], res, logOptions);
    } else {
      logBundleFailure(failedNames, res, logOptions);
    }
  }

  if (!ok && (mode === ON_FAIL.throw || mode === ON_FAIL.abort)) {
    const message = settings.failMessage
      || `Check failed at "${settings.endpoint || 'check'}" → ${failedNames.join(' , ')}`;
    if (mode === ON_FAIL.abort) {
      exec.test.abort(message);
    }
    fail(message);
  }

  return ok;
}

/** اجرای چک‌ها با توقف فوری Iteration در صورت شکست (fail). */
export function runChecksOrFail(res, predicates, ctx) {
  return runChecks(res, predicates, Object.assign({}, ctx, { onFail: ON_FAIL.throw }));
}

/** اجرای چک‌ها با توقف کل تست در صورت شکست (abort). */
export function runChecksOrAbort(res, predicates, ctx) {
  return runChecks(res, predicates, Object.assign({}, ctx, { onFail: ON_FAIL.abort }));
}

/** فقط ساخت نام‌ها (برای استفاده‌های پیشرفته با check() دستی). */
export function checksFor(predicates, ctx) {
  return buildCheckNames(predicates, ctx);
}
