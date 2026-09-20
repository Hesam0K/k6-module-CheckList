/**
 * checks/schema.js — اعتبارسنجی ساختار JSON (Contract Validation) بدون وابستگی
 * ----------------------------------------------------------------------------
 * در k6 کتابخانه‌ای مثل AJV به‌صورت پیش‌فرض موجود نیست؛ این مینیمال-validator
 * زیرمجموعهٔ پرکاربرد JSON Schema را پوشش می‌دهد تا «Contract Break» گرفته شود.
 *
 * پشتیبانی: type, nullable, required, properties, additionalProperties,
 *           items, enum, minLength/maxLength, pattern, minimum/maximum,
 *           minItems/maxItems, uniqueItems, minProperties/maxProperties
 *
 * مستندات محلی : ../docs/04-checks-catalog.md
 * Wiki         : https://gitlab.partdp.ir/judicial-services/idadgar/backlog/-/wikis/k6-test-conditions-standard  (TODO)
 */

import { isPlainObject, getPath, hasPath, safeJson } from './internals.js';

function typeOf(value) {
  if (value === null) {
    return 'null';
  }
  if (Array.isArray(value)) {
    return 'array';
  }
  if (typeof value === 'number') {
    return Number.isInteger(value) ? 'integer' : 'number';
  }
  return typeof value;
}

function typeMatches(value, expected) {
  const actual = typeOf(value);
  if (expected === 'number') {
    return actual === 'number' || actual === 'integer';
  }
  if (expected === 'integer') {
    return actual === 'integer';
  }
  return actual === expected;
}

/**
 * اعتبارسنجی یک مقدار بر اساس schema.
 * @returns {string[]} لیست خطاها (خالی = معتبر)
 */
export function validateSchema(data, schema, path) {
  const location = path || '$';
  const errors = [];

  if (!isPlainObject(schema)) {
    return errors;
  }

  if (schema.nullable === true && data === null) {
    return errors;
  }

  if (schema.type !== undefined) {
    const expectedTypes = [].concat(schema.type);
    const matched = expectedTypes.some((expected) => typeMatches(data, expected));
    if (!matched) {
      errors.push(`${location}: نوع مقدار «${typeOf(data)}» است اما «${expectedTypes.join('|')}» انتظار می‌رفت.`);
      return errors;
    }
  }

  if (Array.isArray(schema.enum) && schema.enum.indexOf(data) === -1) {
    errors.push(`${location}: مقدار در لیست enum مجاز نیست.`);
  }

  if (typeof data === 'string') {
    if (schema.minLength !== undefined && data.length < schema.minLength) {
      errors.push(`${location}: طول رشته کمتر از ${schema.minLength} است.`);
    }
    if (schema.maxLength !== undefined && data.length > schema.maxLength) {
      errors.push(`${location}: طول رشته بیشتر از ${schema.maxLength} است.`);
    }
    if (schema.pattern !== undefined && !new RegExp(schema.pattern).test(data)) {
      errors.push(`${location}: مقدار با الگوی «${schema.pattern}» مطابقت ندارد.`);
    }
  }

  if (typeof data === 'number') {
    if (schema.minimum !== undefined && data < schema.minimum) {
      errors.push(`${location}: مقدار کمتر از حداقل مجاز (${schema.minimum}) است.`);
    }
    if (schema.maximum !== undefined && data > schema.maximum) {
      errors.push(`${location}: مقدار بیشتر از حداکثر مجاز (${schema.maximum}) است.`);
    }
  }

  if (Array.isArray(data)) {
    errors.push.apply(errors, validateArray(data, schema, location));
  }

  if (isPlainObject(data)) {
    errors.push.apply(errors, validateObject(data, schema, location));
  }

  return errors;
}

function validateArray(data, schema, location) {
  const errors = [];

  if (schema.minItems !== undefined && data.length < schema.minItems) {
    errors.push(`${location}: تعداد آیتم‌ها کمتر از ${schema.minItems} است.`);
  }
  if (schema.maxItems !== undefined && data.length > schema.maxItems) {
    errors.push(`${location}: تعداد آیتم‌ها بیشتر از ${schema.maxItems} است.`);
  }
  if (schema.uniqueItems === true) {
    const seen = {};
    data.forEach((item, index) => {
      const key = JSON.stringify(item);
      if (seen[key] === true) {
        errors.push(`${location}[${index}]: آیتم تکراری است.`);
      }
      seen[key] = true;
    });
  }
  if (schema.items !== undefined) {
    if (Array.isArray(schema.items)) {
      schema.items.forEach((itemSchema, index) => {
        if (index < data.length) {
          errors.push.apply(errors, validateSchema(data[index], itemSchema, `${location}[${index}]`));
        }
      });
    } else {
      data.forEach((item, index) => {
        errors.push.apply(errors, validateSchema(item, schema.items, `${location}[${index}]`));
      });
    }
  }

  return errors;
}

function validateObject(data, schema, location) {
  const errors = [];
  const keys = Object.keys(data);

  if (schema.minProperties !== undefined && keys.length < schema.minProperties) {
    errors.push(`${location}: تعداد کلیدها کمتر از ${schema.minProperties} است.`);
  }
  if (schema.maxProperties !== undefined && keys.length > schema.maxProperties) {
    errors.push(`${location}: تعداد کلیدها بیشتر از ${schema.maxProperties} است.`);
  }

  if (Array.isArray(schema.required)) {
    schema.required.forEach((requiredKey) => {
      if (!Object.prototype.hasOwnProperty.call(data, requiredKey)) {
        errors.push(`${location}: فیلد الزامی «${requiredKey}» وجود ندارد.`);
      }
    });
  }

  if (isPlainObject(schema.properties)) {
    Object.keys(schema.properties).forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        errors.push.apply(errors, validateSchema(data[key], schema.properties[key], `${location}.${key}`));
      }
    });

    if (schema.additionalProperties === false) {
      const allowed = Object.keys(schema.properties);
      keys.forEach((key) => {
        if (allowed.indexOf(key) === -1) {
          errors.push(`${location}: فیلد اضافی «${key}» مجاز نیست.`);
        }
      });
    }
  }

  return errors;
}

/** Predicate: ساختار JSON پاسخ با schema مطابقت دارد. */
export function matchesSchema(schema) {
  return (res) => validateSchema(safeJson(res), schema).length === 0;
}

/** بررسی ساختار یک دادهٔ دلخواه (نه Response). */
export function isValidAgainstSchema(data, schema) {
  return validateSchema(data, schema).length === 0;
}

/** Predicate: مقدار مسیر داده‌شده با schema معتبر باشد. */
export function pathMatchesSchema(path, schema) {
  return (res) => {
    const data = safeJson(res);
    if (!hasPath(data, path)) {
      return false;
    }
    return validateSchema(getPath(data, path), schema).length === 0;
  };
}

/** لیست خطاهای schema برای لاگ (در سناریوهای عیب‌یابی). */
export function schemaErrors(res, schema) {
  return validateSchema(safeJson(res), schema);
}

