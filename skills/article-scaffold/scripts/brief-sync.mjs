#!/usr/bin/env node
// Synchronizes saved JSON brief answers into three-act-outline.md.

import {
    finish,
    parseArgs,
    printBriefReport,
    printBriefUsage,
    syncBriefMarkdown,
} from './scaffold-lib.mjs';

try {
    const opts = parseArgs(process.argv.slice(2));
    if (opts.help) {
        printBriefUsage('brief-sync.mjs', 'Writes the saved brief block into three-act-outline.md.');
        process.exit(0);
    }

    finish(syncBriefMarkdown(opts), opts, printBriefReport);
} catch (error) {
    console.error(error.message || error);
    process.exit(1);
}
