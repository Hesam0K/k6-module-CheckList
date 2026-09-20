/**
 * config/slo.js — تنها منبع اعداد (Single Source of Truth) برای آستانه‌های k6
 * ----------------------------------------------------------------------------
 * هر عددی که در پریست‌های thresholds استفاده می‌شود، از اینجا می‌آید؛ پس برای
 * کالیبره کردن SLA تیم، فقط همین فایل را تغییر می‌دهید.
 *
 * قابلیت override بدون تغییر کد (مناسب CI):
 *   k6 run -e K6_SLO_PROFILE=strict -e SLO_P95_MS=350 script.js
 *
 * مستندات محلی : ../docs/03-thresholds-presets.md
 * Wiki         : https://gitlab.partdp.ir/judicial-services/idadgar/backlog/-/wikis/k6-test-conditions-standard
 *                (TODO: پس از ساخت صفحهٔ فارسی در Wiki، این آدرس را به‌روزرسانی کنید)
 */

// در k6، متغیر سراسری __ENV همیشه موجود است؛ این گارد برای اجرای Node (تست‌ها) است.
const ENV = typeof __ENV !== 'undefined' ? __ENV : {};

/** خواندن عدد از __ENV با مقدار جایگزین. */
export function envNumber(name, fallback) {
  const raw = ENV[name];
  if (raw === undefined || raw === null || raw === '') {
    return fallback;
  }
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
}

/** خواندن رشته از __ENV با مقدار جایگزین. */
export function envString(name, fallback) {
  const raw = ENV[name];
  return raw === undefined || raw === null || raw === '' ? fallback : String(raw);
}

/** خواندن boolean از __ENV ("true"/"1"/"yes"/"on"). */
export function envBool(name, fallback) {
  const raw = ENV[name];
  if (raw === undefined || raw === null || raw === '') {
    return fallback;
  }
  return ['1', 'true', 'yes', 'on'].indexOf(String(raw).toLowerCase()) !== -1;
}

/**
 * بودجه‌های آماده (اعداد به میلی‌ثانیه و نرخ هستند).
 * هر پروفایل = یک «شخصیت» تست؛ پریست‌های thresholds از همین‌ها عدد می‌گیرند.
 */
export const SLO_BUDGETS = {
  dev: {
    failedRate: 0.05, avg: 800, p95: 3000, p99: 5000, max: 15000,
    checksRate: 0.9, criticalChecksRate: 0.95,
    waitingP95: 2000, waitingP99: 4000,
    blockedAvg: 200, connectingAvg: 500, tlsAvg: 1000, sendingAvg: 200, receivingAvg: 500,
    redirectsMax: 5, httpTimeoutMs: 60000, delayAbortEval: '30s',
  },
  smoke: {
    failedRate: 0.01, avg: 500, p95: 1500, p99: 3000, max: 6000,
    checksRate: 0.95, criticalChecksRate: 0.98,
    waitingP95: 1000, waitingP99: 2000,
    blockedAvg: 100, connectingAvg: 200, tlsAvg: 400, sendingAvg: 100, receivingAvg: 300,
    redirectsMax: 3, httpTimeoutMs: 30000, delayAbortEval: '30s',
  },
  default: {
    failedRate: 0.01, avg: 300, p95: 800, p99: 1500, max: 3000,
    checksRate: 0.99, criticalChecksRate: 0.999,
    waitingP95: 500, waitingP99: 1000,
    blockedAvg: 50, connectingAvg: 100, tlsAvg: 200, sendingAvg: 50, receivingAvg: 100,
    redirectsMax: 3, httpTimeoutMs: 30000, delayAbortEval: '60s',
  },
  strict: {
    failedRate: 0.001, avg: 200, p95: 400, p99: 800, max: 1500,
    checksRate: 0.999, criticalChecksRate: 0.9999,
    waitingP95: 300, waitingP99: 600,
    blockedAvg: 20, connectingAvg: 50, tlsAvg: 100, sendingAvg: 20, receivingAvg: 50,
    redirectsMax: 2, httpTimeoutMs: 20000, delayAbortEval: '60s',
  },
  relaxed: {
    failedRate: 0.05, avg: 800, p95: 2000, p99: 4000, max: 10000,
    checksRate: 0.9, criticalChecksRate: 0.95,
    waitingP95: 1500, waitingP99: 3000,
    blockedAvg: 200, connectingAvg: 400, tlsAvg: 800, sendingAvg: 200, receivingAvg: 500,
    redirectsMax: 5, httpTimeoutMs: 60000, delayAbortEval: '60s',
  },
  stress: {
    failedRate: 0.05, avg: 500, p95: 1500, p99: 3000, max: 8000,
    checksRate: 0.95, criticalChecksRate: 0.98,
    waitingP95: 1000, waitingP99: 2000,
    blockedAvg: 100, connectingAvg: 200, tlsAvg: 400, sendingAvg: 100, receivingAvg: 300,
    redirectsMax: 3, httpTimeoutMs: 30000, delayAbortEval: '60s',
  },
  spike: {
    failedRate: 0.1, avg: 800, p95: 2000, p99: 4000, max: 10000,
    checksRate: 0.9, criticalChecksRate: 0.95,
    waitingP95: 1500, waitingP99: 3000,
    blockedAvg: 200, connectingAvg: 400, tlsAvg: 800, sendingAvg: 200, receivingAvg: 500,
    redirectsMax: 5, httpTimeoutMs: 60000, delayAbortEval: '30s',
  },
  soak: {
    failedRate: 0.01, avg: 300, p95: 1000, p99: 2000, max: 4000,
    checksRate: 0.99, criticalChecksRate: 0.999,
    waitingP95: 500, waitingP99: 1000,
    blockedAvg: 50, connectingAvg: 100, tlsAvg: 200, sendingAvg: 50, receivingAvg: 100,
    redirectsMax: 3, httpTimeoutMs: 30000, delayAbortEval: '120s',
  },
  breakpoint: {
    failedRate: 0.01, avg: 300, p95: 500, p99: 1000, max: 3000,
    checksRate: 0.99, criticalChecksRate: 0.999,
    waitingP95: 300, waitingP99: 600,
    blockedAvg: 50, connectingAvg: 100, tlsAvg: 200, sendingAvg: 50, receivingAvg: 100,
    redirectsMax: 3, httpTimeoutMs: 30000, delayAbortEval: '30s',
  },
  diagnostic: {
    failedRate: 0.999, avg: 5000, p95: 30000, p99: 60000, max: 120000,
    checksRate: 0.5, criticalChecksRate: 0.5,
    waitingP95: 30000, waitingP99: 60000,
    blockedAvg: 5000, connectingAvg: 5000, tlsAvg: 5000, sendingAvg: 5000, receivingAvg: 5000,
    redirectsMax: 10, httpTimeoutMs: 120000, delayAbortEval: '60s',
  },
};

