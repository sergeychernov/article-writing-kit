#!/usr/bin/env node
// article-init: initializes an Obsidian-friendly article workspace.
//
// No external dependencies. Works on Node 18+.
//
// Usage:
//   node <SKILL_DIR>/scripts/init-workspace.mjs
//   node <SKILL_DIR>/scripts/init-workspace.mjs --target /path/to/repo
//   node <SKILL_DIR>/scripts/init-workspace.mjs --dry-run
//   node <SKILL_DIR>/scripts/init-workspace.mjs --force
//   node <SKILL_DIR>/scripts/init-workspace.mjs --claude
//   node <SKILL_DIR>/scripts/init-workspace.mjs --json

import {
    existsSync,
    mkdirSync,
    readFileSync,
    statSync,
    writeFileSync,
} from 'node:fs';
import { dirname, join, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const here = dirname(fileURLToPath(import.meta.url));
const skillDir = dirname(here);
const assetsDir = join(skillDir, 'assets');

const OBSIDIAN_LINKS = [
    { label: 'Obsidian', url: 'https://obsidian.md/' },
    { label: 'Obsidian Help', url: 'https://help.obsidian.md/' },
];

const NEXT_TOOLS = [
    '`article-scaffold` (skill): create the first article folder and files',
    '`article-brief` (agent): clarify topic, reader, pain, promise, and boundaries',
    '`article-architect` (agent): fill `three-act-outline.md`',
    '`act-writing-coach` (agent): write one act at a time',
    '`publish-prep` (agent): prepare the article for publication',
];

const BASE_FILES = [
    {
        asset: 'AGENTS.md',
        dest: 'AGENTS.md',
        description: 'Codex-compatible project instructions',
    },
    {
        asset: 'article-writing-obsidian.mdc',
        dest: '.cursor/rules/article-writing-obsidian.mdc',
        description: 'Cursor article workspace rules',
    },
];

const CLAUDE_FILE = {
    asset: 'CLAUDE.md',
    dest: '.claude/CLAUDE.md',
    description: 'Claude Code article instructions',
};

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

    const files = [...BASE_FILES, ...(opts.claude ? [CLAUDE_FILE] : [])];
    const report = initializeWorkspace(opts, files);

    if (opts.json) {
        console.log(JSON.stringify(report, null, 2));
        process.exit(0);
    }

    printHumanReport(report);
}

function parseArgs(args) {
    const opts = {
        target: process.cwd(),
        dryRun: false,
        force: false,
        json: false,
        claude: false,
        help: false,
    };

    let positionalTarget = false;

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];

        if (arg === '--help' || arg === '-h') {
            opts.help = true;
        } else if (arg === '--dry-run') {
            opts.dryRun = true;
        } else if (arg === '--force') {
            opts.force = true;
        } else if (arg === '--json') {
            opts.json = true;
        } else if (arg === '--claude') {
            opts.claude = true;
        } else if (arg === '--target') {
            const value = args[++i];
            if (!value) throw new Error('--target requires a path');
            opts.target = value;
            positionalTarget = true;
        } else if (arg.startsWith('--target=')) {
            opts.target = arg.slice('--target='.length);
            if (!opts.target) throw new Error('--target requires a path');
            positionalTarget = true;
        } else if (arg.startsWith('--')) {
            throw new Error(`Unknown flag: ${arg}`);
        } else if (!positionalTarget) {
            opts.target = arg;
            positionalTarget = true;
        } else {
            throw new Error(`Unexpected positional argument: ${arg}`);
        }
    }

    opts.target = resolve(opts.target);
    return opts;
}

function initializeWorkspace(opts, files) {
    const report = {
        skill: 'article-init',
        target: opts.target,
        dryRun: opts.dryRun,
        force: opts.force,
        claude: opts.claude,
        targetStatus: targetStatus(opts.target, opts.dryRun),
        files: [],
        links: OBSIDIAN_LINKS,
        nextTools: NEXT_TOOLS,
    };

    if (!opts.dryRun) {
        ensureDirectory(opts.target);
    }

    for (const file of files) {
        report.files.push(applyTemplate(opts.target, file, opts));
    }

    return report;
}

