#!/usr/bin/env node
// Reports saved article brief answers and the next missing field.

import {
    finish,
    parseArgs,
    printBriefReport,
    printBriefUsage,
    statusBrief,
} from './scaffold-lib.mjs';

try {
    const opts = parseArgs(process.argv.slice(2));
    if (opts.help) {
        printBriefUsage('brief-status.mjs', 'Read-only: reports saved brief answers and the next missing field.');
        process.exit(0);
    }

    finish(statusBrief(opts), opts, printBriefReport);
} catch (error) {
    console.error(error.message || error);
    process.exit(1);
}
