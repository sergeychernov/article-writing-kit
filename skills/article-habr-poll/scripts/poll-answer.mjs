#!/usr/bin/env node
// article-habr-poll: save a poll dialogue answer into state.
//
// Usage:
//   node <SKILL_DIR>/scripts/poll-answer.mjs --target . --slug my-article --field decision --value yes --json
//   node <SKILL_DIR>/scripts/poll-answer.mjs --target . --slug my-article --field question --value "Какой VPN вы используете?" --json
//   node <SKILL_DIR>/scripts/poll-answer.mjs --target . --slug my-article --field options --value "WireGuard, OpenVPN, Другой" --json
//   node <SKILL_DIR>/scripts/poll-answer.mjs --target . --slug my-article --field multiple --value no --json

import {
    buildContext,
    formatAnswerHuman,
    outputResult,
    parseArgs,
    printUsage,
    saveAnswer,
} from './poll-lib.mjs';

try {
    const opts = parseArgs();
    if (opts.help) {
        printUsage('poll-answer.mjs');
        process.exit(0);
    }
    const ctx = buildContext(opts);
    const result = saveAnswer(ctx, opts);
    outputResult(result, opts, formatAnswerHuman);
} catch (error) {
    console.error(error.message);
    process.exit(1);
}
