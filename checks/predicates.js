/**
 * checks/predicates.js — توابع اتمی اعتبارسنجی (Pure Predicates)
 * ----------------------------------------------------------------------------
 * هر predicate یک تابع (res) => boolean است و هیچ وابستگی به k6 ندارد، پس:
 *   1) در هر جای اسکریپت قابل استفاده است،
 *   2) با checks/runner.js روی check() سوار می‌شود،
 *   3) به‌تنهایی قابل تست است (test/self-test-checks.js).
 *
 * مستندات محلی : ../docs/04-checks-catalog.md
 * Wiki         : https://gitlab.partdp.ir/judicial-services/idadgar/backlog/-/wikis/k6-test-conditions-standard  (TODO)
 */

import {
  bodyLength,
  decodeBase64Url,
  getPath,
  hasPath,
  headerString,
  headerValue,
  safeJson,
} from './internals.js';

// ---------------------------------------------------------------------------
// ۱) وضعیت HTTP (Status)
// ---------------------------------------------------------------------------

export function statusEquals(code) {
  return (res) => !!res && res.status === code;
}

export function statusIn(codes) {
  const list = [].concat(codes);
  return (res) => !!res && list.indexOf(res.status) !== -1;
}

/** 2xx */
export function statusOk(res) {
  return !!res && res.status >= 200 && res.status < 300;
}

/** بدون خطای کلاینت/سرور (زیر 400) */
export function statusBelow400(res) {
  return !!res && res.status > 0 && res.status < 400;
}

/** بدون خطای سرور (زیر 500) */
export function statusNoServerError(res) {
  return !!res && res.status > 0 && res.status < 500;
}

export function statusIsServerError(res) {
  return !!res && res.status >= 500;
}

/** شکار خطای شبکه/تایم‌اوت (k6 در res.error مقدار می‌گذارد). */
export function noTransportError(res) {
  return !!res && (res.error === undefined || res.error === null || res.error === '');
}

export function hasTransportError(res) {
  return !noTransportError(res);
}

// ---------------------------------------------------------------------------
// ۲) بدنهٔ پاسخ (Body / JSON)
// ---------------------------------------------------------------------------

export function bodyContains(text) {
  return (res) => !!res && typeof res.body === 'string' && res.body.indexOf(text) !== -1;
}

export function bodyNotContains(text) {
  return (res) => !!res && typeof res.body === 'string' && res.body.indexOf(text) === -1;
}

export function bodyMatches(pattern) {
  const regex = pattern instanceof RegExp ? pattern : new RegExp(pattern);
  return (res) => !!res && typeof res.body === 'string' && regex.test(res.body);
}

export function bodyNotEmpty(res) {
  return bodyLength(res) > 0;
}

export function bodySizeAtLeast(minSize) {
  return (res) => bodyLength(res) >= minSize;
}

export function bodySizeAtMost(maxSize) {
  return (res) => bodyLength(res) > 0 && bodyLength(res) <= maxSize;
}

export function bodySizeBetween(minSize, maxSize) {
  return (res) => bodyLength(res) >= minSize && bodyLength(res) <= maxSize;
}

export function isJsonResponse(res) {
  return safeJson(res) !== null;
}

export function jsonHasPath(path) {
  return (res) => hasPath(safeJson(res), path);
}

export function jsonMissingPath(path) {
  return (res) => !hasPath(safeJson(res), path);
}

export function jsonPathEquals(path, expected) {
  return (res) => getPath(safeJson(res), path) === expected;
}

export function jsonPathNotEquals(path, notExpected) {
  return (res) => getPath(safeJson(res), path) !== notExpected;
}

export function jsonPathType(path, expectedType) {
  return (res) => {
    const value = getPath(safeJson(res), path);
    if (value === null) {
      return expectedType === 'null';
    }
    if (Array.isArray(value)) {
      return expectedType === 'array';
    }
    if (expectedType === 'integer') {
      return typeof value === 'number' && Number.isInteger(value);
    }
    return typeof value === expectedType;
  };
}

/** مقدار مسیر بزرگ‌تر از حد مشخص (مثل total > 0). */
export function jsonPathAbove(path, minimum) {
  return (res) => {
    const value = getPath(safeJson(res), path);
    return typeof value === 'number' && value > minimum;
  };
}

