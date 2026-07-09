#!/usr/bin/env node
// article-notes: save one step of the notes dialogue.
//
// Usage:
//   node <SKILL_DIR>/scripts/notes-answer.mjs --target . --slug my-article \
//     --action add --kind idea --text "..." --json
//   node <SKILL_DIR>/scripts/notes-answer.mjs --target . --slug my-article \
//     --action complete --json

import {
    buildContext,
    formatAnswerHuman,
    outputResult,
    parseArgs,
    printUsage,
    saveAnswer,
} from './notes-lib.mjs';

try {
    const opts = parseArgs();
    if (opts.help) {
        printUsage('notes-answer.mjs');
        process.exit(0);
    }
    const ctx = buildContext(opts);
    const result = saveAnswer(ctx, opts);
    outputResult(result, opts, formatAnswerHuman);
} catch (error) {
    console.error(error.message);
    process.exit(1);
}
