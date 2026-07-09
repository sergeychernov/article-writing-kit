// article-ai-signs: shared library.
//
// Arg parsing, article discovery, file collection, check orchestration,
// scoring, and JSON report assembly. No external dependencies (Node 18+).

import {
    existsSync,
    mkdirSync,
    readdirSync,
    readFileSync,
    statSync,
    writeFileSync,
} from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { runDictionaryChecks } from './checks/dictionary-checks.mjs';
import { runRegexChecks } from './checks/regex-checks.mjs';
import { runStructureChecks } from './checks/structure-checks.mjs';
import { runCitationChecks } from './checks/citation-checks.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const skillDir = dirname(here);
const assetsDir = join(skillDir, 'assets');

export const SKILL_NAME = 'article-ai-signs';
export const REPORT_VERSION = 1;
export const REPORT_SCHEMA_URL =
    'https://raw.githubusercontent.com/sergeychernov/article-writing-kit/main/skills/article-ai-signs/assets/schemas/ai-signs-report.schema.json';

// Only the article prose is scanned: lead.md and act-*.md. Service files
// (index.md, three-act-outline.md, draft.md, ...) are skipped.
const CONTENT_FILE = /^(lead\.md|act-\d+(?:-[a-z0-9-]+)?\.md)$/i;
const SCANNED_LANGUAGES = ['ru', 'en'];

function isContentFile(name) {
    return !name.endsWith('.new') && CONTENT_FILE.test(name);
}

export function parseArgs(argv = process.argv.slice(2)) {
    const opts = {
        target: '.',
        slug: null,
        threadTitle: null,
        language: null,
        path: null,
        out: null,
        json: false,
        dryRun: false,
        help: false,
    };

    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i];
        if (arg === '--json') {
            opts.json = true;
        } else if (arg === '--dry-run') {
            opts.dryRun = true;
        } else if (arg === '--help' || arg === '-h') {
            opts.help = true;
        } else if (arg === '--target') {
            opts.target = requireValue(argv, (i += 1), arg);
        } else if (arg.startsWith('--target=')) {
            opts.target = arg.slice('--target='.length);
        } else if (arg === '--slug') {
            opts.slug = normalizeSlug(requireValue(argv, (i += 1), arg));
        } else if (arg === '--thread-title' || arg === '--chat-title') {
            opts.threadTitle = requireValue(argv, (i += 1), arg);
        } else if (arg === '--language') {
            opts.language = normalizeLanguage(requireValue(argv, (i += 1), arg));
        } else if (arg === '--path') {
            opts.path = requireValue(argv, (i += 1), arg);
        } else if (arg === '--out') {
            opts.out = requireValue(argv, (i += 1), arg);
        } else if (arg.startsWith('--')) {
            throw new Error(`Unknown flag: ${arg}`);
        } else if (!opts.pathPositional && !opts.path) {
            opts.path = arg;
            opts.pathPositional = true;
        } else {
            throw new Error(`Unexpected argument: ${arg}`);
        }
    }

    return opts;
}

export function printUsage() {
    console.log(`Usage:
  node <SKILL_DIR>/scripts/detect-ai-signs.mjs [--target <path>] [--slug <slug>] [--path <file|dir>] [--language ru|en] [--out <path>] [--json]

Flags:
  --target <path>     Article workspace root; default is the current directory
  --slug <slug>       Article folder name; unsafe characters are normalized
  --thread-title <t>  Current IDE thread/chat title; used to recover an article slug
  --chat-title <t>    Alias for --thread-title
  --path <file|dir>   Scan a specific Markdown file or directory instead of a slug folder
  --language ru|en    Primary article language for reporting; scans ru+en dictionaries regardless
  --out <path>        Also write the JSON report to this path
  --dry-run           Do not write the --out file
  --json              Print the machine-readable JSON report
  --help              Show this help
`);
}

export function loadAssets() {
    return {
        vocabulary: readJson(join(assetsDir, 'markers', 'ai-vocabulary.json')),
        phrases: readJson(join(assetsDir, 'markers', 'phrases.json')),
        signatures: readJson(join(assetsDir, 'markers', 'signatures.json')),
        fixHints: readJson(join(assetsDir, 'markers', 'fix-hints.json')),
        manualChecks: readJson(join(assetsDir, 'markers', 'manual-checks.json')),
        config: readJson(join(assetsDir, 'config.json')),
    };
}

