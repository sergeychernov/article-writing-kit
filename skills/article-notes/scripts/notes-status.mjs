#!/usr/bin/env node
// article-notes: inspect article notes state (ideas, theses, cases, questions, climax).
//
// Usage:
//   node <SKILL_DIR>/scripts/notes-status.mjs --target . --slug my-article --json

import {
    buildContext,
    createStatusResponse,
    formatStatusHuman,
    outputResult,
    parseArgs,
    printUsage,
} from './notes-lib.mjs';

try {
    const opts = parseArgs();
    if (opts.help) {
        printUsage('notes-status.mjs');
        process.exit(0);
    }
    const ctx = buildContext(opts);
    const result = createStatusResponse(ctx);
    outputResult(result, opts, formatStatusHuman);
} catch (error) {
    console.error(error.message);
    process.exit(1);
}
