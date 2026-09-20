/**
 * test/00-config-integrity.js — اعتبارسنجی init-time برای کل ماژول
 * ----------------------------------------------------------------------------
 * این اسکریپت همهٔ پریست‌ها را import می‌کند، ادغام/تگ‌گذاری/گارد را اجرا می‌کند
 * و در صورت اشکال، با خطای init متوقف می‌شود. بدون هیچ درخواست شبکه‌ای.
 *
 * اجرا:
 *   k6 inspect test/00-config-integrity.js   (فقط اعتبارسنجی کانفیگ)
 *   k6 run test/00-config-integrity.js       (اجرای واقعی منطق ماژول)
 */

import { check } from 'k6';
import {
  THRESHOLD_PRESETS,
  CHECK_PRESETS,
  mergeThresholds,
  mergeAll,
  addSampleGuard,
  toAbortOnFail,
  scopeToTag,
  describePreset,
  auditPreset,
  adHocThresholds,
  businessSlaThresholds,
  cacheAndQueueThresholds,
  perEndpoint,
  guardThreshold,
  criticalGuard,
  defaultThresholds,
  strictThresholds,
  activeThresholdPreset,
  slo,
  runChecks,
  ON_FAIL,
  CHECK_TYPE,
  SEVERITY,
} from '../index.js';

export const options = {
  vus: 1,
  iterations: 1,
  thresholds: {
    // خودِ ماژول با استاندارد خودش سنجیده می‌شود:
    'checks{suite:integrity}': ['rate>0.99'],
    'checks{type:contract}': ['rate>0.99'],
    // گارد نمونهٔ تگ‌محور: اثبات می‌کند runner شمارندهٔ assert_total را پر می‌کند.
    'assert_total{type:contract}': ['count>0'],
  },
};

function collectChecks(group, accumulator) {
  const list = accumulator || [];
  (group.checks || []).forEach((entry) => list.push(entry));
  (group.groups || []).forEach((child) => collectChecks(child, list));
  return list;
}

export function handleSummary(data) {
  const checks = collectChecks(data.root_group);
  const failed = checks.filter((entry) => entry.fails > 0);
  const passes = checks.reduce((sum, entry) => sum + entry.passes, 0);
  const fails = checks.reduce((sum, entry) => sum + entry.fails, 0);

  console.log(`INTEGRITY RESULT → checks=${checks.length} passes=${passes} fails=${fails}`);
  failed.forEach((entry) => console.log(`  FAILED → ${entry.name} (fails=${entry.fails})`));

  return {};
}

