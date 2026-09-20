/**
 * checks/presets.js — بسته‌های آمادهٔ Check (Pure Presets)
 * ----------------------------------------------------------------------------
 * هر پریست یک تابع (ctx) => Record<checkName, (res) => boolean> است:
 *   const predicates = healthChecks({ successStatuses: [200] });
 *   runChecks(res, predicates, { endpoint: 'login', type: CHECK_TYPE.http });
 *
 * چون خروجی فقط predicate است، می‌توانید مستقیم به check() بدهید یا با
 * allOf/anyOf ترکیب کنید. نام‌گذاری نهایی در runner انجام می‌شود.
 *
 * مستندات محلی : ../docs/05-checks-presets.md
 * Wiki         : https://gitlab.partdp.ir/judicial-services/idadgar/backlog/-/wikis/k6-test-conditions-standard  (TODO)
 */

import { matchesSchema, pathMatchesSchema } from './schema.js';
import {
  bodyNotEmpty,
  bodySizeAtMost,
  bodySizeBetween,
  cacheControlIncludes,
  charsetIsUtf8,
  contentTypeIncludes,
  cookieHasFlag,
  durationUnder,
  hasCookie,
  hasSecurityHeaders,
  isJsonResponse,
  jsonArrayNotEmpty,
  jsonFieldsUnique,
  jsonHasPath,
  jsonPaginationValid,
  jsonPathEquals,
  jsonPathType,
  jsonSortedBy,
  jwtNotExpired,
  jwtWellFormed,
  noInformationLeak,
  noTransportError,
  redirectCountAtMost,
  statusIn,
  statusIsServerError,
  tokenPresent,
  waitingUnder,
} from './predicates.js';

function responseExists(res) {
  return !!res && res.status !== undefined;
}

// ---------------------------------------------------------------------------
// ۱) سلامت پایه (Health)
// ---------------------------------------------------------------------------

/** بستهٔ سبک که تقریباً همه‌جا باید اجرا شود. */
export function healthChecks(ctx) {
  const settings = ctx || {};
  const statuses = [].concat(settings.successStatuses || [200, 201, 204]);
  const predicates = {
    'response received': responseExists,
    [`status in [${statuses.join(',')}]`]: statusIn(statuses),
    'no transport error': noTransportError,
  };

  if (settings.expectBody !== false) {
    predicates['body is not empty'] = bodyNotEmpty;
  }

  return predicates;
}

/** بستهٔ سخت‌گیرانه: سلامت + JSON + امنیت پایه + محدودهٔ حجم. */
export function strictHealthChecks(ctx) {
  const settings = ctx || {};
  const predicates = healthChecks(settings);
  predicates['json is parseable'] = isJsonResponse;
  predicates['no information leak'] = noInformationLeak;

  if (settings.securityHeaders !== false) {
    predicates['security headers present'] = hasSecurityHeaders(settings.securityHeaderNames);
  }
  if (settings.minBytes !== undefined || settings.maxBytes !== undefined) {
    predicates['payload size within range'] = bodySizeBetween(
      settings.minBytes === undefined ? 1 : settings.minBytes,
      settings.maxBytes === undefined ? 10 * 1024 * 1024 : settings.maxBytes
    );
  }
  if (settings.contentType) {
    predicates[`content-type is ${settings.contentType}`] = contentTypeIncludes(settings.contentType);
  }
  return predicates;
}

/**
 * بستهٔ عیب‌یابی: برای اجرای اولیه روی سرویس ناشناس.
 * تمرکز روی «پاسخ سالم گرفته شد؟» + شکار Hang و نشت اطلاعات.
 * (برای لاگ جزئیات در لحظهٔ شکست، runChecks را با verbose: true صدا بزنید.)
 */
export function diagnosticChecks(ctx) {
  const settings = ctx || {};
  const predicates = healthChecks({ successStatuses: settings.successStatuses });
  predicates['no server error (5xx)'] = (res) => !statusIsServerError(res);
  predicates['no information leak'] = noInformationLeak;
  predicates['duration below watchdog'] = durationUnder(settings.watchdogMs || 30000);
  predicates['ttfb below watchdog'] = waitingUnder(settings.watchdogTtfbMs || 20000);
  return predicates;
}

