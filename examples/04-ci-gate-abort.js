/**
 * examples/04-ci-gate-abort.js — گیت CI با توقف زودهنگام (abortOnFail)
 * ----------------------------------------------------------------------------
 * با عبور نرخ خطا از بودجه، اجرا با تأخیر delayAbortEval متوقف می‌شود تا منابع
 * CI هدر نرود. نکتهٔ عملیاتی: exit code در این حالت هم 99 است؛ فقط زمان اجرا کم می‌شود.
 *
 * اجرا:
 *   k6 run examples/04-ci-gate-abort.js
 *   k6 run -e SLO_ERROR_RATE=0.001 -e SLO_ABORT_DELAY=10s examples/04-ci-gate-abort.js
 */

import http from 'k6/http';
import { sleep } from 'k6';
import {
  abortOnFailThresholds,
  runChecks,
  healthChecks,
  ON_FAIL,
  CHECK_TYPE,
  SEVERITY,
  baseUrl,
  HTTP_TIMEOUT,
} from '../index.js';

const BASE = baseUrl();

export const options = {
  // در CI معمولاً از سناریوی ثابت و کوتاه استفاده می‌کنیم:
  vus: 4,
  duration: '5s',
  thresholds: abortOnFailThresholds,
  // گیت‌های CI معمولاً می‌خواهند در صورت قطعی شدن شکست، سریع تمام شود:
  noConnectionReuse: false,
};

export default function () {
  const res = http.get(`${BASE}/health`, {
    timeout: HTTP_TIMEOUT,
    tags: { endpoint: 'health', type: 'api' },
  });

  runChecks(res, healthChecks({ successStatuses: [200] }), {
    endpoint: 'health',
    type: CHECK_TYPE.availability,
    severity: SEVERITY.critical,
    onFail: ON_FAIL.warn, // در گیت CI: در صورت نیاز به ON_FAIL.abort تغییر دهید
  });

  sleep(0.3);
}
