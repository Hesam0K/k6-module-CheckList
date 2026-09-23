/**
 * test-on-fara/smoke-test.js — تست فشار سریع (Smoke Test) سرویس تشخیص حالت سر
 * ============================================================================
 * سناریو:
 *   - ۵ کاربر مجازی (5 VUs)
 *   - مدت زمان: ۵ دقیقه (5m)
 *   - بدون sleep (ارسال پیوستهٔ درخواست‌ها)
 *
 * معیارهای کلیدی بررسی:
 *   ۱) تحت هر شرایطی p(95) زمان پاسخ باید زیر ۳ ثانیه (۳۰۰۰ میلی‌ثانیه) باشد.
 *   ۲) نرخ خطای درخواست‌ها کمتر از ۱ درصد باشد (http_req_failed < 0.01).
 *   ۳) محاسبهٔ توان عملیاتی بر دقیقه (RPM) جهت آماده‌سازی برای تست ظرفیت ایمن (> 200 req/min).
 *
 * استفاده از ماژول استاندارد k6-module.checks:
 *   - گارد ضد سبز شدن کاذب (Sample Guard)
 *   - مدیریت آستانه‌ها و اعتبارسنجی تگ‌دار (taggedSla / guardThreshold)
 *   - اعتبارسنجی قرارداد پاسخ (contractChecks) مطابق ساختار واقعی API
 *
 * نحوهٔ اجرا:
 *   k6 run -e API_KEY="your-token-here" test-on-fara/smoke-test.js
 *
 * متغیرهای محیطی اختیاری:
 *   -e API_URL="http://..."        آدرس اختصاصی سرویس
 *   -e K6_VUS=5                    تعداد کاربر مجازی (پیش‌فرض: 5)
 *   -e K6_DURATION=5m              مدت زمان تست (پیش‌فرض: 5m)
 * ============================================================================
 */

import http from 'k6/http';
import { group } from 'k6';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.2/index.js';
import {
  mergeThresholds,
  sampleGuard,
  taggedSla,
  guardThreshold,
  runChecks,
  healthChecks,
  contractChecks,
  CHECK_TYPE,
  SEVERITY,
  ON_FAIL,
} from '../index.js';

// ---------------------------------------------------------------------------
// ۱) پیکربندی مسیرها و بارگذاری مستقیم ویدئوها در مرحله Init
// ---------------------------------------------------------------------------
const basePath = './data/random_manner_videos';
const videoNames = [
  'video01.mp4', 'video02.mp4', 'video03.mp4',
  'video04.mp4', 'video05.mp4', 'video06.mp4', 'video07.mp4',
];

const loadedVideoData = [];

for (const name of videoNames) {
  const filePath = `${basePath}/${name}`;
  try {
    const rawFile = open(filePath, 'b');
    loadedVideoData.push({
      name: name,
      type: 'video/mp4',
      data: rawFile,
    });
  } catch (error) {
    console.error(`[INIT ERROR] Failed to load file ${filePath}: ${error}`);
  }
}

if (loadedVideoData.length === 0) {
  throw new Error('No video files found for the test. Please check the data/random_manner_videos directory path.');
}

// ---------------------------------------------------------------------------
// ۲) تنظیمات سناریو و آستانه‌ها (Options & Thresholds)
// ---------------------------------------------------------------------------
const API_URL = __ENV.API_URL || 'http://gesture-recognition.test.local.farashenasa.ir/gestureRecognition';
const API_KEY = __ENV.API_KEY || 'MISSING-API-KEY';
const TIMEOUT = __ENV.K6_TIMEOUT || '60s';

