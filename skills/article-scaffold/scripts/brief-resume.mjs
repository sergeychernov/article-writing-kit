#!/usr/bin/env node
// Resumes the article brief wizard and returns the next single question.

import {
    finish,
    parseArgs,
    printBriefReport,
    printBriefUsage,
    resumeBrief,
} from './scaffold-lib.mjs';

try {
    const opts = parseArgs(process.argv.slice(2));
    if (opts.help) {
        printBriefUsage('brief-resume.mjs', 'Read-only: returns one next brief question for the selected article.');
        process.exit(0);
    }

    finish(resumeBrief(opts), opts, printBriefReport);
} catch (error) {
    console.error(error.message || error);
    process.exit(1);
}
