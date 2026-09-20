/**
 * checks/internals.js — ابزارهای خالص (بدون import از k6)
 * ----------------------------------------------------------------------------
 * این توابع هیچ وابستگی به k6 ندارند تا منطق ماژول قابل استفادهٔ مجدد و
 * قابل تست باشد (predicates و schema روی همین‌ها بنا شده‌اند).
 */

/** آیا مقدار یک آبجکت ساده است؟ */
export function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** تبدیل امن بدنهٔ پاسخ به JSON؛ در صورت خطا null. */
export function safeJson(res) {
  if (!res || typeof res.body !== 'string' || res.body === '') {
    return null;
  }
  try {
    return JSON.parse(res.body);
  } catch (error) {
    return null;
  }
}

/**
 * خواندن مقدار از مسیر رشته‌ای: 'data.items[0].id'
 * از براکت برای ایندکس آرایه و از نقطه برای کلید آبجکت استفاده می‌کند.
 */
export function getPath(source, path) {
  if (source === undefined || source === null || !path) {
    return undefined;
  }

  const normalized = String(path)
    .replace(/\[(\d+)\]/g, '.$1')
    .split('.')
    .filter((segment) => segment !== '');

  let current = source;
  for (let i = 0; i < normalized.length; i += 1) {
    if (current === undefined || current === null) {
      return undefined;
    }
    const key = normalized[i];
    if (typeof current !== 'object') {
      return undefined;
    }
    current = current[key];
  }
  return current;
}

/** آیا مسیر در آبجکت وجود دارد (حتی اگر مقدارش null باشد)؟ */
export function hasPath(source, path) {
  if (source === undefined || source === null || !path) {
    return false;
  }

  const normalized = String(path)
    .replace(/\[(\d+)\]/g, '.$1')
    .split('.')
    .filter((segment) => segment !== '');

  let current = source;
  for (let i = 0; i < normalized.length; i += 1) {
    if (typeof current !== 'object' || current === null) {
      return false;
    }
    const key = normalized[i];
    if (!Object.prototype.hasOwnProperty.call(current, key)) {
      return false;
    }
    current = current[key];
  }
  return true;
}

/** طول بدنهٔ پاسخ (با احتساب صفر برای بدنهٔ ناموجود). */
export function bodyLength(res) {
  if (!res || typeof res.body !== 'string') {
    return 0;
  }
  return res.body.length;
}

/** برش امن رشته برای لاگ. */
export function truncate(text, maxLength) {
  const limit = maxLength || 400;
  const value = text === undefined || text === null ? '' : String(text);
  return value.length > limit ? `${value.slice(0, limit)}…` : value;
}

/** نرمال‌سازی مقدار هدر (k6 مقادیر هدر را به‌صورت رشته یا آرایه برمی‌گرداند). */
export function headerValue(headers, name) {
  if (!headers) {
    return undefined;
  }
  const direct = headers[name];
  if (direct !== undefined) {
    return direct;
  }
  const lowered = String(name).toLowerCase();
  const keys = Object.keys(headers);
  for (let i = 0; i < keys.length; i += 1) {
    if (keys[i].toLowerCase() === lowered) {
      return headers[keys[i]];
    }
  }
  return undefined;
}

/** تبدیل مقدار هدر به رشتهٔ قابل مقایسه. */
export function headerString(headers, name) {
  const value = headerValue(headers, name);
  if (value === undefined || value === null) {
    return '';
  }
  return Array.isArray(value) ? value.join(',') : String(value);
}

/** درصد سادهٔ امن. */
export function safeRatio(passed, total) {
  return total === 0 ? 0 : passed / total;
}

const BASE64URL_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

/**
 * دیکد Base64URL به رشتهٔ UTF-8 — پیاده‌سازی دستی.
 * چرا دستی؟ چون Buffer مخصوص Node است و atob در همهٔ نسخه‌های k6 تضمینی نیست؛
 * این تابع در k6 و Node نتیجهٔ یکسان می‌دهد.
 */
export function decodeBase64Url(value) {
  const source = String(value);
  const bytes = [];
  let buffer = 0;
  let bits = 0;

  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (char === '=') {
      break;
    }
    const index = BASE64URL_ALPHABET.indexOf(char);
    if (index === -1) {
      return '';
    }
    buffer = (buffer << 6) | index;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
    }
  }

  // تبدیل بایت‌های UTF-8 به رشته
  let text = '';
  for (let i = 0; i < bytes.length; i += 1) {
    const byte = bytes[i];
    if (byte < 0x80) {
      text += String.fromCharCode(byte);
    } else if (byte >= 0xc0 && byte < 0xe0 && i + 1 < bytes.length) {
      text += String.fromCharCode(((byte & 0x1f) << 6) | (bytes[i + 1] & 0x3f));
      i += 1;
    } else if (byte >= 0xe0 && byte < 0xf0 && i + 2 < bytes.length) {
      text += String.fromCharCode(((byte & 0x0f) << 12) | ((bytes[i + 1] & 0x3f) << 6) | (bytes[i + 2] & 0x3f));
      i += 2;
    }
  }

  return text;
}

/** انکود رشته به Base64URL (برای تست ها و ساخت توکن ساختگی). */
export function encodeBase64Url(text) {
  const bytes = [];
  const source = String(text);
  for (let i = 0; i < source.length; i += 1) {
    const code = source.charCodeAt(i);
    if (code < 0x80) {
      bytes.push(code);
    } else if (code < 0x800) {
      bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else {
      bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    }
  }

  let output = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < bytes.length ? bytes[i + 1] : undefined;
    const b2 = i + 2 < bytes.length ? bytes[i + 2] : undefined;

    output += BASE64URL_ALPHABET[b0 >> 2];
    output += BASE64URL_ALPHABET[((b0 & 3) << 4) | (b1 === undefined ? 0 : b1 >> 4)];
    if (b1 === undefined) {
      break;
    }
    output += BASE64URL_ALPHABET[((b1 & 15) << 2) | (b2 === undefined ? 0 : b2 >> 6)];
    if (b2 === undefined) {
      break;
    }
    output += BASE64URL_ALPHABET[b2 & 63];
  }

  return output;
}
