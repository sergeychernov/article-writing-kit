#!/usr/bin/env node
// Creates or completes the article folder from scaffold templates.

import {
    applyScaffold,
    finish,
    parseArgs,
    printApplyReport,
    printUsage,
    printWizardReport,
} from './scaffold-lib.mjs';

try {
    const opts = parseArgs(process.argv.slice(2));
    if (opts.help) {
        printUsage('scaffold-apply.mjs', 'Creates missing article files and writes *.new suggestions for conflicts.');
        process.exit(0);
    }

    const report = applyScaffold(opts);
    const printer = report.action === 'needs_input' ? printWizardReport : printApplyReport;
    finish(report, opts, printer);
} catch (error) {
    console.error(error.message || error);
    process.exit(1);
}
