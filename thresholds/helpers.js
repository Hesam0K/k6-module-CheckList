/**
 * thresholds/helpers.js — ابزارهای ترکیب، تگ‌گذاری، گارد و تبدیل threshold ها
 * ----------------------------------------------------------------------------
 * چرا لازم است؟ تقریباً همهٔ پریست‌ها کلید مشترک دارند (مثل http_req_duration)؛
 * پس بدون merge، ترکیب پریست‌ها یکی را روی دیگری بازنویسی می‌کند.
 *
 * مستندات محلی : ../docs/03-thresholds-presets.md
 * Wiki         : https://gitlab.partdp.ir/judicial-services/idadgar/backlog/-/wikis/k6-test-conditions-standard  (TODO)
 */

import { taggedKey } from '../shared/tags.js';

/** تبدیل مقدار یک کلید threshold به آرایهٔ یکنواخت. */
export function toEntryList(value) {
  if (Array.isArray(value)) {
    return value.slice();
  }
  if (value === undefined || value === null) {
    return [];
  }
  return [value];
}

function normalizeExpression(expression) {
  return String(expression).replace(/\s+/g, '');
}

function entryKey(entry) {
  if (typeof entry === 'string') {
    return normalizeExpression(entry);
  }
  return normalizeExpression(entry.threshold);
}

/**
 * ادغام امن چند پریست روی هم.
 * - آرایه‌ها concat و بر اساس «عبارت» de-duplicate می‌شوند.
 * - اگر یک عبارت هم به شکل رشته و هم به شکل آبجکت (abortOnFail) باشد،
 *   نسخهٔ آبجکت برنده است (چون سخت‌گیرانه‌تر است).
 */
export function mergeThresholds() {
  const merged = {};
  const presets = Array.prototype.slice.call(arguments);

  presets.forEach((preset) => {
    if (!preset) {
      return;
    }
    Object.keys(preset).forEach((metric) => {
      if (!merged[metric]) {
        merged[metric] = [];
      }
      toEntryList(preset[metric]).forEach((entry) => {
        const key = entryKey(entry);
        let index = -1;
        for (let i = 0; i < merged[metric].length; i += 1) {
          if (entryKey(merged[metric][i]) === key) {
            index = i;
            break;
          }
        }

        if (index === -1) {
          merged[metric].push(entry);
          return;
        }

        const existing = merged[metric][index];
        const existingIsObject = typeof existing === 'object';
        const incomingIsObject = typeof entry === 'object';

        if (incomingIsObject && existingIsObject) {
          const mergedEntry = Object.assign({}, existing, entry);
          // سخت‌گیرانه‌ترین حالت برنده است: اگر هر کدام abortOnFail داشتند، حفظ می‌شود.
          mergedEntry.abortOnFail = !!(existing.abortOnFail || entry.abortOnFail);
          merged[metric][index] = mergedEntry;
        } else if (incomingIsObject && !existingIsObject) {
          merged[metric][index] = entry;
        }
      });
    });
  });

  return merged;
}

/** ادغام آرایه‌ای از پریست‌ها (معادل mergeThresholds با ورودی آرایه). */
export function mergeAll(presets) {
  return mergeThresholds.apply(null, presets || []);
}

/**
 * افزودن Sample Guard به یک پریست (پیش‌فرض: http_reqs count>0).
 * این گارد جلوی «سبز شدن کاذب» آستانه‌ها در اجرای بدون نمونه را می‌گیرد.
 */
export function addSampleGuard(preset, options) {
  const settings = options || {};
  const metric = settings.metric || 'http_reqs';
  const expression = settings.expression || 'count>0';
  const guard = {};
  guard[metric] = [expression];
  return mergeThresholds(preset, guard);
}

/**
 * تبدیل (انتخابی) آستانه‌ها به فرم abortOnFail برای گیت CI.
 * @param {object} preset
 * @param {{delayAbortEval?: string, only?: string[]}} [options]
 */
export function toAbortOnFail(preset, options) {
  const settings = options || {};
  const delay = settings.delayAbortEval || '60s';
  const only = settings.only ? [].concat(settings.only) : null;
  const result = {};

  Object.keys(preset).forEach((metric) => {
    const entries = toEntryList(preset[metric]);
    const selected = !only || only.indexOf(metric) !== -1;

    if (!selected) {
      result[metric] = entries;
      return;
    }

    result[metric] = entries.map((entry) => {
      if (typeof entry === 'string') {
        return { threshold: entry, abortOnFail: true, delayAbortEval: delay };
      }
      return Object.assign({ abortOnFail: true, delayAbortEval: delay }, entry);
    });
  });

  return result;
}