// ---------------------------------------------------------------------------
// ۲) محتوا و قرارداد (Payload / Contract)
// ---------------------------------------------------------------------------

/** بستهٔ محتوا: نوع محتوا، Encoding و محدودهٔ حجم. */
export function payloadChecks(ctx) {
  const settings = ctx || {};
  const predicates = { 'body is not empty': bodyNotEmpty };

  if (settings.contentType) {
    predicates[`content-type is ${settings.contentType}`] = contentTypeIncludes(settings.contentType);
  }
  if (settings.utf8 !== false) {
    predicates['charset is utf-8'] = charsetIsUtf8;
  }
  if (settings.minBytes !== undefined || settings.maxBytes !== undefined) {
    const min = settings.minBytes === undefined ? 1 : settings.minBytes;
    const max = settings.maxBytes === undefined ? 10 * 1024 * 1024 : settings.maxBytes;
    predicates['payload size within range'] = bodySizeBetween(min, max);
  }
  if (settings.cacheControl) {
    predicates[`cache-control includes ${settings.cacheControl}`] = cacheControlIncludes(settings.cacheControl);
  }
  return predicates;
}

/** بستهٔ قرارداد: ساختار JSON (Schema) + فیلدهای الزامی + نوع فیلدها. */
export function contractChecks(ctx) {
  const settings = ctx || {};
  const predicates = {};

  if (settings.schema) {
    predicates['matches response schema'] = matchesSchema(settings.schema);
  }
  if (settings.itemPath && settings.itemSchema) {
    predicates[`items in "${settings.itemPath}" match schema`] = pathMatchesSchema(settings.itemPath, settings.itemSchema);
  }
  if (settings.requiredPaths) {
    [].concat(settings.requiredPaths).forEach((path) => {
      predicates[`field "${path}" exists`] = jsonHasPath(path);
    });
  }
  if (settings.nonEmptyArrayPaths) {
    [].concat(settings.nonEmptyArrayPaths).forEach((path) => {
      predicates[`array "${path}" is not empty`] = jsonArrayNotEmpty(path);
    });
  }
  if (settings.typedPaths) {
    Object.keys(settings.typedPaths).forEach((path) => {
      const expectedType = settings.typedPaths[path];
      predicates[`field "${path}" is ${expectedType}`] = jsonPathType(path, expectedType);
    });
  }
  if (settings.expectedValues) {
    Object.keys(settings.expectedValues).forEach((path) => {
      predicates[`field "${path}" equals expected`] = jsonPathEquals(path, settings.expectedValues[path]);
    });
  }

  return predicates;
}

// ---------------------------------------------------------------------------
// ۳) امنیت و احراز هویت (Security / Auth)
// ---------------------------------------------------------------------------

/** بستهٔ امنیت: هدرهای امنیتی، عدم نشت اطلاعات و فلگ‌های کوکی. */
export function securityChecks(ctx) {
  const settings = ctx || {};
  const predicates = {
    'no information leak': noInformationLeak,
  };

  if (settings.securityHeaders !== false) {
    predicates['security headers present'] = hasSecurityHeaders(settings.securityHeaderNames);
  }
  if (settings.cookieName) {
    predicates[`cookie "${settings.cookieName}" present`] = hasCookie(settings.cookieName);
    predicates[`cookie "${settings.cookieName}" is HttpOnly`] = cookieHasFlag(settings.cookieName, 'httpOnly');
    if (settings.requireSecureCookie !== false) {
      predicates[`cookie "${settings.cookieName}" is Secure`] = cookieHasFlag(settings.cookieName, 'secure');
    }
    if (settings.sameSite) {
      predicates[`cookie "${settings.cookieName}" SameSite=${settings.sameSite}`] = cookieHasFlag(
        settings.cookieName,
        'sameSite',
        settings.sameSite
      );
    }
  }
  if (settings.serverHeaderPattern) {
    predicates['no server version disclosure'] = (res) => {
      const server = res && res.headers ? String(res.headers['Server'] || '') : '';
      return server.indexOf(settings.serverHeaderPattern) === -1;
    };
  }

  return predicates;
}

