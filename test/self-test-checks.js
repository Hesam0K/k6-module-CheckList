/**
 * test/self-test-checks.js — تست بومی k6 برای منطق checks (بدون شبکه)
 * ----------------------------------------------------------------------------
 * با پاسخ‌های ساختگی، درستی predicate ها، schema validator و runner را می‌سنجیم.
 * نتیجه با دو آستانه سنجیده می‌شود:
 *   'checks{suite:selftest}': ['rate>0.99']      (خودِ تست‌ها باید پاس شوند)
 *   'assert_total{suite:selftest}': ['count>0']  (گارد: runner واقعاً assert ثبت کرده)
 *
 * اجرا:  k6 run test/self-test-checks.js
 */

import { check } from 'k6';
import {
  runChecks,
  healthChecks,
  contractChecks,
  securityChecks,
  authChecks,
  payloadChecks,
  performanceChecks,
  paginationAndSortChecks,
  ON_FAIL,
  CHECK_TYPE,
  SEVERITY,
  validateSchema,
  isValidAgainstSchema,
  decodeBase64Url,
  encodeBase64Url,
  allOf,
  anyOf,
  not,
  statusIn,
  bodyContains,
  noInformationLeak,
  jsonFieldsUnique,
  jsonSortedBy,
  jwtNotExpired,
  jwtWellFormed,
  jsonPaginationValid,
  durationUnder,
  contentTypeIncludes,
  getPath,
  headerString,
} from '../checks/index.js';

export const options = {
  vus: 1,
  iterations: 1,
  thresholds: {
    // فقط Checks «خانوادهٔ اصلی» سنجیده می‌شوند (تگ type:selftest).
    // این دقیقاً همان مزیت تگ‌هاست: assertion های عمداً شکست‌خوردهٔ تست منفی
    // نرخ موفقیت family اصلی را آلوده نمی‌کنند.
    'checks{type:selftest}': ['rate>0.99'],
    'assert_total{suite:selftest}': ['count>0'],
    // اثبات اینکه شمارندهٔ شکست هم درست کار می‌کند:
    'assert_failed{type:negative}': ['count>0'],
  },
};

const TAGS = { suite: 'selftest', type: 'selftest' };
const NEGATIVE_TAGS = { suite: 'selftest', type: 'negative' };

function fakeResponse(overrides) {
  return Object.assign(
    {
      status: 200,
      body: '',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      cookies: {},
      timings: { duration: 100, waiting: 50, connecting: 5, tls_handshaking: 10, sending: 2, receiving: 3, blocked: 1 },
      redirects: [],
      error: '',
      url: 'http://mock.local/test',
    },
    overrides
  );
}

const TOKEN_FRESH = `${encodeBase64Url(JSON.stringify({ alg: 'HS256' }))}.${encodeBase64Url(
  JSON.stringify({ sub: 'u-1', exp: Math.floor(Date.now() / 1000) + 600 })
)}.sig`;
const TOKEN_EXPIRED = `${encodeBase64Url(JSON.stringify({ alg: 'HS256' }))}.${encodeBase64Url(
  JSON.stringify({ sub: 'u-1', exp: Math.floor(Date.now() / 1000) - 600 })
)}.sig`;

const PRODUCTS_BODY = JSON.stringify({
  page: 1,
  size: 2,
  total: 3,
  items: [
    { id: 'p-1', title: 'A', price: 10, createdAt: '2026-02-03T00:00:00.000Z' },
    { id: 'p-2', title: 'B', price: 20, createdAt: '2026-02-02T00:00:00.000Z' },
  ],
});

function expect(label, actual, expected) {
  check(actual, {
    [`${label} → ${JSON.stringify(expected)}`]: (value) => value === expected,
  }, TAGS);
}