export function jsonArrayNotEmpty(path) {
  return (res) => {
    const value = getPath(safeJson(res), path);
    return Array.isArray(value) && value.length > 0;
  };
}

export function jsonArrayLengthAtLeast(path, minLength) {
  return (res) => {
    const value = getPath(safeJson(res), path);
    return Array.isArray(value) && value.length >= minLength;
  };
}

/** ویژگی‌های یک لیست از آیتم‌ها (ترتیب/یکتایی/صفحه‌بندی). */
export function jsonFieldsUnique(path, field) {
  return (res) => {
    const list = getPath(safeJson(res), path);
    if (!Array.isArray(list)) {
      return false;
    }
    const seen = {};
    for (let i = 0; i < list.length; i += 1) {
      const value = field ? getPath(list[i], field) : list[i];
      const key = JSON.stringify(value);
      if (seen[key] === true) {
        return false;
      }
      seen[key] = true;
    }
    return true;
  };
}

/**
 * ترتیب داده‌ها: direction='asc'|'desc'
 * برای Search/List API ها که مرتب‌سازی بخشی از قرارداد است.
 */
export function jsonSortedBy(path, field, direction) {
  return (res) => {
    const list = getPath(safeJson(res), path);
    if (!Array.isArray(list)) {
      return false;
    }
    const dir = direction === 'asc' ? 1 : -1;
    for (let i = 1; i < list.length; i += 1) {
      const previous = field ? getPath(list[i - 1], field) : list[i - 1];
      const current = field ? getPath(list[i], field) : list[i];
      if (previous === undefined || current === undefined) {
        return false;
      }
      const a = previous instanceof Date ? previous.getTime() : previous;
      const b = current instanceof Date ? current.getTime() : current;
      if (a < b && dir === -1) {
        return false;
      }
      if (a > b && dir === 1) {
        return false;
      }
    }
    return true;
  };
}

/** اعتبار صفحه‌بندی: شماره صفحه، اندازه، مجموع و هم‌خوانی تعداد آیتم‌ها. */
export function jsonPaginationValid(options) {
  const settings = options || {};
  const itemsPath = settings.itemsPath || 'items';
  const pagePath = settings.pagePath || 'page';
  const sizePath = settings.sizePath || 'size';
  const totalPath = settings.totalPath || 'total';
  const expectedPage = settings.expectedPage;

  return (res) => {
    const data = safeJson(res);
    const items = getPath(data, itemsPath);

    if (!Array.isArray(items)) {
      return false;
    }
    if (expectedPage !== undefined && getPath(data, pagePath) !== expectedPage) {
      return false;
    }
    const size = getPath(data, sizePath);
    if (typeof size === 'number' && items.length > size) {
      return false;
    }
    const total = getPath(data, totalPath);
    if (typeof total === 'number' && total < items.length) {
      return false;
    }
    return true;
  };
}

// ---------------------------------------------------------------------------
// ۳) هدرها و کوکی‌ها (Headers / Cookies)
// ---------------------------------------------------------------------------

export function hasHeader(name) {
  return (res) => !!res && headerValue(res.headers, name) !== undefined;
}

export function headerEquals(name, expected) {
  return (res) => headerString(res.headers, name) === expected;
}

export function headerIncludes(name, expectedPart) {
  return (res) => headerString(res.headers, name).indexOf(expectedPart) !== -1;
}

export function contentTypeIncludes(expectedPart) {
  return (res) => headerString(res.headers, 'Content-Type').toLowerCase().indexOf(String(expectedPart).toLowerCase()) !== -1;
}

export function charsetIsUtf8(res) {
  return contentTypeIncludes('charset=utf-8')(res);
}

export function cacheControlIncludes(expectedPart) {
  return (res) => headerString(res.headers, 'Cache-Control').toLowerCase().indexOf(String(expectedPart).toLowerCase()) !== -1;
}

const DEFAULT_SECURITY_HEADERS = [
  'X-Content-Type-Options',
  'X-Frame-Options',
  'Referrer-Policy',
];

