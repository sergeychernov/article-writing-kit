#!/usr/bin/env node
// article-habr-poll: resume the interactive Habr poll dialogue.
//
// Usage:
//   node <SKILL_DIR>/scripts/poll-resume.mjs --target . --slug my-article --json
//   node <SKILL_DIR>/scripts/poll-resume.mjs --target . --new --json

import {
    buildContext,
    createResumeResponse,
    formatResumeHuman,
    outputResult,
    parseArgs,
    printUsage,
} from './poll-lib.mjs';

try {
    const opts = parseArgs();
    if (opts.help) {
        printUsage('poll-resume.mjs');
        process.exit(0);
    }
    const ctx = buildContext(opts);
    const result = createResumeResponse(ctx);
    outputResult(result, opts, formatResumeHuman);
} catch (error) {
    console.error(error.message);
    process.exit(1);
}
