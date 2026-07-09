#!/usr/bin/env node
// article-habr: resume the interactive Habr hubs/tags selection.
//
// Usage:
//   node <SKILL_DIR>/scripts/habr-resume.mjs --target . --slug my-article --json
//   node <SKILL_DIR>/scripts/habr-resume.mjs --target . --new --json

import {
    buildContext,
    createResumeResponse,
    formatResumeHuman,
    outputResult,
    parseArgs,
    printUsage,
} from './habr-lib.mjs';

try {
    const opts = parseArgs();
    if (opts.help) {
        printUsage('habr-resume.mjs');
        process.exit(0);
    }
    const ctx = buildContext(opts);
    const result = createResumeResponse(ctx);
    outputResult(result, opts, formatResumeHuman);
} catch (error) {
    console.error(error.message);
    process.exit(1);
}
