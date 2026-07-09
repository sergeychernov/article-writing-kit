#!/usr/bin/env node
// article-notes: find the next interactive step of the notes dialogue.
//
// Usage:
//   node <SKILL_DIR>/scripts/notes-resume.mjs --target . --slug my-article --json
//   node <SKILL_DIR>/scripts/notes-resume.mjs --target . --slug my-article --new --json

import {
    buildContext,
    createResumeResponse,
    formatResumeHuman,
    outputResult,
    parseArgs,
    printUsage,
} from './notes-lib.mjs';

try {
    const opts = parseArgs();
    if (opts.help) {
        printUsage('notes-resume.mjs');
        process.exit(0);
    }
    const ctx = buildContext(opts);
    const result = createResumeResponse(ctx, opts);
    outputResult(result, opts, formatResumeHuman);
} catch (error) {
    console.error(error.message);
    process.exit(1);
}