/**
 * اعمال یک مجموعه تگ روی کلیدهای پریست.
 * mode='both'   → هم آستانهٔ کلی و هم آستانهٔ تگ‌دار (پیشنهاد برای شروع)
 * mode='tagged' → فقط آستانهٔ تگ‌دار (SLA اختصاصی Endpoint)
 * mode='global' → فقط آستانهٔ کلی (بدون تغییر)
 * کلیدهایی که از قبل تگ‌دار هستند دست‌نخورده می‌مانند.
 */
export function scopeToTag(preset, tags, mode) {
  const selectedMode = mode || 'both';
  const result = {};

  Object.keys(preset).forEach((metric) => {
    const entries = toEntryList(preset[metric]);
    const alreadyTagged = metric.indexOf('{') !== -1;

    if (alreadyTagged || selectedMode === 'global') {
      result[metric] = entries;
      return;
    }

    if (selectedMode === 'both' || selectedMode === 'global') {
      result[metric] = entries;
    }

    if (selectedMode === 'both' || selectedMode === 'tagged') {
      result[taggedKey(metric, tags)] = entries.slice();
    }
  });

  return result;
}

/** ساخت خروجی قابل‌خواندن از پریست (برای لاگ init یا مستندات). */
export function describePreset(name, preset) {
  const rows = [];
  Object.keys(preset).forEach((metric) => {
    toEntryList(preset[metric]).forEach((entry) => {
      if (typeof entry === 'string') {
        rows.push({ name, metric, expression: entry, abortOnFail: false, delayAbortEval: null });
        return;
      }
      rows.push({
        name,
        metric,
        expression: entry.threshold,
        abortOnFail: !!entry.abortOnFail,
        delayAbortEval: entry.delayAbortEval || null,
      });
    });
  });
  return rows;
}

const GUARD_METRICS = ['http_reqs', 'iterations', 'dropped_iterations', 'data_sent', 'data_received', 'assert_total'];
const ERROR_METRICS = ['http_req_failed'];

/**
 * بازرسی خودکار یک پریست: وجود Sample Guard / Error Budget و هشدارها.
 * در test/self-test-checks.js استفاده می‌شود تا از استاندارد خارج نشویم.
 */
export function auditPreset(preset, name) {
  const metrics = Object.keys(preset);
  const hasSampleGuard = metrics.some((metric) => GUARD_METRICS.indexOf(metric) !== -1);
  const hasErrorBudget = metrics.some((metric) => ERROR_METRICS.indexOf(metric) !== -1);
  const warnings = [];

  if (!hasSampleGuard) {
    warnings.push('Sample Guard ندارد → احتمال «سبز شدن کاذب» در اجرای بدون نمونه (vacuous pass).');
  }
  if (!hasErrorBudget) {
    warnings.push('Error Budget (http_req_failed) ندارد → خطاهای HTTP در این پریست دیده نمی‌شوند.');
  }

  metrics.forEach((metric) => {
    toEntryList(preset[metric]).forEach((entry) => {
      const expression = typeof entry === 'string' ? entry : entry.threshold;
      const aggregation = expression.split(/[<>=!]/)[0].trim();

      if (metric.indexOf('checks') === 0 && aggregation === 'count') {
        warnings.push(`'${expression}' نامعتبر: متریک checks از نوع Rate است و count را پشتیبانی نمی‌کند.`);
      }
      if (metric.indexOf('http_req_failed') === 0 && aggregation === 'p') {
        warnings.push(`'${expression}' نامعتبر: http_req_failed از نوع Rate است و صدک ندارد.`);
      }
      if (metric.indexOf('vus') === 0 && aggregation !== 'value') {
        warnings.push(`'${expression}' نامعتبر: vus از نوع Gauge است و فقط value را پشتیبانی می‌کند.`);
      }
      if (metric.indexOf('http_req_duration') === 0 && aggregation === 'count') {
        warnings.push(`'${expression}' نامعتبر: Trend فقط avg/min/max/med/p(N) را پشتیبانی می‌کند.`);
      }
    });
  });

  return { name, metrics, hasSampleGuard, hasErrorBudget, warnings };
}

/** انتخاب پریست از یک رجیستری با نام (پشتیبانی از انتخاب با ENV). */
export function resolvePreset(name, registry, fallbackName) {
  const fallback = fallbackName || 'defaultThresholds';
  if (name && registry[name]) {
    return registry[name];
  }
  if (name) {
    console.warn(`WARN preset "${name}" یافت نشد؛ پریست "${fallback}" استفاده شد.`);
  }
  return registry[fallback];
}

