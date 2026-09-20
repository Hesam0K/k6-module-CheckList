/**
 * thresholds/index.js — نقطهٔ ورود ماژول thresholds
 * ----------------------------------------------------------------------------
 *   import { defaultThresholds, mergeThresholds, scopeToTag } from '../thresholds/index.js';
 *   export const options = { thresholds: defaultThresholds };
 *
 * مستندات محلی : ../docs/03-thresholds-presets.md
 * Wiki         : https://gitlab.partdp.ir/judicial-services/idadgar/backlog/-/wikis/k6-test-conditions-standard  (TODO)
 */

export {
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
  customRate,
  customCounter,
  customTrend,
  tagBudget,
} from './blocks.js';

export {
  mergeThresholds,
  mergeAll,
  addSampleGuard,
  toAbortOnFail,
  scopeToTag,
  describePreset,
  auditPreset,
  resolvePreset,
} from './helpers.js';

export {
  taggedSla,
  businessSla,
  checkSla,
  customSla,
  scopeToMany,
  perEndpoint,
  perScenario,
  perFlow,
  tagScopedGuard,
  adHocThresholds,
} from './factories.js';

export {
  devThresholds,
  smokeThresholds,
  defaultThresholds,
  strictThresholds,
  relaxedThresholds,
  abortOnFailThresholds,
  breakpointThresholds,
  stressThresholds,
  spikeThresholds,
  soakThresholds,
  diagnosticThresholds,
  networkThresholds,
  backendThresholds,
  saturationThresholds,
  contractThresholds,
  businessSlaThresholds,
  cacheAndQueueThresholds,
  checksFamilyThreshold,
  PRESETS_BY_PROFILE,
  THRESHOLD_PRESETS,
  activeThresholdPreset,
  explainPreset,
} from './presets.js';

export { slo, SLO, SLO_BUDGETS, activeProfile, envNumber, envString, envBool, baseUrl, HTTP_TIMEOUT } from '../config/slo.js';