export const options = {
  scenarios: {
    gesture_smoke: {
      executor: 'constant-vus',
      // vus: Number(__ENV.K6_VUS || 5),
      vus: Number(5),
      // duration: __ENV.K6_DURATION || '10s',
      duration: '10s',
      gracefulStop: '30s',
      tags: { scenario: 'gesture_smoke' },
    },
  },
  thresholds: mergeThresholds(
    // گارد ضد سبز شدن کاذب (باید حداقل ۱ درخواست ارسال شده باشد)
    sampleGuard(),

    // معیار ۱: نرخ خطای کل کمتر از ۱٪ باشد
    { http_req_failed: ['rate<0.01'] },

    // معیار ۲ (حیاتی): p(95) زمان پاسخ کمتر از ۳ ثانیه (۳۰۰۰ میلی‌ثانیه) باشد
    { http_req_duration: ['p(95)<3000'] },

    // تفکیک تگ‌دار روی متد تشخیص حالت سر
    taggedSla('http_req_duration', {
      'endpoint:gestureRecognition': ['p(95)<3000'],
    }),

    // بررسی سلامت و قرارداد پاسخ با فریمورک
    { checks: ['rate>0.99'] },
    taggedSla('checks', {
      'type:availability': ['rate>0.99'],
      'type:contract': ['rate>0.99'],
    }),

    // گارد تگ‌محور برای اطمینان از اجرای چک‌ها
    guardThreshold({ endpoint: 'gestureRecognition' })
  ),
};

export function setup() {
  console.log('────────────────────────────────────────────────────────────');
  console.log(`  Gesture Recognition Smoke Test`);
  console.log(`  Start Time: ${new Date().toISOString()}`);
  console.log(`  Server URL: ${API_URL}`);
  //console.log(`  Virtual Users (VUs): ${options.scenarios.gesture_smoke.vus}`);
  //console.log(`  Duration: ${options.scenarios.gesture_smoke.duration} (No Sleep)`);
  console.log(`  Target Criteria: p(95) < 3000ms & Error Rate < 1%`);
  console.log('────────────────────────────────────────────────────────────');
  return {};
}

// ---------------------------------------------------------------------------
// ۳) بدنهٔ اصلی تست (بدون Sleep به ازای هر تکرار)
// ---------------------------------------------------------------------------
export default function () {
  // انتخاب تصادفی یک ویدئو از آرایهٔ پیش‌بارگذاری‌شده
  const randomIndex = Math.floor(Math.random() * loadedVideoData.length);
  const selectedVideo = loadedVideoData[randomIndex];

  group('GestureRecognition_HeadPose', function () {
    const apiParams = {
      headers: {
        'x-api-key': API_KEY,
      },
      timeout: TIMEOUT,
      tags: {
        endpoint: 'gestureRecognition',
        flow: 'head_pose',
      },
    };

    const apiFormData = {
      type: 'head_pose',
      pattern0: 'left',
      pattern1: 'right',
      video: http.file(selectedVideo.data, selectedVideo.name, selectedVideo.type),
    };

    const response = http.post(API_URL, apiFormData, apiParams);

    // ۱) بررسی سلامت سطح پروتکل HTTP و عدم خطای ارتباط شبکه
    runChecks(response, healthChecks({ successStatuses: [200] }), {
      endpoint: 'gestureRecognition',
      flow: 'head_pose',
      type: CHECK_TYPE.availability,
      severity: SEVERITY.critical,
      onFail: ON_FAIL.none,
    });

    // ۲) بررسی ساختار و محتوای بیزینسی پاسخ (مطابق نمونه پاسخ‌های واقعی سرویس)
    runChecks(
      response,
      contractChecks({
        requiredPaths: ['status', 'data.message', 'data.result', 'meta.request_id'],
        typedPaths: {
          status: 'integer',
          'data.message': 'string',
          'data.result.verified': 'boolean',
          'data.result.head_pose': 'number',
        },
        expectedValues: {
          status: 200,
          'data.message': 'Success',
        },
        nonEmptyArrayPaths: ['data.result.predicted_classes'],
      }),
      {
        endpoint: 'gestureRecognition',
        flow: 'head_pose',
        type: CHECK_TYPE.contract,
        severity: SEVERITY.critical,
        onFail: ON_FAIL.none,
      }
    );

    // چاپ لاگ عیب‌یابی فقط در صورت خطای پاسخ برای عدم افت پرفورمنس
    if (response.status !== 200) {
      console.warn(`[FAIL] Status Code: ${response.status} | Duration: ${response.timings.duration}ms | Response: ${response.body ? response.body.slice(0, 250) : 'Empty'}`);
    }
  });

  // بدون sleep طبق خواستهٔ شما: درخواست‌ها بلافاصله و پشت سر هم ارسال می‌شوند.
}

