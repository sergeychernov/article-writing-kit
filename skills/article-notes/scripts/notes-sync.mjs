#!/usr/bin/env node
// article-notes: sync notes state into <slug>/article-notes.md.
//
// Usage:
//   node <SKILL_DIR>/scripts/notes-sync.mjs --target . --slug my-article --json
//   node <SKILL_DIR>/scripts/notes-sync.mjs --target . --slug my-article --force --json

import {
    buildContext,
    formatSyncHuman,
    outputResult,
    parseArgs,
    printUsage,
    syncNotes,
} from './notes-lib.mjs';

try {
    const opts = parseArgs();
    if (opts.help) {
        printUsage('notes-sync.mjs');
        process.exit(0);
    }
    const ctx = buildContext(opts);
    const result = syncNotes(ctx, opts);
    outputResult(result, opts, formatSyncHuman);
} catch (error) {
    console.error(error.message);
    process.exit(1);
}