export function buildContext(opts) {
    const target = resolve(process.cwd(), opts.target || '.');
    const scaffoldDir = join(target, '.article-kit', 'scaffold');
    const discoveredStates = discoverScaffoldStates(scaffoldDir);

    if (opts.path) {
        const abs = resolve(process.cwd(), opts.path);
        const files = collectPathFiles(abs);
        return {
            target,
            slug: null,
            slugSource: 'path',
            articleDir: statExists(abs) && statSync(abs).isDirectory() ? abs : dirname(abs),
            articleExists: statExists(abs),
            files,
            language: normalizeLanguage(opts.language || 'ru'),
            discoveredStates,
            mode: 'path',
        };
    }

    const slugInfo = resolveSlug({
        explicitSlug: opts.slug,
        threadTitle: opts.threadTitle,
        target,
        discoveredStates,
    });
    const slug = slugInfo.slug;
    const scaffoldState = slug ? readJson(join(scaffoldDir, `${slug}.json`)) : null;
    const articleDir = slug ? join(target, slug) : null;
    const articleExists = articleDir ? existsSync(articleDir) : false;
    const language = normalizeLanguage(opts.language || scaffoldState?.language || 'ru');
    const files = articleExists ? collectArticleFiles(articleDir) : [];

    return {
        target,
        slug,
        slugSource: slugInfo.source,
        articleDir,
        articleExists,
        files,
        language,
        discoveredStates,
        mode: 'slug',
    };
}

export function detect(ctx, assets) {
    const helpers = makeHelpers(assets.config, ctx.target);
    const fileInputs = ctx.files;

    const markers = [
        ...runRegexChecks(fileInputs, assets, helpers),
        ...runStructureChecks(fileInputs, assets, helpers),
        ...runCitationChecks(fileInputs, assets, helpers),
        ...runDictionaryChecks(fileInputs, assets, helpers, SCANNED_LANGUAGES),
    ].filter(Boolean);

    markers.sort((a, b) => severityRank(b.severity) - severityRank(a.severity) || b.count - a.count);

    attachFixHints(markers, assets.fixHints);

    const summary = summarize(markers, assets.config);
    const manualChecks = (assets.manualChecks?.manualChecks || []).map((m) => ({
        id: m.id,
        category: m.category,
        title: m.title,
        wpShortcut: m.wpShortcut || null,
        why: m.why,
        fixStrategy: 'review',
        hint: m.hint || null,
    }));

    const fixStrategies = assets.fixHints?.strategies || null;

    return {
        skill: SKILL_NAME,
        version: REPORT_VERSION,
        generatedBy: SKILL_NAME,
        generatedAt: new Date().toISOString(),
        reportSchema: REPORT_SCHEMA_URL,
        target: ctx.target,
        slug: ctx.slug,
        slugSource: ctx.slugSource,
        language: ctx.language,
        scannedLanguages: SCANNED_LANGUAGES,
        mode: ctx.mode,
        files: fileInputs.map((f) => ({ path: f.path, lines: f.lines.length, bytes: f.bytes })),
        summary,
        markers,
        manualChecks,
        fixStrategies,
    };
}

export function needsInputResponse(ctx) {
    return {
        skill: SKILL_NAME,
        version: REPORT_VERSION,
        generatedAt: new Date().toISOString(),
        target: ctx.target,
        slug: null,
        slugSource: ctx.slugSource || null,
        language: ctx.language,
        action: 'needs_input',
        currentQuestion: {
            id: 'slug',
            kind: 'text',
            question:
                ctx.language === 'en'
                    ? 'Which article slug should I scan for AI-writing signs? (or pass --path)'
                    : 'Какой slug статьи проверить на признаки AI-письма? (или укажите --path)',
        },
        files: [],
        summary: { totalMarkers: 0, byCategory: {}, bySeverity: { high: 0, medium: 0, low: 0 }, heuristicScore: 0 },
        markers: [],
        manualChecks: [],
        discoveredStates: ctx.discoveredStates.map((s) => ({ slug: s.slug, title: s.title, language: s.language })),
    };
}