// ---------------------------------------------------------------------------
// ۴) گزارش تحلیلی در پایان تست
// ---------------------------------------------------------------------------
function formatMs(value) {
  return typeof value === 'number' ? `${value.toFixed(1)}ms` : 'n/a';
}

export function handleSummary(data) {
  const durationMs = data.state && data.state.testRunDurationMs ? data.state.testRunDurationMs : 0;
  const durationSec = durationMs / 1000;
  const totalReqs = data.metrics.http_reqs ? data.metrics.http_reqs.values.count : 0;
  const rpm = durationSec > 0 ? (totalReqs / (durationSec / 60)) : 0;

  const durationMetric = data.metrics.http_req_duration ? data.metrics.http_req_duration.values : {};
  const p95 = durationMetric['p(95)'];
  const avg = durationMetric.avg;
  const max = durationMetric.max;

  const failRate = data.metrics.http_req_failed ? data.metrics.http_req_failed.values.rate * 100 : 0;
  const checksRate = data.metrics.checks ? data.metrics.checks.values.rate * 100 : 0;

  const p95Pass = typeof p95 === 'number' && p95 < 3000;
  const errorPass = failRate < 1;

  const lines = [];
  lines.push('='.repeat(70));
  lines.push('             Smoke Test Evaluation Report (Gesture Service)           ');
  lines.push('='.repeat(70));
  lines.push(`Total Duration: ${(durationSec / 60).toFixed(2)} minutes (${durationSec.toFixed(1)} seconds)`);
  lines.push(`Total Requests: ${totalReqs}`);
  lines.push(`Recorded Throughput (RPM): ${rpm.toFixed(1)} requests/minute`);
  lines.push('');
  lines.push('── Dual Criteria Check ──');
  lines.push(`1) Latency p(95) < 3000ms:   [ ${p95Pass ? 'PASS ✓' : 'FAIL ✗'} ] (Value: ${formatMs(p95)} | avg: ${formatMs(avg)} | max: ${formatMs(max)})`);
  lines.push(`2) HTTP Error Rate < 1%:     [ ${errorPass ? 'PASS ✓' : 'FAIL ✗'} ] (Value: ${failRate.toFixed(2)}%)`);
  lines.push(`3) Checks Success Rate:       ${checksRate.toFixed(2)}%`);
  lines.push('');
  lines.push('── Safe Capacity Test Readiness ──');
  lines.push(`Future Capacity Goal: Higher than 200 requests/minute (> 200 RPM)`);
  if (rpm >= 200 && p95Pass && errorPass) {
    lines.push('Initial Result with 5 VUs: Server successfully achieved over 200 RPM while maintaining p(95) under 3 seconds.');
  } else if (!p95Pass) {
    lines.push('Initial Warning: Server failed to maintain p(95) response time under 3 seconds.');
  } else {
    lines.push(`Recorded throughput in Smoke Test was ${rpm.toFixed(1)} RPM. To achieve over 200 RPM, incremental load must be applied in the next test.`);
  }
  lines.push('='.repeat(70));

  const defaultReportColor = textSummary(data, { indent: ' ', enableColors: true });
  const defaultReportNoColor = textSummary(data, { indent: ' ', enableColors: false });
  const customReport = lines.join('\n') + '\n';

  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const timestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}`;
  const reportPath = `test-on-fara/reports/smoke-test-summary_${timestamp}.txt`;

  const output = {
    stdout: defaultReportColor + '\n\n' + customReport,
  };
  output[reportPath] = defaultReportNoColor + '\n\n' + customReport;

  return output;
}
