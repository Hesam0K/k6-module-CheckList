/**
 * base-stress-test.js — ★ بویلرپلیت استاندارد تست فشار (نسخهٔ ۳ / تگ‌محور)
 * ============================================================================
 * این فایل «الگوی رسمی تیم» است: کافی است مسیرها و داده‌های سرویس خود را
 * جایگزین کنید. چهار قاعدهٔ ثابت این الگو:
 *
 *   ۱) تگ‌ها در پیکربندی درخواست ست می‌شوند:
 *        http.get(url, { tags: { endpoint: 'login', flow: 'auth' } })
 *   ۲) آستانه‌ها روی متریک‌های پیش‌فرض k6 با فیلتر تگ بسته می‌شوند
 *      (به‌جای ساختن چند Trend سفارشی):
 *        'http_req_duration{endpoint:login}': ['p(95)<400']
 *   ۳) هر پریست دارای Sample Guard است تا آستانه روی «صفر نمونه» کاذب سبز نشود.
 *   ۴) منطق Check ها با مدیریت خطای مشخص اجرا می‌شود (warn | throw | abort).
 *
 * مستندات محلی : ./docs/03-thresholds-presets.md , ./docs/05-checks-presets.md , ./docs/07-recipes.md
 * Wiki         : https://gitlab.partdp.ir/judicial-services/idadgar/backlog/-/wikis/k6-test-conditions-standard
 *                (TODO: پس از ساخت صفحهٔ فارسی در Wiki گیت‌لب، آدرس را به‌روزرسانی کنید)
 *
 * اجرا:
 *   node test/mock-server.mjs
 *   k6 run base-stress-test.js
 *   k6 run -e K6_SLO_PROFILE=strict -e BASE_URL=https://stage.example.com base-stress-test.js
 *   k6 run --no-thresholds base-stress-test.js        (اجرای اکتشافی/عیب‌یابی)
 * ============================================================================
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import {
  activeThresholdPreset,
  mergeThresholds,
  businessSlaThresholds,
  networkThresholds,
  checkSla,
  guardThreshold,
  strictFailureGuard,
  explainPreset,
  baseUrl,
  HTTP_TIMEOUT,
  envString,
  runChecks,
  healthChecks,
  contractChecks,
  CHECK_TYPE,
  SEVERITY,
  PHASE,
  ON_FAIL,
} from './index.js';

const BASE = baseUrl();
const ON_FAIL_MODE = envString('K6_ON_FAIL', ON_FAIL.warn);

export const options = {
  scenarios: {
    baseline: {
      executor: 'constant-vus',
      vus: Number(envString('K6_VUS', '5')),
      duration: envString('K6_DURATION', '10s'),
      gracefulStop: '5s',
    },
  },
  thresholds: mergeThresholds(
    // ۱) پریست پایه: با -e K6_SLO_PROFILE=smoke|default|strict|... انتخاب می‌شود
    activeThresholdPreset(),
    // ۲) بودجهٔ لایهٔ شبکه (اختیاری، برای پیدا کردن مشکل زیرساخت)
    networkThresholds,
    // ۳) SLA اختصاصی هر Endpoint/Flow (همان الگوی «نسخهٔ ۳»)
    businessSlaThresholds({
      latency: {
        'endpoint:login': ['p(95)<600', 'p(99)<1200'],
        'endpoint:profile': ['p(95)<500'],
        'endpoint:products': ['p(95)<900'],
      },
      success: {
        'flow:auth': ['rate>0.99'],
        'flow:catalog': ['rate>0.99'],
      },
    }),
    // ۴) SLA روی گروه‌های Check + گاردهای نمونه/شکست
    checkSla({ 'type:contract': ['rate>0.99'], 'severity:critical': ['rate>0.999'] }),
    guardThreshold({ type: 'contract' }),
    strictFailureGuard({ severity: 'critical' })
  ),
};

/** setup: آماده‌سازی داده/توکن پیش از شروع بار. */
export function setup() {
  const login = http.post(
    `${BASE}/login`,
    JSON.stringify({ username: envString('K6_USER', 'tester'), password: envString('K6_PASS', 'secret') }),
    {
      timeout: HTTP_TIMEOUT,
      headers: { 'Content-Type': 'application/json' },
      tags: { endpoint: 'login', flow: 'auth', step: 'setup' },
    }
  );

  const ok = check(login, {
    'setup: login returns 200': (res) => res.status === 200,
    'setup: token returned': (res) => typeof res.json('token') === 'string',
  });

  if (!ok) {
    // بدون توکن، ادامهٔ تست بی‌معناست → توقف کامل با پیام واضح
    throw new Error(`setup failed: login did not return a token (status=${login.status})`);
  }

  const rows = explainPreset('active', options.thresholds);
  console.log(`active SLO → ${rows.length} expressions / ${Object.keys(options.thresholds).length} metrics`);

  return { token: login.json('token') };
}

