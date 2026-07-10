#!/usr/bin/env node
// article-habr-poll: inspect optional Habr poll draft state.
//
// Usage:
//   node <SKILL_DIR>/scripts/poll-status.mjs --target . --slug my-article --json

import {
    buildContext,
    createStatusResponse,
    formatStatusHuman,
    outputResult,
    parseArgs,
    printUsage,
} from './poll-lib.mjs';

try {
    const opts = parseArgs();
    if (opts.help) {
        printUsage('poll-status.mjs');
        process.exit(0);
    }
    const ctx = buildContext(opts);
    const result = createStatusResponse(ctx);
    outputResult(result, opts, formatStatusHuman);
} catch (error) {
    console.error(error.message);
    process.exit(1);
}
