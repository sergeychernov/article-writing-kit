#!/usr/bin/env node
// article-habr: inspect article state and selected Habr hubs/tags.
//
// Usage:
//   node <SKILL_DIR>/scripts/habr-status.mjs --target . --slug my-article --json

import {
    buildContext,
    createStatusResponse,
    formatStatusHuman,
    outputResult,
    parseArgs,
    printUsage,
} from './habr-lib.mjs';

try {
    const opts = parseArgs();
    if (opts.help) {
        printUsage('habr-status.mjs');
        process.exit(0);
    }
    const ctx = buildContext(opts);
    const result = createStatusResponse(ctx);
    outputResult(result, opts, formatStatusHuman);
} catch (error) {
    console.error(error.message);
    process.exit(1);
}