/** نام پروفایل فعال (از ENV یا default). */
export function activeProfile() {
  return envString('K6_SLO_PROFILE', 'default');
}

/**
 * بودجهٔ نهایی به‌همراه override های ENV.
 * @param {string} [profile] نام پروفایل؛ اگر داده نشود از K6_SLO_PROFILE خوانده می‌شود.
 */
export function slo(profile) {
  const name = profile || activeProfile();
  const base = SLO_BUDGETS[name] || SLO_BUDGETS.default;

  return {
    profile: name,
    failedRate: envNumber('SLO_ERROR_RATE', base.failedRate),
    avg: envNumber('SLO_AVG_MS', base.avg),
    p95: envNumber('SLO_P95_MS', base.p95),
    p99: envNumber('SLO_P99_MS', base.p99),
    max: envNumber('SLO_MAX_MS', base.max),
    checksRate: envNumber('SLO_CHECKS_RATE', base.checksRate),
    criticalChecksRate: envNumber('SLO_CRITICAL_CHECKS_RATE', base.criticalChecksRate),
    waitingP95: envNumber('SLO_WAITING_P95_MS', base.waitingP95),
    waitingP99: envNumber('SLO_WAITING_P99_MS', base.waitingP99),
    blockedAvg: envNumber('SLO_BLOCKED_AVG_MS', base.blockedAvg),
    connectingAvg: envNumber('SLO_CONNECTING_AVG_MS', base.connectingAvg),
    tlsAvg: envNumber('SLO_TLS_AVG_MS', base.tlsAvg),
    sendingAvg: envNumber('SLO_SENDING_AVG_MS', base.sendingAvg),
    receivingAvg: envNumber('SLO_RECEIVING_AVG_MS', base.receivingAvg),
    redirectsMax: envNumber('SLO_REDIRECTS_MAX', base.redirectsMax),
    httpTimeoutMs: envNumber('SLO_HTTP_TIMEOUT_MS', base.httpTimeoutMs),
    delayAbortEval: envString('SLO_ABORT_DELAY', base.delayAbortEval),
  };
}

/** بودجهٔ پروفایل فعال در زمان init (برای استفادهٔ معمول در اسکریپت‌ها). */
export const SLO = slo();

/** تایم‌اوت استاندارد درخواست‌ها (برای params درخواست‌های http). */
export const HTTP_TIMEOUT = `${SLO.httpTimeoutMs}ms`;

/** آدرس پایهٔ سرویس تحت تست (قابل تغییر با -e BASE_URL=...). */
export function baseUrl(fallback) {
  return envString('BASE_URL', fallback || 'http://127.0.0.1:8080');
}

