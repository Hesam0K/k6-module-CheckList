/**
 * test/run-e2e.mjs — هماهنگ‌کنندهٔ تست‌های end-to-end ماژول
 * ----------------------------------------------------------------------------
 * ۱) Mock server را در همین پروسه بالا می‌آورد.
 * ۲) k6 inspect روی همهٔ مثال‌ها (اعتبارسنجی کانفیگ، بدون اجرا).
 * ۳) اجرای واقعی مثال‌ها + تست‌های خودآزما + کیس‌های منفی با assert روی exit code.
 *
 * اجرا:  node test/run-e2e.mjs
 * exit code نهایی: 0 اگر همهٔ انتظارها برآورده شوند، در غیر این صورت 1.
 *
 * نکته: بدون هیچ npm dependency؛ فقط Node استاندارد + باینری k6.
 */

import { spawn } from 'node:child_process';
import { startServer } from './mock-server.mjs';

const PORT = Number(process.env.MOCK_PORT || 8099);
const K6 = process.platform === 'win32' ? 'k6.exe' : 'k6';
const FAST_LOAD = ['-u', '2', '-d', '3s'];

/**
 * ساخت env تمیز برای k6:
 * - متغیرهای پروکسی سازمانی حذف می‌شوند تا ترافیک loopback گره نخورد.
 * - BASE_URL روی mock server تنظیم می‌شود.
 */
function buildEnv(extraEnv) {
  const env = Object.assign({}, process.env, { BASE_URL: `http://127.0.0.1:${PORT}` }, extraEnv || {});
  delete env.HTTP_PROXY;
  delete env.HTTPS_PROXY;
  delete env.http_proxy;
  delete env.https_proxy;
  env.NO_PROXY = '127.0.0.1,localhost';
  env.no_proxy = '127.0.0.1,localhost';
  return env;
}

/**
 * اجرای k6 به‌صورت «غیرهمزمان».
 * نکتهٔ مهم: از spawnSync استفاده نمی‌کنیم چون event loop نود را قفل می‌کند و
 * mock server (که در همین پروسه اجراست) دیگر نمی‌تواند به درخواست‌ها پاسخ دهد.
 */
function runK6(args, extraEnv) {
  return new Promise((resolve) => {
    const started = Date.now();
    const child = spawn(K6, args, { env: buildEnv(extraEnv), stdio: ['ignore', 'pipe', 'pipe'] });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('close', (code) => {
      resolve({ exitCode: code, stdout, stderr, elapsedMs: Date.now() - started });
    });
    child.on('error', (error) => {
      resolve({ exitCode: -1, stdout, stderr: `${error.message}\n${stderr}`, elapsedMs: Date.now() - started });
    });
  });
}

const INSPECT_TARGETS = [
  'base-stress-test.js',
  'examples/01-smoke.js',
  'examples/02-tagged-thresholds.js',
  'examples/03-api-flow.js',
  'examples/04-ci-gate-abort.js',
  'examples/05-diagnostic.js',
  'examples/06-checks-with-guards.js',
  'examples/07-custom-metrics-tagged.js',
  'examples/08-breakpoint.js',
  'examples/09-compose-and-scope.js',
  'examples/10-negative-and-chaos.js',
  'test/00-config-integrity.js',
  'test/self-test-checks.js',
  'test/cases/99-negative-thresholds.js',
  'test/cases/97-abort-on-fail.js',
];

