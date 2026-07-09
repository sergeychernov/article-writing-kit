#!/usr/bin/env node
// article-structure: resume interactive labelling and return the next question.
//
// Usage:
//   node <SKILL_DIR>/scripts/structure-resume.mjs --target . --slug my-article --json
//   node <SKILL_DIR>/scripts/structure-resume.mjs --target . --slug my-article --new --json

import {
    buildContext,
    createResumeResponse,
    formatResumeHuman,
    outputResult,
    parseArgs,
    printUsage,
} from './structure-lib.mjs';
import { existsSync, rmSync } from 'node:fs';

try {
    const opts = parseArgs();
    if (opts.help) {
        printUsage('structure-resume.mjs');
        process.exit(0);
    }
    const ctx = buildContext(opts);
    if (opts.new && ctx.statePath && existsSync(ctx.statePath)) {
        rmSync(ctx.statePath, { force: true });
        ctx.existingState = null;
    }
    const result = createResumeResponse(ctx);
    outputResult(result, opts, formatResumeHuman);
} catch (error) {
    console.error(error.message);
    process.exit(1);
}
