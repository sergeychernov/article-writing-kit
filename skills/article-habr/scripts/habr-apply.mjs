#!/usr/bin/env node
// article-habr: apply selected hubs and tags into index.md frontmatter.
//
// Usage:
//   node <SKILL_DIR>/scripts/habr-apply.mjs --target . --slug my-article --json
//   node <SKILL_DIR>/scripts/habr-apply.mjs --target . --slug my-article --force --json
//   node <SKILL_DIR>/scripts/habr-apply.mjs --target . --slug my-article --dry-run --json

import {
    applyHabr,
    buildContext,
    formatApplyHuman,
    outputResult,
    parseArgs,
    printUsage,
} from './habr-lib.mjs';

try {
    const opts = parseArgs();
    if (opts.help) {
        printUsage('habr-apply.mjs');
        process.exit(0);
    }
    const ctx = buildContext(opts);
    const result = applyHabr(ctx, opts);
    outputResult(result, opts, formatApplyHuman);
} catch (error) {
    console.error(error.message);
    process.exit(1);
}