const CASES = [
  { name: 'self-test: config integrity', args: ['run', '--quiet', 'test/00-config-integrity.js'], expect: 0 },
  { name: 'self-test: checks & schema', args: ['run', '--quiet', 'test/self-test-checks.js'], expect: 0 },
  { name: 'example 01 smoke', args: ['run', '--quiet'].concat(FAST_LOAD, ['examples/01-smoke.js']), expect: 0 },
  { name: 'example 02 tagged thresholds', args: ['run', '--quiet'].concat(FAST_LOAD, ['examples/02-tagged-thresholds.js']), expect: 0 },
  { name: 'example 03 api flow', args: ['run', '--quiet'].concat(FAST_LOAD, ['examples/03-api-flow.js']), expect: 0 },
  { name: 'example 04 ci gate (abort preset)', args: ['run', '--quiet'].concat(FAST_LOAD, ['examples/04-ci-gate-abort.js']), expect: 0 },
  { name: 'example 05 diagnostic', args: ['run', '--quiet'].concat(FAST_LOAD, ['examples/05-diagnostic.js']), expect: 0 },
  { name: 'example 06 checks with guards', args: ['run', '--quiet'].concat(FAST_LOAD, ['examples/06-checks-with-guards.js']), expect: 0 },
  { name: 'example 07 custom metrics', args: ['run', '--quiet'].concat(FAST_LOAD, ['examples/07-custom-metrics-tagged.js']), expect: 0 },
  { name: 'example 08 breakpoint (scenario)', args: ['run', '--quiet', 'examples/08-breakpoint.js'], expect: 0 },
  { name: 'example 09 compose & scope', args: ['run', '--quiet'].concat(FAST_LOAD, ['examples/09-compose-and-scope.js']), expect: 0 },
  { name: 'example 10 negative & chaos', args: ['run', '--quiet'].concat(FAST_LOAD, ['examples/10-negative-and-chaos.js']), expect: 0 },
  {
    name: 'boilerplate base-stress-test (strict profile)',
    args: ['run', '--quiet', '-e', 'K6_DURATION=4s', '-e', 'K6_VUS=3', '-e', 'K6_SLO_PROFILE=strict', 'base-stress-test.js'],
    expect: 0,
  },
  { name: 'negative: failing thresholds → 99', args: ['run', '--quiet'].concat(FAST_LOAD, ['test/cases/99-negative-thresholds.js']), expect: 99 },
  { name: 'negative: invalid aggregation → 104', args: ['run', '--quiet', 'test/cases/98-invalid-config.js'], expect: 104 },
  {
    name: 'negative: abortOnFail stops early → 99',
    args: ['run', '--quiet', 'test/cases/97-abort-on-fail.js'],
    expect: 99,
    reportElapsed: true,
  },
];

async function main() {
  const { server } = await startServer(PORT);
  console.log(`\n[e2e] mock server up on http://127.0.0.1:${PORT}\n`);

  const results = [];

  // ۱) اعتبارسنجی کانفیگ بدون اجرا
  for (const target of INSPECT_TARGETS) {
    const result = await runK6(['inspect', target]);
    results.push({
      name: `inspect :: ${target}`,
      expect: 0,
      got: result.exitCode,
      ok: result.exitCode === 0,
      elapsedMs: result.elapsedMs,
    });
    if (result.exitCode !== 0) {
      console.log(`--- inspect output (${target}) ---\n${result.stderr}`);
    }
  }

  // ۲) اجرای واقعی کیس‌ها
  for (const testCase of CASES) {
    const result = await runK6(testCase.args);
    const ok = result.exitCode === testCase.expect;
    results.push({
      name: testCase.name,
      expect: testCase.expect,
      got: result.exitCode,
      ok,
      elapsedMs: result.elapsedMs,
    });
    if (!ok) {
      console.log(`--- k6 output (${testCase.name}) ---\n${result.stderr}${result.stdout}`);
    }
    if (testCase.reportElapsed) {
      const seconds = (result.elapsedMs / 1000).toFixed(1);
      const early = result.elapsedMs < 7000;
      console.log(`[e2e] abortOnFail elapsed = ${seconds}s (duration=8s) → ${early ? 'stopped early ✓' : 'WARN: did not stop early'}`);
    }
  }

  // ۳) گزارش
  console.log('\n================ E2E SUMMARY ================');
  results.forEach((entry) => {
    const status = entry.ok ? 'PASS' : 'FAIL';
    console.log(`${status}  ${entry.name} — expect=${entry.expect} got=${entry.got} (${(entry.elapsedMs / 1000).toFixed(1)}s)`);
  });

  const failed = results.filter((entry) => !entry.ok);
  console.log('='.repeat(45));
  console.log(`total=${results.length} passed=${results.length - failed.length} failed=${failed.length}\n`);

  server.close();
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(`[e2e] fatal: ${error && error.message}`);
  process.exit(1);
});
