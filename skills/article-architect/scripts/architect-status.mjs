#!/usr/bin/env node
// article-architect: inspect article architecture state.
//
// Usage:
//   node <SKILL_DIR>/scripts/architect-status.mjs --target . --slug my-article --json

import {
    buildContext,
    createStatusResponse,
    formatStatusHuman,
    outputResult,
    parseArgs,
    printUsage,
} from './architect-lib.mjs';

try {
    const opts = parseArgs();
    if (opts.help) {
        printUsage('architect-status.mjs');
        process.exit(0);
    }
    const ctx = buildContext(opts);
    const result = createStatusResponse(ctx);
    outputResult(result, opts, formatStatusHuman);
} catch (error) {
    console.error(error.message);
    process.exit(1);
}

