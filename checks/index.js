/**
 * checks/index.js — نقطهٔ ورود ماژول checks
 * ----------------------------------------------------------------------------
 *   import { runChecks, healthChecks, contractChecks, ON_FAIL } from '../checks/index.js';
 *
 * مستندات محلی : ../docs/05-checks-presets.md
 * Wiki         : https://gitlab.partdp.ir/judicial-services/idadgar/backlog/-/wikis/k6-test-conditions-standard  (TODO)
 */

// --- ابزارهای خالص ---
export {
  isPlainObject,
  safeJson,
  getPath,
  hasPath,
  bodyLength,
  truncate,
  headerValue,
  headerString,
  decodeBase64Url,
  encodeBase64Url,
} from './internals.js';

// --- اعتبارسنجی ساختار (Contract) ---
export {
  validateSchema,
  matchesSchema,
  isValidAgainstSchema,
  pathMatchesSchema,
  schemaErrors,
} from './schema.js';

// --- Predicate های اتمی ---
export {
  statusEquals,
  statusIn,
  statusOk,
  statusBelow400,
  statusNoServerError,
  statusIsServerError,
  noTransportError,
  hasTransportError,
  bodyContains,
  bodyNotContains,
  bodyMatches,
  bodyNotEmpty,
  bodySizeAtLeast,
  bodySizeAtMost,
  bodySizeBetween,
  isJsonResponse,
  jsonHasPath,
  jsonMissingPath,
  jsonPathEquals,
  jsonPathNotEquals,
  jsonPathType,
  jsonPathAbove,
  jsonArrayNotEmpty,
  jsonArrayLengthAtLeast,
  jsonFieldsUnique,
  jsonSortedBy,
  jsonPaginationValid,
  hasHeader,
  headerEquals,
  headerIncludes,
  contentTypeIncludes,
  charsetIsUtf8,
  cacheControlIncludes,
  hasSecurityHeaders,
  hasCookie,
  cookieHasFlag,
  durationUnder,
  waitingUnder,
  connectingUnder,
  tlsUnder,
  sendingUnder,
  receivingUnder,
  blockedUnder,
  redirectCountAtMost,
  redirectCountAtLeast,
  noInformationLeak,
  noStackTrace,
  noSqlError,
  noServerHeaderDisclosure,
  tokenPresent,
  jwtWellFormed,
  jwtNotExpired,
  unauthorizedResponse,
  notFoundResponse,
  conflictResponse,
  tooManyRequestsResponse,
  hasAnyField,
  hasAllFields,
  jsonPathTrue,
  transactionSucceeded,
  allOf,
  anyOf,
  not,
  when,
  whenStatus,
} from './predicates.js';

// --- بسته‌های آمادهٔ Check ---
export {
  healthChecks,
  strictHealthChecks,
  diagnosticChecks,
  payloadChecks,
  contractChecks,
  securityChecks,
  authChecks,
  crudChecks,
  paginationAndSortChecks,
  uploadChecks,
  performanceChecks,
  resilienceChecks,
  businessChecks,
  CHECK_PRESETS,
  buildChecks,
  combineChecks,
} from './presets.js';

// --- گارد تگ‌محور ---
export {
  assertTotal,
  assertFailed,
  countAsserts,
  guardThreshold,
  strictFailureGuard,
  criticalGuard,
} from './guard.js';

// --- لایهٔ اجرا (k6) ---
export {
  ON_FAIL,
  buildCheckNames,
  checkTagsFrom,
  runChecks,
  runChecksOrFail,
  runChecksOrAbort,
  checksFor,
} from './runner.js';

// --- پیام‌ها ---
export {
  summarizeResponse,
  logCheckFailure,
  logBundleFailure,
} from './messages.js';

// --- استاندارد تگ (برای راحتی استفاده) ---
export {
  TAG,
  CHECK_TYPE,
  SEVERITY,
  PHASE,
  TAG_CATEGORIES,
  buildTags,
  tagString,
  taggedKey,
  withEnvironment,
  withPhase,
  validateTags,
  warnOnRiskyTags,
} from '../shared/tags.js';
