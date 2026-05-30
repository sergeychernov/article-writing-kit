#!/usr/bin/env node
// Resumes an interrupted scaffold wizard and returns only the next needed step.

import {
    finish,
    parseArgs,
    printUsage,
    printWizardReport,
    resumeWizard,
} from './scaffold-lib.mjs';

try {
    const opts = parseArgs(process.argv.slice(2));
    if (opts.help) {
        printUsage('scaffold-resume.mjs', 'Read-only: auto-resumes a single unfinished scaffold state when no slug is provided.');
        process.exit(0);
    }

    finish(resumeWizard(opts), opts, printWizardReport);
} catch (error) {
    console.error(error.message || error);
    process.exit(1);
}