/** بستهٔ احراز هویت: توکن سالم/معتبر و کوکی نشست. */
export function authChecks(ctx) {
  const settings = ctx || {};
  const tokenPath = settings.tokenPath || 'token';
  const predicates = {
    'access token present': tokenPresent(tokenPath),
  };

  if (settings.requireJwt !== false) {
    predicates['token is well-formed JWT'] = jwtWellFormed(tokenPath);
    predicates['token is not expired'] = jwtNotExpired(tokenPath, settings.clockSkewSeconds);
  }
  if (settings.cookieName) {
    predicates[`session cookie "${settings.cookieName}" present`] = hasCookie(settings.cookieName);
  }

  return predicates;
}

// ---------------------------------------------------------------------------
// ۴) الگوهای دامنه‌ای (CRUD / Pagination / Upload / Performance / Resilience)
// ---------------------------------------------------------------------------

/** بستهٔ CRUD: وضعیت هر عمل + شناسه + هدر Location + وجود فیلد پس از حذف. */
export function crudChecks(ctx) {
  const settings = ctx || {};
  const idPath = settings.idPath || 'id';
  const predicates = {};

  if (settings.createdStatus) {
    predicates[`create returns ${settings.createdStatus}`] = statusIn([].concat(settings.createdStatus));
  }
  if (settings.createdStatus) {
    predicates[`created entity has "${idPath}"`] = jsonHasPath(idPath);
  }
  if (settings.locationHeader) {
    predicates['create returns Location header'] = (res) => {
      const location = res && res.headers ? res.headers['Location'] : undefined;
      return typeof location === 'string' && location.length > 0;
    };
  }
  if (settings.readStatus) {
    predicates[`read returns ${settings.readStatus}`] = statusIn([].concat(settings.readStatus));
    if (settings.expectedId !== undefined) {
      predicates[`read returns requested id`] = jsonPathEquals(idPath, settings.expectedId);
    }
  }
  if (settings.updateStatus) {
    predicates[`update returns ${settings.updateStatus}`] = statusIn([].concat(settings.updateStatus));
  }
  if (settings.deleteStatus) {
    predicates[`delete returns ${settings.deleteStatus}`] = statusIn([].concat(settings.deleteStatus));
    predicates['delete returns empty body'] = (res) => !!res && (res.body === undefined || res.body === null || res.body.length === 0);
  }
  if (settings.notFoundStatus) {
    predicates[`missing entity returns ${settings.notFoundStatus}`] = statusIn([].concat(settings.notFoundStatus));
  }

  return predicates;
}

/** بستهٔ صفحه‌بندی/مرتب‌سازی: page/size/total، یکتایی و ترتیب داده‌ها. */
export function paginationAndSortChecks(ctx) {
  const settings = ctx || {};
  const predicates = {};

  if (settings.itemsPath) {
    predicates[`"${settings.itemsPath}" is a non-empty array`] = jsonArrayNotEmpty(settings.itemsPath);
    predicates['pagination is consistent'] = jsonPaginationValid({
      itemsPath: settings.itemsPath,
      pagePath: settings.pagePath,
      sizePath: settings.sizePath,
      totalPath: settings.totalPath,
      expectedPage: settings.expectedPage,
    });
    if (settings.uniqueField) {
      predicates[`items unique by "${settings.uniqueField}"`] = jsonFieldsUnique(settings.itemsPath, settings.uniqueField);
    }
    if (settings.sortField) {
      const direction = settings.direction === 'asc' ? 'asc' : 'desc';
      predicates[`items sorted ${direction} by "${settings.sortField}"`] = jsonSortedBy(
        settings.itemsPath,
        settings.sortField,
        direction
      );
    }
  }

  return predicates;
}

/** بستهٔ آپلود: نوع فایل، حجم و شناسهٔ فایل. */
export function uploadChecks(ctx) {
  const settings = ctx || {};
  const predicates = {
    'upload acknowledged': statusIn([].concat(settings.successStatuses || [200, 201, 202])),
  };
  const fileIdPath = settings.fileIdPath || 'fileId';
  predicates[`response has "${fileIdPath}"`] = jsonHasPath(fileIdPath);

  if (settings.contentType) {
    predicates[`content-type is ${settings.contentType}`] = contentTypeIncludes(settings.contentType);
  }
  if (settings.maxBytes !== undefined) {
    predicates['response size below limit'] = bodySizeAtMost(settings.maxBytes);
  }

  return predicates;
}

