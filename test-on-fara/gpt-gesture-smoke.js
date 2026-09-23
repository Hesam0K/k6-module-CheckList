import http from 'k6/http';

import {
  mergeThresholds,
  sampleGuard,
  errorBudget,
  checksReliability,
  taggedSla,
  combineChecks,
  healthChecks,
  contractChecks,
  runChecks,
  CHECK_TYPE,
  SEVERITY,
  ON_FAIL,
} from '../index.js';


// ============================================================
// Configuration
// ============================================================

const API_URL =
  __ENV.API_URL ||
  'http://gesture-recognition.test.local.farashenasa.ir/gestureRecognition';

const API_KEY = __ENV.API_KEY || '';

const TEST_DURATION = '10s';
const VUS = 5;


// ============================================================
// Test Data
// ============================================================

const basePath = '../../data/random_manner_videos';

const videoNames = [
  'video01.mp4',
  'video02.mp4',
  'video03.mp4',
  'video04.mp4',
  'video05.mp4',
  'video06.mp4',
  'video07.mp4',
];


// ------------------------------------------------------------
// Load video files once during k6 init stage
// ------------------------------------------------------------

const loadedVideoData = [];

for (const name of videoNames) {
  const filePath = `${basePath}/${name}`;

  try {
    const rawFile = open(filePath, 'b');

    loadedVideoData.push({
      name,
      type: 'video/mp4',
      data: rawFile,
    });
  } catch (error) {
    console.error(`Failed to load video ${filePath}: ${error}`);
  }
}

if (loadedVideoData.length === 0) {
  throw new Error('No video files were loaded.');
}


// ============================================================
// Thresholds
// ============================================================
//
// Operational SLO:
//   p95 response time < 3000 ms
//
// Additional reliability criteria:
//   HTTP failure rate < 1%
//   Check success rate > 99%
//   At least one HTTP sample must exist
//
// ============================================================

export const options = {
  scenarios: {
    gesture_smoke_5vu_5m: {
      executor: 'constant-vus',

      vus: VUS,

      duration: TEST_DURATION,

      // No sleep is used in the iteration.
      // VUs start the next iteration immediately after
      // the previous request/checks finish.
      gracefulStop: '0s',

      tags: {
        test_type: 'smoke',
        scenario: 'gesture_recognition',
      },
    },
  },

  thresholds: mergeThresholds(

    // --------------------------------------------------------
    // 1. Sample Guard
    // --------------------------------------------------------
    //
    // Prevents a false-green result when no HTTP samples exist.
    //
    sampleGuard(),

    // --------------------------------------------------------
    // 2. HTTP Error Budget
    // --------------------------------------------------------
    //
    // Less than 1% of requests may be considered failed by k6.
    //
    errorBudget({
      failedRate: 0.01,
    }),

    // --------------------------------------------------------
    // 3. Overall Check Reliability
    // --------------------------------------------------------
    //
    // At least 99% of framework checks must pass.
    //
    checksReliability({
      checksRate: 0.99,
    }),

    // --------------------------------------------------------
    // 4. Primary Operational SLA
    // --------------------------------------------------------
    //
    // The most important criterion for this service:
    //
    // p95 response time < 3000 ms
    //
    taggedSla('http_req_duration', {
      'endpoint:gesture_recognition': [
        'p(95)<3000',
      ],
    }),

    // --------------------------------------------------------
    // 5. Ensure the endpoint-specific check group
    //    also has a 99% success rate.
    // --------------------------------------------------------
    //
    taggedSla('checks', {
      'endpoint:gesture_recognition': [
        'rate>0.99',
      ],
    }),
  ),
};


// ============================================================
// Helper: Random Video
// ============================================================

function getRandomVideo() {
  const randomIndex = Math.floor(
    Math.random() * loadedVideoData.length
  );

  return loadedVideoData[randomIndex];
}


// ============================================================
// Main Scenario
// ============================================================

export default function () {

  const selectedVideo = getRandomVideo();


  // ----------------------------------------------------------
  // HTTP Request
  // ----------------------------------------------------------

  const response = http.post(
    API_URL,

    {
      type: 'head_pose',

      pattern0: 'left',

      pattern1: 'right',

      video: http.file(
        selectedVideo.data,
        selectedVideo.name,
        selectedVideo.type
      ),
    },

    {
      headers: {
        'x-api-key': API_KEY,
      },

      timeout: '60s',

      tags: {
        endpoint: 'gesture_recognition',
        flow: 'head_pose',
        test_type: 'smoke',
      },
    }
  );


  // ----------------------------------------------------------
  // Checks
  // ----------------------------------------------------------
  //
  // We combine:
  //
  //   Health checks
  //   +
  //   Response contract checks
  //
  // ----------------------------------------------------------

  const checks = combineChecks(

    // Basic HTTP health
    healthChecks({
      successStatuses: [200],
      expectBody: true,
    }),

    // Response contract
    contractChecks({
      requiredPaths: [
        'status',
        'data',
        'data.result',
        'data.result.verified',
        'data.result.head_pose',
        'data.result.predicted_classes',
        'data.message',
        'meta',
        'meta.request_id',
        'meta.date',
      ],

      nonEmptyArrayPaths: [
        'data.result.predicted_classes',
      ],

      typedPaths: {
        status: 'integer',
        'data.result.verified': 'boolean',
        'data.result.head_pose': 'number',
        'meta.request_id': 'string',
        'meta.date': 'string',
      },

      expectedValues: {
        status: 200,
        'data.message': 'Success',
        'data.result.verified': true,
      },
    })
  );


  // ----------------------------------------------------------
  // Run Framework Checks
  // ----------------------------------------------------------

  runChecks(
    response,
    checks,
    {
      endpoint: 'gesture_recognition',

      flow: 'head_pose',

      type: CHECK_TYPE.contract,

      severity: SEVERITY.critical,

      onFail: ON_FAIL.warn,

      verbose: true,

      maxBodyLength: 2000,
    }
  );
}
