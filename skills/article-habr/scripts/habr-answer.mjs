#!/usr/bin/env node
// article-habr: save a hubs or tags selection into habr state.
//
// Usage:
//   node <SKILL_DIR>/scripts/habr-answer.mjs --target . --slug my-article --field hubs --value "Linux, Python, *nix" --json
//   node <SKILL_DIR>/scripts/habr-answer.mjs --target . --slug my-article --field tags --value "python, linux, vpn" --json

import {
    buildContext,
    formatAnswerHuman,
    outputResult,
    parseArgs,
    printUsage,
    saveAnswer,
} from './habr-lib.mjs';

try {
    const opts = parseArgs();
    if (opts.help) {
        printUsage('habr-answer.mjs');
        process.exit(0);
    }
    const ctx = buildContext(opts);
    const result = saveAnswer(ctx, opts);
    outputResult(result, opts, formatAnswerHuman);
} catch (error) {
    console.error(error.message);
    process.exit(1);
}