export default function () {
  const tag = { suite: 'integrity' };

  // ۱) همهٔ پریست‌های thresholds بدون خطای ساختاری باشند
  Object.keys(THRESHOLD_PRESETS).forEach((name) => {
    const preset = THRESHOLD_PRESETS[name];
    check(preset, {
      [`preset ${name} has entries`]: () => Object.keys(preset).length > 0,
      [`preset ${name} has valid aggregations`]: () => {
        const audit = auditPreset(preset, name);
        return audit.warnings.filter((w) => w.indexOf('نامعتبر') !== -1).length === 0;
      },
      [`preset ${name} has guard or error budget`]: () => {
        const audit = auditPreset(preset, name);
        return audit.hasSampleGuard || audit.hasErrorBudget;
      },
    }, tag);
  });

  // ۲) ادغام و dedupe
  const merged = mergeThresholds(defaultThresholds, strictThresholds, defaultThresholds);
  const durationExpressions = [].concat(merged.http_req_duration || []);
  check(merged, {
    'merge deduplicates expressions': () => new Set(durationExpressions.map(String)).size === durationExpressions.length,
    'merge keeps abort variant as object': () => {
      const withAbort = mergeThresholds(
        { http_req_failed: ['rate<0.01'] },
        toAbortOnFail({ http_req_failed: ['rate<0.01'] })
      );
      const entry = [].concat(withAbort.http_req_failed)[0];
      return typeof entry === 'object' && entry.abortOnFail === true;
    },
  }, tag);

  // ۳) گارد نمونه idempotent باشد
  const guarded = addSampleGuard(addSampleGuard({ http_req_duration: ['p(95)<500'] }));
  check(guarded, {
    'sample guard added once': (g) => [].concat(g.http_reqs).length === 1,
  }, tag);

  // ۴) تگ‌گذاری کلیدها
  const scoped = scopeToTag({ http_req_duration: ['p(95)<400'] }, { endpoint: 'login' }, 'both');
  check(scoped, {
    'global key preserved': (s) => !!s.http_req_duration,
    'tagged key created': (s) => !!s['http_req_duration{endpoint:login}'],
  }, tag);

  // ۵) کارخانه‌ها
  const business = businessSlaThresholds({
    latency: { 'flow:checkout': ['p(95)<2000'] },
    success: { 'flow:checkout': ['rate>0.995'] },
  });
  check(business, {
    'business SLA tagged latency': (b) => !!b['http_req_duration{flow:checkout}'],
    'business SLA tagged checks': (b) => !!b['checks{flow:checkout}'],
    'business SLA keeps sample guard': (b) => !!b.http_reqs,
  }, tag);

  const queue = cacheAndQueueThresholds({});
  check(queue, {
    'cache metric threshold built': (q) => !!q.cache_hit,
    'queue metric threshold built': (q) => !!q.queue_wait,
  }, tag);

  const perEndpointPreset = perEndpoint({ http_req_duration: ['p(95)<300'] }, ['login', 'checkout'], 'tagged');
  check(perEndpointPreset, {
    'perEndpoint builds one key per endpoint': (p) => Object.keys(p).length === 2,
  }, tag);

  const adHoc = adHocThresholds({ failedRate: 0.02, p95: 900, allowDroppedIterations: true });
  check(adHoc, {
    'adHoc has error budget': (a) => !!a.http_req_failed,
    'adHoc can skip dropped guard': (a) => a.dropped_iterations === undefined,
  }, tag);

  // ۶) گاردهای تگ‌محور Check ها
  const guard = Object.assign({}, guardThreshold({ type: 'contract' }), criticalGuard({ severity: 'critical' }));
  check(guard, {
    'guard threshold key built': (g) => !!g['assert_total{type:contract}'],
    'critical guard has failure guard': (g) => !!g['assert_failed{severity:critical}'],
  }, tag);

  // ۷) همهٔ بسته‌های Check با ctx کامل قابل ساخت باشند
  //    (از runChecks استفاده می‌کنیم تا خودِ runner و شمارندهٔ گارد هم پوشش داده شود)
  Object.keys(CHECK_PRESETS).forEach((name) => {
    const bundle = CHECK_PRESETS[name](CHECK_PRESETS_CTX);
    runChecks(bundle, {
      [`bundle ${name} is not empty`]: (b) => Object.keys(b).length > 0,
      [`bundle ${name} returns functions`]: (b) => Object.keys(b).every((key) => typeof b[key] === 'function'),
    }, {
      endpoint: `bundle:${name}`,
      type: CHECK_TYPE.contract,
      severity: SEVERITY.normal,
      extraTags: { suite: 'integrity' },
      onFail: ON_FAIL.warn,
      verbose: true,
      maxBodyLength: 200,
    });
  });

  // ۸) پریست فعال بر اساس ENV
  const active = activeThresholdPreset();
  check(active, {
    'active preset resolved': (p) => !!p && Object.keys(p).length > 0,
  }, tag);

  const budget = slo();
  console.log(`SLO profile="${budget.profile}" p95=${budget.p95}ms errorRate=${budget.failedRate}`);
  console.log(`thresholds presets=${Object.keys(THRESHOLD_PRESETS).length} check bundles=${Object.keys(CHECK_PRESETS).length}`);
  console.log(`default preset rows=${describePreset('defaultThresholds', defaultThresholds).length}`);

  // ۹) mergeAll روی آرایهٔ پریست‌ها
  const mergedAll = mergeAll([
    defaultThresholds,
    businessSlaThresholds({ latency: { 'endpoint:login': ['p(95)<400'] } }),
  ]);
  check(mergedAll, {
    'mergeAll works': (m) => !!m.http_reqs && !!m['http_req_duration{endpoint:login}'],
  }, tag);
}

const CHECK_PRESETS_CTX = {
  successStatuses: [200],
  schema: { type: 'object' },
  requiredPaths: ['id'],
  itemsPath: 'items',
  itemPath: 'items',
  itemSchema: { type: 'object' },
  expectedValues: { page: 1 },
  typedPaths: { total: 'number' },
  nonEmptyArrayPaths: ['items'],
  idPath: 'id',
  createdStatus: 201,
  readStatus: 200,
  deleteStatus: 204,
  locationHeader: true,
  maxBytes: 1024,
  fileIdPath: 'fileId',
  contentType: 'application/json',
  durationMs: 500,
  waitingMs: 300,
  redirectsMax: 2,
  tokenPath: 'token',
  cookieName: 'session_id',
  sameSite: 'Strict',
  successPath: 'success',
  statePath: 'state',
  expectedState: 'DONE',
  securityHeaders: true,
};

