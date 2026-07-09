#!/usr/bin/env node
// article-structure: register a chunk and/or save a chosen heading.
//
// Usage:
//   node <SKILL_DIR>/scripts/structure-answer.mjs --target . --slug my-article \
//     --act act1 --chunk c1 --start-line 5 --end-line 42 --preview "..." \
//     --level h3 --text "Node.js + VPN" --json
//   node <SKILL_DIR>/scripts/structure-answer.mjs --target . --slug my-article \
//     --act act1 --chunk c2 --level h2 --text "Переносить всё? Не хотелось" --json
//   node <SKILL_DIR>/scripts/structure-answer.mjs --target . --slug my-article \
//     --act act1 --chunk c3 --start-line 80 --end-line 120 --skip-heading --json

import {
    buildContext,
    formatAnswerHuman,
    outputResult,
    parseArgs,
    printUsage,
    saveAnswer,
} from './structure-lib.mjs';

try {
    const opts = parseArgs();
    if (opts.help) {
        printUsage('structure-answer.mjs');
        process.exit(0);
    }
    const ctx = buildContext(opts);
    const result = saveAnswer(ctx, opts);
    outputResult(result, opts, formatAnswerHuman);
} catch (error) {
    console.error(error.message);
    process.exit(1);
}
