/**
 * thresholds/presets.js — پریست‌های آمادهٔ آستانه (Thresholds Presets)
 * ----------------------------------------------------------------------------
 * چهار خانواده پریست داریم:
 *   A) Profile    : بر اساس هدف اجرا (dev / smoke / default / strict / relaxed / ci-gate / abort)
 *   B) Objective  : بر اساس نوع تست عملکرد (breakpoint / stress / spike / soak / diagnostic)
 *   C) Layer      : بر اساس لایهٔ مشکل (network / backend / saturation)
 *   D) Domain     : بر اساس دامنهٔ کسب‌وکار (contract / business SLA / cache & queue)
 *
 * همهٔ پریست‌ها «Sample Guard» دارند تا آستانهٔ بدون نمونه کاذب سبز نشود.
 * انتخاب سریع با ENV:  k6 run -e K6_SLO_PROFILE=strict script.js
 *
 * مستندات محلی : ../docs/03-thresholds-presets.md
 * Wiki         : https://gitlab.partdp.ir/judicial-services/idadgar/backlog/-/wikis/k6-test-conditions-standard  (TODO)
 */

import { slo, envString } from '../config/slo.js';
import {
  sampleGuard,
  iterationsGuard,
  errorBudget,
  latencyBudget,
  latencyCeiling,
  checksReliability,
  criticalChecksReliability,
  contractReliability,
  backendLayer,
  networkLayer,
  saturationGuard,
  dynamicLoadGuard,
  throughputFloor,
  tagBudget,
  customRate,
  customTrend,
} from './blocks.js';
import {
  mergeThresholds,
  toAbortOnFail,
  resolvePreset,
  describePreset,
} from './helpers.js';
import { taggedSla } from './factories.js';

// ---------------------------------------------------------------------------
// A) پروفایل‌های اجرا (Base Profiles)
// ---------------------------------------------------------------------------

/** سبک‌ترین حالت برای اجرای محلی: فقط مطمئن می‌شویم چیزی نمی‌شکند. */
export const devThresholds = mergeThresholds(
  sampleGuard(),
  errorBudget(slo('dev')),
  latencyBudget(slo('dev')),
  checksReliability(slo('dev'))
);

/** تست دود در CI: سریع، سخت‌گیری کم، ریسک False Negative پایین. */
export const smokeThresholds = mergeThresholds(
  sampleGuard(),
  errorBudget(slo('smoke')),
  latencyBudget(slo('smoke')),
  latencyCeiling(slo('smoke')),
  checksReliability(slo('smoke')),
  saturationGuard()
);

/**
 * ★ پیش‌فرض تیم: SLO متعادل.
 * برای اکثر سناریوهای روزمره و گیت‌های CI معمولی همین را استفاده کنید.
 */
export const defaultThresholds = mergeThresholds(
  sampleGuard(),
  errorBudget(slo('default')),
  latencyBudget(slo('default')),
  latencyCeiling(slo('default')),
  checksReliability(slo('default')),
  criticalChecksReliability(slo('default')),
  saturationGuard()
);

/** SLA سخت‌گیرانه/پروداکشن‌گرید (همهٔ لایه‌ها). */
export const strictThresholds = mergeThresholds(
  sampleGuard(),
  errorBudget(slo('strict')),
  latencyBudget(slo('strict')),
  latencyCeiling(slo('strict')),
  checksReliability(slo('strict')),
  criticalChecksReliability(slo('strict')),
  backendLayer(slo('strict')),
  networkLayer(slo('strict')),
  saturationGuard()
);

/** محیط ضعیف/سرویس قدیمی/مرحلهٔ اول پذیرش: تحمل خطای بیشتر. */
export const relaxedThresholds = mergeThresholds(
  sampleGuard(),
  errorBudget(slo('relaxed')),
  latencyBudget(slo('relaxed')),
  checksReliability(slo('relaxed'))
);

