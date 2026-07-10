#!/usr/bin/env node
// article-habr-poll: insert the poll markdown placeholder into lead.md or act-*.md.
//
// Usage:
//   node <SKILL_DIR>/scripts/poll-apply.mjs --target . --slug my-article --json
//   node <SKILL_DIR>/scripts/poll-apply.mjs --target . --slug my-article --force --json
//   node <SKILL_DIR>/scripts/poll-apply.mjs --target . --slug my-article --dry-run --json

import {
    applyPoll,
    buildContext,
    formatApplyHuman,
    outputResult,
    parseArgs,
    printUsage,
} from './poll-lib.mjs';

try {
    const opts = parseArgs();
    if (opts.help) {
        printUsage('poll-apply.mjs');
        process.exit(0);
    }
    const ctx = buildContext(opts);
    const result = applyPoll(ctx, opts);
    outputResult(result, opts, formatApplyHuman);
} catch (error) {
    console.error(error.message);
    process.exit(1);
}
