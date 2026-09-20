/**
 * shared/tags.js — استاندارد تگ‌ها برای k6 (مشترک بین checks و thresholds)
 * ----------------------------------------------------------------------------
 * چرا تگ؟ به‌جای ساختن چند Trend سفارشی، همان متریک‌های پیش‌فرض k6 را با تگ
 * تفکیک می‌کنیم و threshold را روی زیرمتریک تگ‌دار می‌بندیم:
 *   'http_req_duration{endpoint:login}': ['p(95)<400']
 *
 * نکات مهمی که در این فایل اعمال شده‌اند:
 *  1) فیلتر تگ در k6 فقط «تطبیق دقیق» است ({key:value} و چند تگ با کاما) و Regex ندارد.
 *  2) تگ‌ها باید کم‌کاردینالیتی باشند؛ تگ روی شناسهٔ یکتا/آی‌دی رکورد ممنوع.
 *
 * مستندات محلی : ../docs/01-tags-standard.md
 * Wiki         : https://gitlab.partdp.ir/judicial-services/idadgar/backlog/-/wikis/k6-test-conditions-standard  (TODO: جای‌گذاری آدرس نهایی صفحهٔ فارسی)
 */

/** کلیدهای استاندارد تگ (همیشه از همین‌ها استفاده کنید، تگ دست‌ساز نسازید). */
export const TAG = {
  endpoint: 'endpoint',
  flow: 'flow',
  step: 'step',
  scenario: 'scenario',
  type: 'type',
  severity: 'severity',
  phase: 'phase',
  protocol: 'protocol',
  channel: 'channel',
  host: 'host',
  service: 'service',
  dependency: 'dependency',
  env: 'env',
  region: 'region',
  cluster: 'cluster',
  apiVersion: 'api_version',
  tenant: 'tenant',
  userType: 'user_type',
  journey: 'journey',
  transaction: 'transaction',
  priority: 'priority',
  cache: 'cache',
  retry: 'retry',
  asyncOp: 'async',
  dbHeavy: 'db_heavy',
};

/** مقادیر استاندارد تگ «type» (نوع اعتبارسنجی). */
export const CHECK_TYPE = {
  http: 'http',
  availability: 'availability',
  contract: 'contract',
  schema: 'schema',
  security: 'security',
  business: 'business',
  performance: 'performance',
  resilience: 'resilience',
  contractStrict: 'contract-strict',
};

/** مقادیر استاندارد تگ «severity». */
export const SEVERITY = {
  critical: 'critical',
  normal: 'normal',
  low: 'low',
};

/** فازهای اجرای تست (برای مقایسهٔ warmup با steady/peak). */
export const PHASE = {
  warmup: 'warmup',
  ramp: 'ramp',
  steady: 'steady',
  peak: 'peak',
  cooldown: 'cooldown',
};

/** دسته‌بندی حرفه‌ای تگ‌ها (برای مستندسازی و review). */
export const TAG_CATEGORIES = {
  technical: ['method', 'status', 'host', 'name', 'group', 'protocol', 'error_code'],
  business: ['flow', 'transaction', 'journey', 'endpoint'],
  environment: ['env', 'region', 'cluster'],
  user: ['user_type', 'tenant'],
  sla: ['priority', 'severity', 'critical'],
  architecture: ['service', 'dependency', 'channel'],
  execution: ['scenario', 'phase', 'step'],
  monitoring: ['retry', 'cache', 'async'],
};

const TAG_VALUE_MAX_LENGTH = 48;
const ID_LIKE_PATTERN = /^[0-9a-f]{8,}$/i;
const UUID_LIKE_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HEX_OR_LONG_ID_PATTERN = /^[A-Za-z0-9_-]{24,}$/;

/**
 * پاک‌سازی و استانداردسازی تگ‌ها: مقدار undefined/null حذف و بقیه به رشته تبدیل می‌شود.
 * @param {Record<string, unknown>} tags
 * @returns {Record<string, string>}
 */
export function buildTags(tags) {
  const source = tags || {};
  const result = {};
  Object.keys(source).forEach((key) => {
    const value = source[key];
    if (value === undefined || value === null || value === '') {
      return;
    }
    result[key] = String(value);
  });
  return result;
}

/** تبدیل تگ‌ها به رشتهٔ مرتب و پایدار: "endpoint:login,severity:critical". */
export function tagString(tags) {
  const clean = buildTags(tags);
  return Object.keys(clean)
    .sort()
    .map((key) => `${key}:${clean[key]}`)
    .join(',');
}

/**
 * ساخت کلید زیرمتریک تگ‌دار برای threshold.
 * taggedKey('http_req_duration', { endpoint: 'login' }) => 'http_req_duration{endpoint:login}'
 */
export function taggedKey(metric, tags) {
  const serialized = tagString(tags);
  return serialized ? `${metric}{${serialized}}` : metric;
}

/** افزودن تگ محیط به یک مجموعه تگ. */
export function withEnvironment(tags, environment) {
  const base = buildTags(tags);
  return environment ? Object.assign({}, base, { env: String(environment) }) : base;
}

/** افزودن تگ فاز (برای تحلیل warmup/steady/peak در تست‌های طولانی). */
export function withPhase(tags, phase) {
  const base = buildTags(tags);
  return phase ? Object.assign({}, base, { phase: String(phase) }) : base;
}

/**
 * اعتبارسنجی تگ‌ها از نظر کاردینالیتی و قواعد تیم.
 * @returns {{valid: boolean, warnings: string[]}}
 */
export function validateTags(tags) {
  const warnings = [];
  const clean = buildTags(tags);

  Object.keys(clean).forEach((key) => {
    const value = clean[key];
    if (value.length > TAG_VALUE_MAX_LENGTH) {
      warnings.push(`tag "${key}" مقدار بلند دارد (${value.length} کاراکتر) و کاردینالیتی متریک را بالا می‌برد.`);
    }
    if (ID_LIKE_PATTERN.test(value) || UUID_LIKE_PATTERN.test(value) || HEX_OR_LONG_ID_PATTERN.test(value)) {
      warnings.push(`tag "${key}" شبیه شناسهٔ یکتاست؛ برای تفکیک رکورد از تگ استفاده نکنید (به‌جایش از tags.name/URL Grouping استفاده کنید).`);
    }
    if (/^\d+$/.test(value) && key !== 'status') {
      warnings.push(`tag "${key}" فقط عدد است؛ اگر قرار است فیلتر شود مطمئن شوید محدود به چند مقدار مشخص است.`);
    }
  });

  return { valid: warnings.length === 0, warnings };
}

/** در صورت پرخطر بودن تگ‌ها، هشدار در لاگ init چاپ می‌کند. */
export function warnOnRiskyTags(tags, context) {
  const result = validateTags(tags);
  if (!result.valid) {
    const label = context ? `[${context}] ` : '';
    result.warnings.forEach((warning) => console.warn(`WARN ${label}${warning}`));
  }
  return result.valid;
}