export function noFilesResponse(ctx) {
    return {
        skill: SKILL_NAME,
        version: REPORT_VERSION,
        generatedAt: new Date().toISOString(),
        target: ctx.target,
        slug: ctx.slug,
        slugSource: ctx.slugSource,
        language: ctx.language,
        action: 'no_files',
        message:
            ctx.language === 'en'
                ? `No Markdown files found for "${ctx.slug || ctx.articleDir}". Draft the article first, or pass --path.`
                : `Не найдено Markdown-файлов для «${ctx.slug || ctx.articleDir}». Сначала напиши черновик статьи или укажи --path.`,
        files: [],
        summary: { totalMarkers: 0, byCategory: {}, bySeverity: { high: 0, medium: 0, low: 0 }, heuristicScore: 0 },
        markers: [],
        manualChecks: [],
    };
}

export function writeReport(report, opts, ctx) {
    if (!opts.out) return null;
    const outPath = resolve(process.cwd(), opts.out);
    if (opts.dryRun) return { path: relFrom(ctx.target, outPath), status: 'would-write' };
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    return { path: relFrom(ctx.target, outPath), status: 'written' };
}

export function outputResult(report, opts) {
    if (opts.json) {
        console.log(`${JSON.stringify(report, null, 2)}\n`.trimEnd());
        return;
    }
    console.log(formatHuman(report));
}

export function formatHuman(report) {
    const lines = [];
    lines.push(`AI-writing signs: ${report.slug || report.mode || 'scan'}`);
    if (report.action === 'needs_input') {
        lines.push(`Question: ${report.currentQuestion.question}`);
        return lines.join('\n');
    }
    if (report.action === 'no_files') {
        lines.push(report.message);
        return lines.join('\n');
    }
    lines.push(`Files scanned: ${report.files.length}`);
    lines.push(
        `Markers: ${report.summary.totalMarkers} (high ${report.summary.bySeverity.high}, medium ${report.summary.bySeverity.medium}, low ${report.summary.bySeverity.low})`
    );
    lines.push(`Heuristic score: ${report.summary.heuristicScore}/100 (indicator, not proof)`);
    lines.push('');
    if (report.markers.length === 0) {
        lines.push('No deterministic markers found.');
    } else {
        for (const m of report.markers) {
            const wp = m.wpShortcut ? ` [${m.wpShortcut}]` : '';
            lines.push(`- [${m.severity}] ${m.title}${wp} — ${m.count} match(es) [${m.fixStrategy}]`);
            const first = m.matches[0];
            if (first) lines.push(`    e.g. ${first.file}:${first.line}: ${first.snippet}`);
            if (m.fixHint) lines.push(`    hint: ${m.fixHint}`);
        }
    }
    lines.push('');
    lines.push('Manual checks (need semantic/network review):');
    for (const c of report.manualChecks) {
        lines.push(`- ${c.title}${c.wpShortcut ? ` [${c.wpShortcut}]` : ''}`);
    }
    return lines.join('\n');
}

// ---- helpers ---------------------------------------------------------------

const DEFAULT_FIX_HINT =
    'Перечитайте фрагмент в контексте абзаца и решите, нужна ли правка.';

function attachFixHints(markers, fixHintsAsset) {
    const byId = fixHintsAsset?.hints || {};
    for (const marker of markers) {
        const entry = byId[marker.id];
        marker.fixStrategy = entry?.fixStrategy || 'review';
        marker.fixHint = entry?.fixHint || DEFAULT_FIX_HINT;
    }
}

function makeHelpers(config, target) {
    const snippetMax = config?.scan?.snippetMaxLength || 200;
    const maxMatches = config?.scan?.maxMatchesPerMarker || 50;
    return {
        config,
        maxMatches,
        snippet(text) {
            const clean = String(text).replace(/\s+/g, ' ').trim();
            return clean.length > snippetMax ? `${clean.slice(0, snippetMax - 1)}…` : clean;
        },
        relFrom(path) {
            return relFrom(target, path);
        },
    };
}

