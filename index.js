/**
 * index.js — نقطهٔ ورود کل ماژول (thresholds + checks + tags)
 * ----------------------------------------------------------------------------
 * نمونهٔ استفاده:
 *   import { defaultThresholds, runChecks, healthChecks, CHECK_TYPE } from './index.js';
 *
 * مستندات محلی : ./docs/README.md
 * Wiki         : https://gitlab.partdp.ir/judicial-services/idadgar/backlog/-/wikis/k6-test-conditions-standard  (TODO)
 */

export * from './thresholds/index.js';
export * from './checks/index.js';