export default function (data) {
  const authHeaders = { Authorization: `Bearer ${data.token}` };

  group('auth: profile', function () {
    const profile = http.get(`${BASE}/profile`, {
      timeout: HTTP_TIMEOUT,
      headers: authHeaders,
      tags: { endpoint: 'profile', flow: 'auth', step: '1', phase: PHASE.steady },
    });

    runChecks(profile, healthChecks({ successStatuses: [200] }), {
      endpoint: 'profile',
      flow: 'auth',
      type: CHECK_TYPE.availability,
      severity: SEVERITY.critical,
      onFail: ON_FAIL_MODE,
    });

    runChecks(
      profile,
      contractChecks({ requiredPaths: ['userId', 'role'], typedPaths: { userId: 'string', role: 'string' } }),
      {
        endpoint: 'profile',
        flow: 'auth',
        type: CHECK_TYPE.contract,
        severity: SEVERITY.critical,
        onFail: ON_FAIL_MODE,
      }
    );
  });

  group('catalog: products', function () {
    const products = http.get(`${BASE}/products?page=1&size=5`, {
      timeout: HTTP_TIMEOUT,
      tags: { endpoint: 'products', flow: 'catalog', step: '2', phase: PHASE.steady },
    });

    runChecks(products, healthChecks({ successStatuses: [200] }), {
      endpoint: 'products',
      flow: 'catalog',
      type: CHECK_TYPE.availability,
      severity: SEVERITY.normal,
      onFail: ON_FAIL_MODE,
    });

    runChecks(
      products,
      contractChecks({
        requiredPaths: ['page', 'size', 'total', 'items'],
        nonEmptyArrayPaths: ['items'],
        typedPaths: { page: 'integer', total: 'integer' },
      }),
      {
        endpoint: 'products',
        flow: 'catalog',
        type: CHECK_TYPE.contract,
        severity: SEVERITY.critical,
        onFail: ON_FAIL_MODE,
      }
    );
  });

  // Think time واقع‌گرایانه (قابل تنظیم با -e K6_THINK_TIME=1.5)
  sleep(Number(envString('K6_THINK_TIME', '1')));
}

/** teardown: پاک‌سازی داده‌های تستی (در پروژهٔ واقعی پیاده کنید). */
export function teardown(data) {
  if (!data || !data.token) {
    return;
  }
  console.log('teardown: cleanup test data (پیاده‌سازی کنید)');
}

/**
 * handleSummary: گزارش per-tag برای CI.
 * - در ترمینال، خلاصهٔ تگ‌دار http_req_duration و نتیجهٔ آستانه‌ها چاپ می‌شود.
 * - یک Artifact JSON هم برای مقایسهٔ اجراها ذخیره می‌شود (k6/test-artifacts).
 */
/**
 * نرمال‌سازی نتیجهٔ آستانه‌ها در دادهٔ خلاصهٔ k6.
 * k6 v1.x شکل مپ دارد: { 'p(95)<300': { ok: true } } — نسخه‌های قدیمی آرایه‌ای از {threshold, ok}.
 * پیش از این، فرض «آرایه بودن» باعث خطای بی‌صدای handleSummary می‌شد.
 */
function thresholdRowsOf(metric) {
  const source = metric ? metric.thresholds : null;
  if (!source) {
    return [];
  }
  if (Array.isArray(source)) {
    return source.map((entry) => ({ threshold: entry.threshold, ok: !!entry.ok }));
  }
  return Object.keys(source).map((expression) => ({
    threshold: expression,
    ok: !!(source[expression] && source[expression].ok),
  }));
}

/** قالب‌بندی امن یک آمارهٔ میلی‌ثانیه‌ای (اگر آماره در --summary-trend-stats نباشد). */
function ms(values, key) {
  const value = values ? values[key] : undefined;
  return typeof value === 'number' ? value.toFixed(1) : 'n/a';
}

export function handleSummary(data) {
  const lines = [];
  const timestamp = new Date().toISOString();
  lines.push('='.repeat(78));
  lines.push(`K6 Stress Test Summary — ${timestamp}`);
  lines.push('='.repeat(78));

  lines.push('');
  lines.push('نتیجهٔ آستانه‌ها (Thresholds):');
  Object.keys(data.metrics).forEach((metricName) => {
    thresholdRowsOf(data.metrics[metricName]).forEach((row) => {
      lines.push(`  ${row.ok ? 'PASS' : 'FAIL'}  ${metricName} : ${row.threshold}`);
    });
  });

  lines.push('');
  lines.push('تفکیک تگ‌دار (Tag sub-metrics):');
  Object.keys(data.metrics).forEach((metricName) => {
    if (metricName.indexOf('http_req_duration{') !== 0) {
      return;
    }
    const values = data.metrics[metricName].values;
    lines.push(
      `  ${metricName} -> avg=${ms(values, 'avg')}ms p(95)=${ms(values, 'p(95)')}ms`
        + ` p(99)=${ms(values, 'p(99)')}ms max=${ms(values, 'max')}ms`
    );
  });

  const checksPassed = data.metrics.checks ? data.metrics.checks.values.rate * 100 : 0;
  const failedRate = data.metrics.http_req_failed ? data.metrics.http_req_failed.values.rate * 100 : 0;
  lines.push('');
  lines.push(`checks success rate = ${checksPassed.toFixed(2)}% , http_req_failed = ${failedRate.toFixed(2)}%`);
  lines.push('='.repeat(78));

  const artifact = {
    timestamp,
    sloProfile: envString('K6_SLO_PROFILE', 'default'),
    durations: Object.keys(data.metrics)
      .filter((name) => name.indexOf('http_req_duration') === 0)
      .reduce((accumulator, name) => {
        accumulator[name] = data.metrics[name].values;
        return accumulator;
      }, {}),
    thresholds: Object.keys(data.metrics)
      .filter((name) => thresholdRowsOf(data.metrics[name]).length > 0)
      .reduce((accumulator, name) => {
        accumulator[name] = thresholdRowsOf(data.metrics[name]);
        return accumulator;
      }, {}),
  };

  return {
    stdout: `${lines.join('\n')}\n`,
    'k6-summary.json': JSON.stringify(artifact, null, 2),
  };
}

