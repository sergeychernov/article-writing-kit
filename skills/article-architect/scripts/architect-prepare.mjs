#!/usr/bin/env node
// article-architect: prepare article brief and output contract for architecture.
//
// Usage:
//   node <SKILL_DIR>/scripts/architect-prepare.mjs --target . --slug my-article --json

import {
    buildContext,
    createPrepareResponse,
    formatPrepareHuman,
    outputResult,
    parseArgs,
    printUsage,
} from './architect-lib.mjs';

try {
    const opts = parseArgs();
    if (opts.help) {
        printUsage('architect-prepare.mjs');
        process.exit(0);
    }
    const ctx = buildContext(opts);
    const result = createPrepareResponse(ctx);
    outputResult(result, opts, formatPrepareHuman);
} catch (error) {
    console.error(error.message);
    process.exit(1);
}

