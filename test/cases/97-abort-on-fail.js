/**
 * test/cases/97-abort-on-fail.js — کیس منفی: توقف زودهنگام با abortOnFail
 * ----------------------------------------------------------------------------
 * درخواست‌ها عمداً به پورتی می‌روند که سرویسی روی آن نیست (خطای فوری شبکه).
 * با abortOnFail و delayAbortEval کوتاه، اجرا باید پیش از پایان duration متوقف
 * شود و exit code آن 99 باشد.
 *
 * نکته: درخواست‌های ناموفق شبکه‌ای «نمونهٔ زمانی» تولید نمی‌کنند، پس آستانهٔ
 * http_req_duration روی آن‌ها بی‌اثر است — به همین دلیل این کیس روی
 * http_req_failed تست می‌شود و Sample Guard هم دارد.
 */

import http from 'k6/http';
import { sampleGuard, mergeThresholds } from '../../index.js';

const DEAD_URL = __ENV.DEAD_URL || 'http://127.0.0.1:1/never';

export const options = {
  vus: 2,
  duration: '8s',
  thresholds: mergeThresholds(sampleGuard(), {
    http_req_failed: [
      { threshold: 'rate<0.5', abortOnFail: true, delayAbortEval: '1s' },
    ],
  }),
};

export default function () {
  http.get(DEAD_URL, { tags: { endpoint: 'dead', type: 'api' } });
}
