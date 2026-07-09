#!/usr/bin/env node
// article-ai-signs: scan article files for signs of AI writing.
//
// Detects deterministic markers from Wikipedia:Signs of AI writing and prints a
// JSON report listing found markers. Markers are indicators, NOT proof of AI
// authorship. Semantic and network-dependent signs are listed as manualChecks.
//
// No external dependencies. Works on Node 18+.
//
// Usage (from anywhere inside the article workspace):
//   node <SKILL_DIR>/scripts/detect-ai-signs.mjs --target . --slug my-article --json
//   node <SKILL_DIR>/scripts/detect-ai-signs.mjs --path draft.md --json
//   node <SKILL_DIR>/scripts/detect-ai-signs.mjs --slug my-article --out .article-kit/ai-signs/my-article.json --json

import process from 'node:process';

import {
    parseArgs,
    printUsage,
    loadAssets,
    buildContext,
    detect,
    needsInputResponse,
    noFilesResponse,
    writeReport,
    outputResult,
} from './detect-lib.mjs';

main();

function main() {
    let opts;
    try {
        opts = parseArgs(process.argv.slice(2));
    } catch (error) {
        console.error(error.message);
        console.error('');
        printUsage();
        process.exit(1);
    }

    if (opts.help) {
        printUsage();
        process.exit(0);
    }

    const ctx = buildContext(opts);

    if (ctx.mode === 'slug' && !ctx.slug) {
        outputResult(needsInputResponse(ctx), opts);
        process.exit(0);
    }

    if (ctx.files.length === 0) {
        outputResult(noFilesResponse(ctx), opts);
        process.exit(0);
    }

    const assets = loadAssets();
    const report = detect(ctx, assets);

    const outAction = writeReport(report, opts, ctx);
    if (outAction) {
        report.action = report.action || 'scanned';
        report.out = outAction.path;
    }

    outputResult(report, opts);
}