function summarize(markers, config) {
    const byCategory = {};
    const bySeverity = { high: 0, medium: 0, low: 0 };
    let totalMatches = 0;
    let weighted = 0;
    const scale = config?.scoring?.scale || 20;

    for (const m of markers) {
        byCategory[m.category] = (byCategory[m.category] || 0) + 1;
        if (bySeverity[m.severity] != null) bySeverity[m.severity] += 1;
        totalMatches += m.count;
        const cappedCount = Math.min(m.count, 10);
        weighted += m.weight * cappedCount;
    }

    const heuristicScore = Math.min(100, Math.round(100 * (1 - Math.exp(-weighted / scale))));

    return {
        totalMarkers: markers.length,
        totalMatches,
        byCategory,
        bySeverity,
        heuristicScore,
    };
}

function severityRank(severity) {
    return severity === 'high' ? 3 : severity === 'medium' ? 2 : 1;
}

function collectArticleFiles(articleDir) {
    if (!existsSync(articleDir)) return [];
    return readdirSync(articleDir)
        .filter(isContentFile)
        .sort()
        .map((name) => readFileInput(articleDir, join(articleDir, name)))
        .filter(Boolean);
}

function collectPathFiles(abs) {
    if (!statExists(abs)) return [];
    const st = statSync(abs);
    if (st.isDirectory()) {
        return readdirSync(abs)
            .filter(isContentFile)
            .sort()
            .map((name) => readFileInput(abs, join(abs, name)))
            .filter(Boolean);
    }
    // An explicit single-file path is scanned as-is, even if it is a service file.
    const input = readFileInput(dirname(abs), abs);
    return input ? [input] : [];
}

function readFileInput(baseDir, abs) {
    try {
        const text = readFileSync(abs, 'utf8');
        return {
            path: basename(abs),
            abs,
            baseDir,
            text,
            lines: text.split(/\r?\n/),
            bytes: Buffer.byteLength(text, 'utf8'),
        };
    } catch {
        return null;
    }
}

function discoverScaffoldStates(scaffoldDir) {
    if (!existsSync(scaffoldDir)) return [];
    return readdirSync(scaffoldDir)
        .filter((name) => name.endsWith('.json'))
        .map((name) => {
            const state = readJson(join(scaffoldDir, name));
            return {
                slug: normalizeSlug(state?.slug) || normalizeSlug(name.replace(/\.json$/, '')),
                title: stringOrNull(state?.title),
                language: normalizeLanguage(state?.language || 'ru'),
                status: state?.status || null,
            };
        })
        .filter((item) => item.slug)
        .sort((a, b) => a.slug.localeCompare(b.slug));
}

function resolveSlug({ explicitSlug, threadTitle, target, discoveredStates }) {
    if (explicitSlug) return { slug: explicitSlug, source: 'argument' };
    const threadSlug = normalizeSlug(threadTitle);
    if (threadSlug && (discoveredStates.some((s) => s.slug === threadSlug) || existsSync(join(target, threadSlug)))) {
        return { slug: threadSlug, source: 'thread-title' };
    }
    const cwdSlug = normalizeSlug(basename(process.cwd()));
    if (cwdSlug && (discoveredStates.some((s) => s.slug === cwdSlug) || existsSync(join(target, cwdSlug)))) {
        return { slug: cwdSlug, source: 'cwd' };
    }
    if (discoveredStates.length === 1) return { slug: discoveredStates[0].slug, source: 'single-state' };
    return { slug: null, source: null };
}

function readJson(path) {
    if (!path || !existsSync(path)) return null;
    try {
        return JSON.parse(readFileSync(path, 'utf8'));
    } catch {
        return null;
    }
}

function statExists(path) {
    try {
        statSync(path);
        return true;
    } catch {
        return false;
    }
}

function normalizeSlug(value) {
    if (!value) return null;
    const normalized = String(value)
        .trim()
        .toLowerCase()
        .replace(/['"`]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .replace(/-{2,}/g, '-');
    return normalized || null;
}

function normalizeLanguage(value) {
    return value === 'en' ? 'en' : 'ru';
}

function stringOrNull(value) {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
}

function requireValue(argv, index, flag) {
    const value = argv[index];
    if (!value || value.startsWith('--')) throw new Error(`Missing value for ${flag}`);
    return value;
}

function relFrom(root, path) {
    if (!path) return null;
    const value = relative(root, path);
    return value && !value.startsWith('..') ? value : path;
}
