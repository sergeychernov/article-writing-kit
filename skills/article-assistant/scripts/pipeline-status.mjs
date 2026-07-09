#!/usr/bin/env node
// article-assistant: determine the current article pipeline stage and recommend a subagent.
//
// Usage:
//   node <SKILL_DIR>/scripts/pipeline-status.mjs --target . --json
//   node <SKILL_DIR>/scripts/pipeline-status.mjs --target . --slug my-article --intent auto --json

import {
    buildContext,
    createPipelineResponse,
    formatHuman,
    outputResult,
    parseArgs,
    printUsage,
} from './pipeline-lib.mjs';

try {
    const opts = parseArgs();
    if (opts.help) {
        printUsage();
        process.exit(0);
    }
    const ctx = buildContext(opts);
    const result = createPipelineResponse(ctx);
    outputResult(result, opts, formatHuman);
} catch (error) {
    console.error(error.message);
    process.exit(1);
}
