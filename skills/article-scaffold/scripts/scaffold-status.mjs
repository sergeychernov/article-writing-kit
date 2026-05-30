#!/usr/bin/env node
// Reports article scaffold state from wizard metadata and filesystem structure.

import {
    finish,
    parseArgs,
    printUsage,
    printWizardReport,
    statusReport,
} from './scaffold-lib.mjs';

try {
    const opts = parseArgs(process.argv.slice(2));
    if (opts.help) {
        printUsage('scaffold-status.mjs', 'Read-only: reports saved wizard state and article file presence.');
        process.exit(0);
    }

    finish(statusReport(opts), opts, printWizardReport);
} catch (error) {
    console.error(error.message || error);
    process.exit(1);
}