/**
 * ★ گیت CI با توقف زودهنگام (Abort On Fail).
 * اگر نرخ خطا از بودجه عبور کند، اجرا با delayAbortEval متوقف می‌شود تا منابع
 * CI هدر نرود. توجه: exit code در این حالت نیز 99 است.
 */
export const abortOnFailThresholds = mergeThresholds(
  sampleGuard(),
  toAbortOnFail(errorBudget(slo('default')), { delayAbortEval: slo('default').delayAbortEval }),
  latencyBudget(slo('default')),
  checksReliability(slo('default')),
  saturationGuard()
);

// ---------------------------------------------------------------------------
// B) پروفایل‌های هدف (Test Objectives)
// ---------------------------------------------------------------------------

/**
 * کشف نقطهٔ شکست (Breakpoint Test).
 * SLO را به «خط قطع» تبدیل می‌کنیم: به‌محض عبور از SLO، اجرا متوقف می‌شود و
 * نقطهٔ شکست (VU/RPS لحظهٔ توقف) در خروجی مشخص است.
 * اجرا با executor نوع ramping-arrival-rate توصیه می‌شود.
 */
export const breakpointThresholds = mergeThresholds(
  sampleGuard(),
  toAbortOnFail(
    mergeThresholds(
      errorBudget(slo('breakpoint')),
      { http_req_duration: [`p(95)<${slo('breakpoint').p95}`] }
    ),
    { delayAbortEval: slo('breakpoint').delayAbortEval }
  ),
  checksReliability(slo('breakpoint'))
);

/** فشار پایدار بالاتر از ظرفیت متعارف (Stress Test). */
export const stressThresholds = mergeThresholds(
  sampleGuard(),
  errorBudget(slo('stress')),
  latencyBudget(slo('stress')),
  checksReliability(slo('stress')),
  saturationGuard()
);

/** جهش ناگهانی بار (Spike Test) — تحمل خطای لحظه‌ای بیشتر، اما بدون Drop. */
export const spikeThresholds = mergeThresholds(
  sampleGuard(),
  errorBudget(slo('spike')),
  latencyBudget(slo('spike')),
  checksReliability(slo('spike')),
  saturationGuard()
);

/** اجرای طولانی (Soak Test) — پایداری و شکار افت تدریجی. */
export const soakThresholds = mergeThresholds(
  sampleGuard(),
  errorBudget(slo('soak')),
  latencyBudget(slo('soak')),
  latencyCeiling(slo('soak')),
  checksReliability(slo('soak')),
  saturationGuard()
);

/**
 * عیب‌یابی (Diagnostic) — تمرکز بر «آیا پاسخ سالمی گرفته‌ایم؟» نه روی SLA.
 * عملاً هیچ‌وقت به‌خاطر کندی Fail نمی‌کند، اما اگر هیچ درخواستی ثبت نشود یا
 * Check ها کاملاً بشکنند، اجرا را قرمز می‌کند.
 */
export const diagnosticThresholds = mergeThresholds(
  sampleGuard(),
  iterationsGuard(),
  errorBudget(slo('diagnostic')),
  latencyCeiling(slo('diagnostic')),
  checksReliability(slo('diagnostic'))
);

// ---------------------------------------------------------------------------
// C) لایه‌ها (Layers)
// ---------------------------------------------------------------------------

/** فقط لایهٔ شبکه (صف سوکت، TCP، TLS، ارسال/دریافت). */
export const networkThresholds = mergeThresholds(
  sampleGuard(),
  networkLayer(slo('default')),
  errorBudget(slo('default'))
);

/** فقط لایهٔ بک‌اند (TTFB = http_req_waiting) به‌همراه بودجهٔ کل. */
export const backendThresholds = mergeThresholds(
  sampleGuard(),
  backendLayer(slo('default')),
  latencyBudget(slo('default'))
);

/** اشباع «مولد بار» (نه سرویس تحت تست): Drop نشدن Iteration و فعال بودن VU ها. */
export const saturationThresholds = mergeThresholds(
  dynamicLoadGuard(),
  { vus: ['value>0'] },
  throughputFloor(1)
);

