#!/usr/bin/env node
// article-architect: validate and apply article architecture to state and outline.
//
// Usage:
//   node <SKILL_DIR>/scripts/architect-apply.mjs --target . --slug my-article --input .article-kit/architect/my-article.draft.json --json
//   node <SKILL_DIR>/scripts/architect-apply.mjs --target . --slug my-article --input - --dry-run --json

import {
    applyArchitecture,
    buildContext,
    formatApplyHuman,
    outputResult,
    parseArgs,
    printUsage,
} from './architect-lib.mjs';

try {
    const opts = parseArgs();
    if (opts.help) {
        printUsage('architect-apply.mjs');
        process.exit(0);
    }
    const ctx = buildContext(opts);
    const result = applyArchitecture(ctx, opts);
    outputResult(result, opts, formatApplyHuman);
} catch (error) {
    console.error(error.message);
    process.exit(1);
}