export default function () {
  // ---------------------------------------------------------------------
  // ۱) predicate های پایه
  // ---------------------------------------------------------------------
  expect('statusIn matches', statusIn([200, 201])(fakeResponse({})), true);
  expect('statusIn rejects', statusIn([201])(fakeResponse({ status: 200 })), false);
  expect('bodyContains finds text', bodyContains('"status":"ok"')(fakeResponse({ body: '{"status":"ok"}' })), true);
  expect('not() inverts', not(bodyContains('x'))(fakeResponse({ body: 'abc' })), true);
  expect('allOf requires all', allOf(statusIn([200]), bodyContains('ok'))(fakeResponse({ body: 'ok' })), true);
  expect('anyOf requires one', anyOf(statusIn([500]), bodyContains('ok'))(fakeResponse({ body: 'ok' })), true);
  expect('durationUnder passes', durationUnder(200)(fakeResponse({})), true);
  expect('durationUnder fails', durationUnder(50)(fakeResponse({})), false);
  expect('contentTypeIncludes detects json', contentTypeIncludes('application/json')(fakeResponse({})), true);
  expect('headerString joins arrays', headerString({ 'Set-Cookie': ['a=1', 'b=2'] }, 'set-cookie'), 'a=1,b=2');
  expect('getPath resolves nested', getPath({ a: { b: [{ c: 7 }] } }, 'a.b[0].c'), 7);

  // ---------------------------------------------------------------------
  // ۲) امنیت و نشت اطلاعات
  // ---------------------------------------------------------------------
  const leaked = fakeResponse({ body: 'problem\nstacktrace: SQLSTATE[42000]: syntax error' });
  expect('noInformationLeak catches stacktrace', noInformationLeak(leaked), false);
  expect('noInformationLeak passes clean body', noInformationLeak(fakeResponse({ body: '{"ok":true}' })), true);

  // ---------------------------------------------------------------------
  // ۳) توکن و کوکی
  // ---------------------------------------------------------------------
  expect('jwtWellFormed accepts 3 parts', jwtWellFormed('token')(fakeResponse({ body: `{"token":"${TOKEN_FRESH}"}` })), true);
  expect('jwtWellFormed rejects junk', jwtWellFormed('token')(fakeResponse({ body: '{"token":"abc"}' })), false);
  expect('jwtNotExpired accepts fresh', jwtNotExpired('token')(fakeResponse({ body: `{"token":"${TOKEN_FRESH}"}` })), true);
  expect('jwtNotExpired rejects expired', jwtNotExpired('token')(fakeResponse({ body: `{"token":"${TOKEN_EXPIRED}"}` })), false);
  expect(
    'cookie flags detected',
    securityChecks({ cookieName: 'session_id' })['cookie "session_id" is HttpOnly'](
      fakeResponse({ cookies: { session_id: [{ name: 'session_id', value: 'x', httpOnly: true, secure: false }] } })
    ),
    true
  );

  // ---------------------------------------------------------------------
  // ۴) لیست/صفحه‌بندی/ترتیب/یکتایی
  // ---------------------------------------------------------------------
  const productsResponse = fakeResponse({ body: PRODUCTS_BODY });
  expect('jsonFieldsUnique passes', jsonFieldsUnique('items', 'id')(productsResponse), true);
  expect('jsonSortedBy desc passes', jsonSortedBy('items', 'createdAt', 'desc')(productsResponse), true);
  expect('jsonSortedBy asc fails', jsonSortedBy('items', 'createdAt', 'asc')(productsResponse), false);
  expect('jsonPaginationValid passes', jsonPaginationValid({ itemsPath: 'items', expectedPage: 1 })(productsResponse), true);
  expect(
    'jsonPaginationValid fails on wrong page',
    jsonPaginationValid({ itemsPath: 'items', expectedPage: 2 })(productsResponse),
    false
  );

  // ---------------------------------------------------------------------
  // ۵) schema validator
  // ---------------------------------------------------------------------
  const schema = {
    type: 'object',
    required: ['page', 'items'],
    properties: {
      page: { type: 'integer', minimum: 1 },
      items: { type: 'array', minItems: 1, items: { type: 'object', required: ['id'] } },
      extra: { type: 'string', nullable: true },
    },
  };
  expect('schema accepts valid payload', isValidAgainstSchema(JSON.parse(PRODUCTS_BODY), schema), true);
  expect('schema rejects missing field', isValidAgainstSchema({ page: 1 }, schema), false);
  expect('schema rejects wrong type', isValidAgainstSchema({ page: 'one', items: [{}] }, schema), false);

  const strictSchema = Object.assign({ additionalProperties: false }, schema);
  expect(
    'schema rejects extra property when additionalProperties=false',
    validateSchema({ page: 1, items: [{ id: 'a' }], nope: true }, strictSchema).length > 0,
    true
  );
  expect('schema accepts allowed keys only', validateSchema({ page: 1, items: [{ id: 'a' }] }, strictSchema).length, 0);

  // ---------------------------------------------------------------------
  // ۶) runner + بسته‌ها روی پاسخ ساختگی
  // ---------------------------------------------------------------------
  const okBundle = runChecks(
    productsResponse,
    contractChecks({
      schema,
      requiredPaths: ['page', 'total'],
      nonEmptyArrayPaths: ['items'],
      typedPaths: { page: 'integer' },
      expectedValues: { page: 1 },
    }),
    {
      endpoint: 'products',
      type: CHECK_TYPE.contract,
      severity: SEVERITY.critical,
      extraTags: TAGS,
      onFail: ON_FAIL.none,
    }
  );
  expect('contract bundle passes on healthy payload', okBundle, true);

  const failingBundle = runChecks(
    fakeResponse({ status: 500, body: '{"success":false,"message":"boom"}' }),
    healthChecks({ successStatuses: [200] }),
    { endpoint: 'failing', type: CHECK_TYPE.http, extraTags: NEGATIVE_TAGS, onFail: ON_FAIL.none }
  );
  expect('health bundle fails on 500', failingBundle, false);

  const paginationBundle = runChecks(
    productsResponse,
    paginationAndSortChecks({
      itemsPath: 'items',
      pagePath: 'page',
      sizePath: 'size',
      totalPath: 'total',
      expectedPage: 1,
      uniqueField: 'id',
      sortField: 'createdAt',
      direction: 'desc',
    }),
    { endpoint: 'pagination', type: CHECK_TYPE.contract, extraTags: TAGS, onFail: ON_FAIL.none }
  );
  expect('pagination bundle passes', paginationBundle, true);

  const perfBundle = runChecks(
    productsResponse,
    performanceChecks({ durationMs: 200, waitingMs: 100, redirectsMax: 0 }),
    { endpoint: 'performance', type: CHECK_TYPE.performance, extraTags: TAGS, onFail: ON_FAIL.none }
  );
  expect('performance bundle passes', perfBundle, true);

  const authBundle = runChecks(
    fakeResponse({ body: `{"token":"${TOKEN_FRESH}"}` }),
    authChecks({ tokenPath: 'token' }),
    { endpoint: 'auth', type: CHECK_TYPE.security, extraTags: TAGS, onFail: ON_FAIL.none }
  );
  expect('auth bundle passes with fresh token', authBundle, true);

  const payloadBundle = runChecks(
    fakeResponse({ body: '{"a":1}', headers: { 'Content-Type': 'application/json; charset=utf-8' } }),
    payloadChecks({ contentType: 'json', minBytes: 3, maxBytes: 50 }),
    { endpoint: 'payload', type: CHECK_TYPE.contract, extraTags: TAGS, onFail: ON_FAIL.none }
  );
  expect('payload bundle passes', payloadBundle, true);

  // encode/decode باید رفت‌وبرگشت درست داشته باشند
  expect('base64url round-trip', decodeBase64Url(encodeBase64Url(JSON.stringify({ a: 1 }))), '{"a":1}');
}

// ---------------------------------------------------------------------------
// گزارش‌دهی: نام Check های شکست‌خورده را چاپ می‌کند
// ---------------------------------------------------------------------------
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

  console.log(`SELFTEST RESULT → checks=${checks.length} passes=${passes} fails=${fails}`);
  failed.forEach((entry) => console.log(`  FAILED → ${entry.name} (fails=${entry.fails})`));

  return {};
}