/** وجود هدرهای امنیتی (پیش‌فرض یا لیست دلخواه؛ HSTS اختیاری چون فقط روی HTTPS معنا دارد). */
export function hasSecurityHeaders(headers) {
  const list = [].concat(headers || DEFAULT_SECURITY_HEADERS);
  return (res) => list.every((name) => !!res && headerValue(res.headers, name) !== undefined);
}

export function hasCookie(name) {
  return (res) => {
    if (!res || !res.cookies) {
      return false;
    }
    const cookie = res.cookies[name];
    return Array.isArray(cookie) ? cookie.length > 0 : !!cookie;
  };
}

/** بررسی فلگ‌های امنیتی کوکی: httpOnly / secure / sameSite. */
export function cookieHasFlag(name, flag, expectedValue) {
  return (res) => {
    if (!res || !res.cookies || !res.cookies[name]) {
      return false;
    }
    const list = [].concat(res.cookies[name]);
    if (list.length === 0) {
      return false;
    }
    const cookie = list[0];
    if (expectedValue === undefined) {
      return !!cookie[flag];
    }
    return String(cookie[flag]).toLowerCase() === String(expectedValue).toLowerCase();
  };
}

// ---------------------------------------------------------------------------
// ۴) زمان‌بندی (Timing)
// ---------------------------------------------------------------------------

function timing(res, key) {
  return res && res.timings ? res.timings[key] : undefined;
}

export function durationUnder(ms) {
  return (res) => typeof timing(res, 'duration') === 'number' && timing(res, 'duration') < ms;
}

export function waitingUnder(ms) {
  return (res) => typeof timing(res, 'waiting') === 'number' && timing(res, 'waiting') < ms;
}

export function connectingUnder(ms) {
  return (res) => typeof timing(res, 'connecting') === 'number' && timing(res, 'connecting') < ms;
}

export function tlsUnder(ms) {
  return (res) => typeof timing(res, 'tls_handshaking') === 'number' && timing(res, 'tls_handshaking') < ms;
}

export function sendingUnder(ms) {
  return (res) => typeof timing(res, 'sending') === 'number' && timing(res, 'sending') < ms;
}

export function receivingUnder(ms) {
  return (res) => typeof timing(res, 'receiving') === 'number' && timing(res, 'receiving') < ms;
}

export function blockedUnder(ms) {
  return (res) => typeof timing(res, 'blocked') === 'number' && timing(res, 'blocked') < ms;
}

export function redirectCountAtMost(maxRedirects) {
  return (res) => !!res && Array.isArray(res.redirects) && res.redirects.length <= maxRedirects;
}

export function redirectCountAtLeast(minRedirects) {
  return (res) => !!res && Array.isArray(res.redirects) && res.redirects.length >= minRedirects;
}

// ---------------------------------------------------------------------------
// ۵) امنیت (Security / عدم نشت اطلاعات)
// ---------------------------------------------------------------------------

const LEAK_PATTERNS = [
  'stacktrace',
  'Stack trace',
  'at java.',
  'at org.springframework',
  'Traceback (most recent call last)',
  'System.NullReferenceException',
  'SQLException',
  'SQLSTATE',
  'ORA-',
  'you have an error in your sql syntax',
  '/usr/local/app',
  'C:\\\\inetpub',
  'node_modules/',
];

/** عدم نشت Stack Trace / مسیر فایل / خطای دیتابیس در بدنهٔ پاسخ. */
export function noInformationLeak(res) {
  if (!res || typeof res.body !== 'string') {
    return false;
  }
  for (let i = 0; i < LEAK_PATTERNS.length; i += 1) {
    if (res.body.indexOf(LEAK_PATTERNS[i]) !== -1) {
      return false;
    }
  }
  return true;
}

export function noStackTrace(res) {
  if (!res || typeof res.body !== 'string') {
    return false;
  }
  return (
    res.body.indexOf('stacktrace') === -1 &&
    res.body.indexOf('Stack trace') === -1 &&
    res.body.indexOf('Traceback (most recent call last)') === -1
  );
}

export function noSqlError(res) {
  if (!res || typeof res.body !== 'string') {
    return false;
  }
  return (
    res.body.indexOf('SQLException') === -1 &&
    res.body.indexOf('SQLSTATE') === -1 &&
    res.body.indexOf('ORA-') === -1 &&
    res.body.toLowerCase().indexOf('sql syntax') === -1
  );
}

