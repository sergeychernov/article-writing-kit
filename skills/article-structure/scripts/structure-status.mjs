#!/usr/bin/env node
// article-structure: inspect drafted act-*.md files and structure state.
//
// Usage:
//   node <SKILL_DIR>/scripts/structure-status.mjs --target . --slug my-article --json

import {
    buildContext,
    createStatusResponse,
    formatStatusHuman,
    outputResult,
    parseArgs,
    printUsage,
} from './structure-lib.mjs';

try {
    const opts = parseArgs();
    if (opts.help) {
        printUsage('structure-status.mjs');
        process.exit(0);
    }
    const ctx = buildContext(opts);
    const result = createStatusResponse(ctx);
    outputResult(result, opts, formatStatusHuman);
} catch (error) {
    console.error(error.message);
    process.exit(1);
}