/** بستهٔ کارایی پاسخِ تکی: بودجهٔ زمان در همان لحظه (برای عیب‌یابی مقایسه‌ای). */
export function performanceChecks(ctx) {
  const settings = ctx || {};
  const predicates = {};

  if (settings.durationMs) {
    predicates[`duration under ${settings.durationMs}ms`] = durationUnder(settings.durationMs);
  }
  if (settings.waitingMs) {
    predicates[`ttfb under ${settings.waitingMs}ms`] = waitingUnder(settings.waitingMs);
  }
  if (settings.redirectsMax !== undefined) {
    predicates[`redirects at most ${settings.redirectsMax}`] = redirectCountAtMost(settings.redirectsMax);
  }

  return predicates;
}

/** بستهٔ استقامت/آشوب: پذیرش وضعیت‌های تحمل‌پذیر (429/503) و هدر Retry-After. */
export function resilienceChecks(ctx) {
  const settings = ctx || {};
  const tolerated = [].concat(settings.toleratedStatuses || [429, 503]);
  const successStatuses = [].concat(settings.successStatuses || [200, 201, 204]);
  const predicates = {
    [`status is ${successStatuses.join('/')} or tolerated [${tolerated.join(',')}]`]: statusIn(successStatuses.concat(tolerated)),
    'no transport error': noTransportError,
  };

  if (settings.requireRetryAfter !== false) {
    predicates['429 responses carry Retry-After'] = (res) => {
      if (!res || res.status !== 429) {
        return true;
      }
      return typeof res.headers['Retry-After'] !== 'undefined';
    };
  }

  return predicates;
}

/** بستهٔ کسب‌وکار: موفقیت تراکنش + شناسهٔ تراکنش + پیام خطای استاندارد. */
export function businessChecks(ctx) {
  const settings = ctx || {};
  const predicates = {};
  const successPath = settings.successPath;
  const idPath = settings.idPath;

  if (successPath) {
    predicates[`"${successPath}" is true`] = jsonPathEquals(successPath, true);
  }
  if (idPath) {
    predicates[`transaction id "${idPath}" exists`] = jsonHasPath(idPath);
  }
  if (settings.expectedState && settings.statePath) {
    predicates[`state "${settings.statePath}" is expected`] = jsonPathEquals(settings.statePath, settings.expectedState);
  }
  if (settings.noLeak !== false) {
    predicates['no information leak'] = noInformationLeak;
  }

  return predicates;
}

// ---------------------------------------------------------------------------
// ۵) رجیستری بسته‌های Check (برای انتخاب با نام/ENV و ابزارسازی)
// ---------------------------------------------------------------------------

/** همهٔ بسته‌های استاندارد به‌همراه «دستهٔ» پیشنهادی برای تگ severity. */
export const CHECK_PRESETS = {
  healthChecks: healthChecks,
  strictHealthChecks: strictHealthChecks,
  diagnosticChecks: diagnosticChecks,
  payloadChecks: payloadChecks,
  contractChecks: contractChecks,
  securityChecks: securityChecks,
  authChecks: authChecks,
  crudChecks: crudChecks,
  paginationAndSortChecks: paginationAndSortChecks,
  uploadChecks: uploadChecks,
  performanceChecks: performanceChecks,
  resilienceChecks: resilienceChecks,
  businessChecks: businessChecks,
};

/** انتخاب بستهٔ Check با نام (برای انتخاب از ENV یا رجیستری‌های پویا). */
export function buildChecks(name, ctx, fallbackName) {
  const fallback = fallbackName || 'healthChecks';
  const factory = CHECK_PRESETS[name] || CHECK_PRESETS[fallback];
  if (!factory) {
    return {};
  }
  return factory(ctx || {});
}

/** ترکیب چند بستهٔ Check روی هم (نام‌های تکراری با هم ادغام می‌شوند؛ آخری برنده است). */
export function combineChecks() {
  const bundles = Array.prototype.slice.call(arguments);
  return bundles.reduce((accumulator, bundle) => Object.assign(accumulator, bundle || {}), {});
}