export function noServerHeaderDisclosure(res) {
  return !headerIncludes('Server', 'Apache/')(res) && !headerIncludes('X-Powered-By', '')(res);
}

// ---------------------------------------------------------------------------
// ۶) احراز هویت (Auth / Token)
// ---------------------------------------------------------------------------

export function tokenPresent(path) {
  return (res) => {
    const value = getPath(safeJson(res), path || 'token');
    return typeof value === 'string' && value.length > 0;
  };
}

/** بررسی ساختاری JWT: سه بخش Base64URL. */
export function jwtWellFormed(path) {
  return (res) => {
    const value = getPath(safeJson(res), path || 'token');
    if (typeof value !== 'string') {
      return false;
    }
    const parts = value.split('.');
    return parts.length === 3 && parts[0].length > 0 && parts[1].length > 0;
  };
}

/** بررسی انقضای JWT (فیلد exp). */
export function jwtNotExpired(path, clockSkewSeconds) {
  const skew = clockSkewSeconds === undefined ? 30 : clockSkewSeconds;
  return (res) => {
    const token = getPath(safeJson(res), path || 'token');
    if (typeof token !== 'string') {
      return false;
    }
    const parts = token.split('.');
    if (parts.length !== 3) {
      return false;
    }
    try {
      const payloadText = decodeBase64Url(parts[1]);
      const payload = JSON.parse(payloadText);
      if (typeof payload.exp !== 'number') {
        return true; // بدون exp یعنی توکن بدون انقضا
      }
      return payload.exp * 1000 > Date.now() - skew * 1000;
    } catch (error) {
      return false;
    }
  };
}

/** وضعیت‌های مورد انتظار در سناریوهای منفی (401/403/404). */
export function unauthorizedResponse(res) {
  return statusIn([401, 403])(res);
}

export function notFoundResponse(res) {
  return statusEquals(404)(res);
}

export function conflictResponse(res) {
  return statusEquals(409)(res);
}

export function tooManyRequestsResponse(res) {
  return statusEquals(429)(res);
}

// ---------------------------------------------------------------------------
// ۷) اعتبارسنجی کسب‌وکار (Business Validation)
// ---------------------------------------------------------------------------

/** حداقل یکی از مسیرها در پاسخ وجود داشته باشد (مثل orderId یا paymentId). */
export function hasAnyField(paths) {
  const list = [].concat(paths);
  return (res) => {
    const data = safeJson(res);
    return list.some((path) => hasPath(data, path));
  };
}

export function hasAllFields(paths) {
  const list = [].concat(paths);
  return (res) => {
    const data = safeJson(res);
    return list.every((path) => hasPath(data, path));
  };
}

/** مقدار مسیر برابر مقدار مورد انتظار باشد (مثل success === true). */
export function jsonPathTrue(path) {
  return jsonPathEquals(path, true);
}

/** عملیات تراکنشی: هم موفقیت اعلام شده و هم شناسهٔ تراکنش برگشته است. */
export function transactionSucceeded(options) {
  const settings = options || {};
  const successPath = settings.successPath || 'success';
  const idPath = settings.idPath || 'transactionId';
  return (res) => {
    const data = safeJson(res);
    const success = hasPath(data, successPath) ? getPath(data, successPath) === true : true;
    return success && hasPath(data, idPath);
  };
}

// ---------------------------------------------------------------------------
// ۸) ترکیب‌کننده‌ها (Combinators)
// ---------------------------------------------------------------------------

export function allOf() {
  const predicates = Array.prototype.slice.call(arguments);
  return (res) => predicates.every((predicate) => predicate(res));
}

export function anyOf() {
  const predicates = Array.prototype.slice.call(arguments);
  return (res) => predicates.some((predicate) => predicate(res));
}

export function not(predicate) {
  return (res) => !predicate(res);
}

/** اگر شرط برقرار بود، predicate دوم را اجرا کن (برای مسیرهای شرطی). */
export function when(condition, predicate) {
  return (res) => (condition(res) ? predicate(res) : true);
}

/** انتخاب predicate بر اساس وضعیت پاسخ (برای CRUD/سناریوهای چندوضعیتی). */
export function whenStatus(status, predicate) {
  return when(statusEquals(status), predicate);
}



