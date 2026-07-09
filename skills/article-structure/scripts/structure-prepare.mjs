#!/usr/bin/env node
// article-structure: read act-*.md segments and return the headings output contract.
//
// Usage:
//   node <SKILL_DIR>/scripts/structure-prepare.mjs --target . --slug my-article --json

import {
    buildContext,
    createPrepareResponse,
    formatPrepareHuman,
    outputResult,
    parseArgs,
    printUsage,
} from './structure-lib.mjs';

try {
    const opts = parseArgs();
    if (opts.help) {
        printUsage('structure-prepare.mjs');
        process.exit(0);
    }
    const ctx = buildContext(opts);
    const result = createPrepareResponse(ctx);
    outputResult(result, opts, formatPrepareHuman);
} catch (error) {
    console.error(error.message);
    process.exit(1);
}
