#!/usr/bin/env node
// Starts or updates article scaffold wizard state. Does not create article files.

import {
    finish,
    parseArgs,
    printUsage,
    printWizardReport,
    startWizard,
} from './scaffold-lib.mjs';

try {
    const opts = parseArgs(process.argv.slice(2));
    if (opts.help) {
        printUsage('scaffold-start.mjs', 'Writes .article-kit/scaffold/<slug>.json when a slug is known.');
        process.exit(0);
    }

    finish(startWizard(opts), opts, printWizardReport);
} catch (error) {
    console.error(error.message || error);
    process.exit(1);
}
