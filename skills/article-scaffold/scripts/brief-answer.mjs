#!/usr/bin/env node
// Saves one answer into .article-kit/scaffold/<slug>.json.

import {
    answerBrief,
    finish,
    parseArgs,
    printBriefReport,
    printBriefUsage,
} from './scaffold-lib.mjs';

try {
    const opts = parseArgs(process.argv.slice(2));
    if (opts.help) {
        printBriefUsage('brief-answer.mjs', 'Writes one brief answer. For publicationTargets, use a comma-separated list.');
        process.exit(0);
    }

    finish(answerBrief(opts), opts, printBriefReport);
} catch (error) {
    console.error(error.message || error);
    process.exit(1);
}
