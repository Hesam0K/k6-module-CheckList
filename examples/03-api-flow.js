/**
 * examples/03-api-flow.js — جریان کسب‌وکار با تگ flow (Login → Profile → Products)
 * ----------------------------------------------------------------------------
 * هدف: SLA جداگانه برای هر مرحله از یک تراکنش، فقط با تگ — نه با متریک سفارشی.
 *
 * قاعده: تگ flow روی درخواست ها + آستانه روی 'http_req_duration{flow:...}'
 *        و 'checks{flow:...}' (که runner به‌صورت خودکار می‌سازد).
 *
 * اجرا:  k6 run examples/03-api-flow.js
 */

import http from 'k6/http';
import { sleep } from 'k6';
import {
  businessSlaThresholds,
  validateSchema,
  runChecks,
  healthChecks,
  authChecks,
  contractChecks,
  CHECK_TYPE,
  SEVERITY,
  ON_FAIL,
  baseUrl,
  HTTP_TIMEOUT,
} from '../index.js';

const BASE = baseUrl();

export const options = {
  vus: 3,
  duration: '5s',
  thresholds: businessSlaThresholds({
    latency: {
      'flow:login': ['p(95)<800', 'p(99)<1500'],
      'flow:profile': ['p(95)<600'],
      'flow:catalog': ['p(95)<1200'],
    },
    success: {
      'flow:login': ['rate>0.99'],
      'flow:profile': ['rate>0.99'],
      'flow:catalog': ['rate>0.99'],
    },
  }),
};

const PROFILE_SCHEMA = {
  type: 'object',
  required: ['userId', 'role'],
  properties: {
    userId: { type: 'string', minLength: 1 },
    role: { type: 'string' },
  },
};

export default function () {
  // ۱) ورود
  const login = http.post(`${BASE}/login`, JSON.stringify({ username: 'tester', password: 'secret' }), {
    timeout: HTTP_TIMEOUT,
    headers: { 'Content-Type': 'application/json' },
    tags: { endpoint: 'login', flow: 'login', step: '1' },
  });
  const loginOk = runChecks(
    login,
    authChecks({ tokenPath: 'token', cookieName: 'session_id' }),
    {
      endpoint: 'login',
      flow: 'login',
      type: CHECK_TYPE.business,
      severity: SEVERITY.critical,
      onFail: ON_FAIL.warn,
    }
  );

  if (!loginOk) {
    // مسیر شرطی: ادامه نده (login ناموفق = دادهٔ نامعتبر برای مراحل بعد)
    console.warn('login failed → skipping the rest of the flow');
    return;
  }

  const token = login.json('token');

  // ۲) پروفایل با توکن
  const profile = http.get(`${BASE}/profile`, {
    timeout: HTTP_TIMEOUT,
    headers: { Authorization: `Bearer ${token}` },
    tags: { endpoint: 'profile', flow: 'profile', step: '2' },
  });
  runChecks(profile, contractChecks({ schema: PROFILE_SCHEMA, requiredPaths: ['userId'] }), {
    endpoint: 'profile',
    flow: 'profile',
    type: CHECK_TYPE.contract,
    severity: SEVERITY.critical,
    onFail: ON_FAIL.warn,
  });
  // نمونهٔ استفاده از validator بدون runner (برای بررسی دلخواه روی دادهٔ پارس‌شده)
  const schemaErrors = validateSchema(profile.json(), PROFILE_SCHEMA);
  if (schemaErrors.length > 0) {
    console.warn(`profile schema issues: ${schemaErrors.join(' | ')}`);
  }

  // ۳) کاتالوگ
  const catalog = http.get(`${BASE}/products?page=2&size=5`, {
    timeout: HTTP_TIMEOUT,
    tags: { endpoint: 'products', flow: 'catalog', step: '3' },
  });
  runChecks(catalog, healthChecks({ successStatuses: [200] }), {
    endpoint: 'products',
    flow: 'catalog',
    type: CHECK_TYPE.http,
    severity: SEVERITY.normal,
    onFail: ON_FAIL.warn,
  });

  sleep(0.5);
}