// ---------------------------------------------------------------------------
// D) دامنه (Domain)
// ---------------------------------------------------------------------------

/**
 * قرارداد و امنیت (Contract & Security).
 * پیش‌نیاز: Check های خود را با تگ‌های استاندارد type:contract / type:security
 * اجرا کنید (runChecks این کار را خودکار انجام می‌دهد).
 */
export const contractThresholds = mergeThresholds(
  sampleGuard(),
  errorBudget(slo('default')),
  contractReliability(slo('default')),
  criticalChecksReliability(slo('default'))
);

/**
 * ★ SLA کسب‌وکار (Business SLA) — تگ‌محور.
 *   businessSlaThresholds({
 *     latency: { 'flow:checkout': ['p(95)<2000'], 'endpoint:login': ['p(95)<400'] },
 *     success: { 'flow:checkout': ['rate>0.995'], 'flow:login': ['rate>0.999'] },
 *   })
 */
export function businessSlaThresholds(options) {
  const settings = options || {};
  return mergeThresholds(
    sampleGuard(),
    errorBudget(settings.budget || slo('default')),
    taggedSla('http_req_duration', settings.latency),
    taggedSla('checks', settings.success),
    settings.extra
  );
}

/**
 * ★ Cache / Queue / Transaction — متریک‌های سفارشی تگ‌دار.
 *   cacheAndQueueThresholds({ cacheHitRatio: 0.8, queueWaitP95Ms: 100 })
 */
export function cacheAndQueueThresholds(options) {
  const settings = options || {};
  return mergeThresholds(
    sampleGuard(),
    customRate(settings.cacheMetric || 'cache_hit', settings.cacheHitRatio || 0.8),
    customTrend(settings.queueMetric || 'queue_wait', { p95: settings.queueWaitP95Ms || 100 }),
    customRate(settings.transactionMetric || 'payment_success', settings.transactionSuccessRate || 0.995)
  );
}

/** آستانهٔ اختصاصی یک Check خانوادگی (بر پایهٔ تگ)، به‌همراه گارد امن. */
export function checksFamilyThreshold(metric, tags, expressions) {
  return mergeThresholds(
    tagBudget(metric, tags, expressions),
    { http_reqs: ['count>0'] }
  );
}

// ---------------------------------------------------------------------------
// رجیستری پریست‌ها و انتخاب خودکار
// ---------------------------------------------------------------------------

/** نگاشت نام پروفایل → پریست (برای انتخاب با ENV). */
export const PRESETS_BY_PROFILE = {
  dev: devThresholds,
  smoke: smokeThresholds,
  default: defaultThresholds,
  strict: strictThresholds,
  relaxed: relaxedThresholds,
  stress: stressThresholds,
  spike: spikeThresholds,
  soak: soakThresholds,
  breakpoint: breakpointThresholds,
  diagnostic: diagnosticThresholds,
};

/** رجیستری کامل پریست‌های آماده (برای resolvePreset و ابزارها). */
export const THRESHOLD_PRESETS = {
  devThresholds,
  smokeThresholds,
  defaultThresholds,
  strictThresholds,
  relaxedThresholds,
  abortOnFailThresholds,
  ciGateThresholds: abortOnFailThresholds,
  breakpointThresholds,
  stressThresholds,
  spikeThresholds,
  soakThresholds,
  diagnosticThresholds,
  networkThresholds,
  backendThresholds,
  saturationThresholds,
  contractThresholds,
};

/**
 * پریست فعال بر اساس ENV:
 *   k6 run -e K6_SLO_PROFILE=strict script.js
 * اگر مقدار نامعتبر باشد، defaultThresholds استفاده می‌شود (با هشدار).
 */
export function activeThresholdPreset() {
  return resolvePreset(envString('K6_SLO_PROFILE', 'default'), PRESETS_BY_PROFILE, 'default');
}

/** خروجی جدولی و خوانا از یک پریست (برای لاگ init، دیباگ یا تولید مستندات). */
export function explainPreset(name, preset) {
  return describePreset(name, preset);
}


