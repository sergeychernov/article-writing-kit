#!/usr/bin/env node
// article-structure: insert chosen headings into act-*.md and sync three-act-outline.md.
//
// Usage:
//   node <SKILL_DIR>/scripts/structure-apply.mjs --target . --slug my-article --json
//   node <SKILL_DIR>/scripts/structure-apply.mjs --target . --slug my-article --force --json
//   node <SKILL_DIR>/scripts/structure-apply.mjs --target . --slug my-article --dry-run --json

import {
    applyStructure,
    buildContext,
    formatApplyHuman,
    outputResult,
    parseArgs,
    printUsage,
} from './structure-lib.mjs';

try {
    const opts = parseArgs();
    if (opts.help) {
        printUsage('structure-apply.mjs');
        process.exit(0);
    }
    const ctx = buildContext(opts);
    const result = applyStructure(ctx, opts);
    outputResult(result, opts, formatApplyHuman);
} catch (error) {
    console.error(error.message);
    process.exit(1);
}