function targetStatus(target, dryRun) {
    if (!existsSync(target)) return dryRun ? 'would-create' : 'created';
    if (!statSync(target).isDirectory()) {
        throw new Error(`Target exists but is not a directory: ${target}`);
    }
    return 'existing';
}

function ensureDirectory(path) {
    if (existsSync(path)) {
        if (!statSync(path).isDirectory()) {
            throw new Error(`Path exists but is not a directory: ${path}`);
        }
        return;
    }
    mkdirSync(path, { recursive: true });
}

function applyTemplate(targetRoot, file, opts) {
    const content = readAsset(file.asset);
    const destPath = join(targetRoot, file.dest);
    const parentDir = dirname(destPath);
    const relDest = relative(targetRoot, destPath);

    if (!existsSync(destPath)) {
        if (!opts.dryRun) {
            mkdirSync(parentDir, { recursive: true });
            writeFileSync(destPath, content);
        }
        return {
            path: relDest,
            description: file.description,
            action: opts.dryRun ? 'would-create' : 'created',
        };
    }

    const current = readFileSync(destPath, 'utf8');
    if (current === content) {
        return {
            path: relDest,
            description: file.description,
            action: 'unchanged',
        };
    }

    if (opts.force) {
        if (!opts.dryRun) {
            writeFileSync(destPath, content);
        }
        return {
            path: relDest,
            description: file.description,
            action: opts.dryRun ? 'would-overwrite' : 'overwritten',
        };
    }

    const suggestion = nextSuggestionPath(destPath, content);
    const relSuggestion = relative(targetRoot, suggestion.path);

    if (!suggestion.exists && !opts.dryRun) {
        mkdirSync(dirname(suggestion.path), { recursive: true });
        writeFileSync(suggestion.path, content);
    }

    return {
        path: relDest,
        suggestionPath: relSuggestion,
        description: file.description,
        action: suggestion.exists
            ? 'suggestion-unchanged'
            : opts.dryRun
              ? 'would-create-suggestion'
              : 'suggestion-created',
    };
}

function readAsset(name) {
    const path = join(assetsDir, name);
    if (!existsSync(path)) {
        throw new Error(`Missing article-init asset: ${path}`);
    }
    return readFileSync(path, 'utf8');
}

function nextSuggestionPath(destPath, content) {
    const first = `${destPath}.new`;
    const candidates = [first];
    for (let i = 2; i < 100; i++) candidates.push(`${first}.${i}`);

    for (const candidate of candidates) {
        if (!existsSync(candidate)) return { path: candidate, exists: false };
        if (readFileSync(candidate, 'utf8') === content) {
            return { path: candidate, exists: true };
        }
    }

    throw new Error(`Could not find a free suggestion path for ${destPath}`);
}

function printUsage() {
    console.log(`Usage:
  node <SKILL_DIR>/scripts/init-workspace.mjs [--target <path>] [--dry-run] [--force] [--claude] [--json]

Flags:
  --target <path>  Initialize this directory instead of the current working directory
  --dry-run        Show intended changes without writing files
  --force          Overwrite conflicting files instead of writing *.new suggestions
  --claude         Also create .claude/CLAUDE.md
  --json           Print machine-readable JSON
  --help           Show this help
`);
}

function printHumanReport(report) {
    console.log('Article workspace init');
    console.log(`Target: ${report.target}`);
    console.log(`Target status: ${report.targetStatus}${report.dryRun ? ' (dry run)' : ''}`);
    console.log('');
    console.log('Files:');

    for (const file of report.files) {
        const suffix = file.suggestionPath ? ` -> ${file.suggestionPath}` : '';
        console.log(`- ${file.action}: ${file.path}${suffix}`);
    }

    console.log('');
    console.log('Obsidian:');
    for (const link of report.links) {
        console.log(`- ${link.label}: ${link.url}`);
    }
    console.log('- An Obsidian vault is a local folder of Markdown files. Open this repository as a vault if you want Obsidian reading/editing behavior.');

    console.log('');
    console.log('Next tools:');
    for (const step of report.nextTools) {
        console.log(`- ${step}`);
    }
}
