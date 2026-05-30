import {
    existsSync,
    mkdirSync,
    readFileSync,
    readdirSync,
    statSync,
    writeFileSync,
} from 'node:fs';
import {
    dirname,
    join,
    relative,
    resolve,
    sep,
} from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

export const here = dirname(fileURLToPath(import.meta.url));
export const skillDir = dirname(here);
export const assetsDir = join(skillDir, 'assets');

export const DEFAULT_LANGUAGE = 'ru';
export const SUPPORTED_LANGUAGES = new Set(['ru', 'en']);

export const ARTICLE_FILES = [
    { key: 'index', dest: 'index.md', template: 'index.md', description: 'Publishable entry point' },
    { key: 'lead', dest: 'lead.md', template: 'lead.md', description: 'Opening hook' },
    { key: 'act1', dest: 'act-1-setup.md', template: 'act-1.md', description: 'Act 1 prose' },
    { key: 'act2', dest: 'act-2-investigation.md', template: 'act-2.md', description: 'Act 2 prose' },
    { key: 'act3', dest: 'act-3-resolution.md', template: 'act-3.md', description: 'Act 3 prose' },
    {
        key: 'outline',
        dest: 'three-act-outline.md',
        template: 'three-act-outline.md',
        description: 'Working outline',
    },
];

const STATE_VERSION = 1;

const CYRILLIC = {
    а: 'a',
    б: 'b',
    в: 'v',
    г: 'g',
    д: 'd',
    е: 'e',
    ё: 'e',
    ж: 'zh',
    з: 'z',
    и: 'i',
    й: 'y',
    к: 'k',
    л: 'l',
    м: 'm',
    н: 'n',
    о: 'o',
    п: 'p',
    р: 'r',
    с: 's',
    т: 't',
    у: 'u',
    ф: 'f',
    х: 'h',
    ц: 'ts',
    ч: 'ch',
    ш: 'sh',
    щ: 'sch',
    ы: 'y',
    э: 'e',
    ю: 'yu',
    я: 'ya',
    ь: '',
    ъ: '',
};

export function parseArgs(args) {
    const opts = {
        target: process.cwd(),
        slug: null,
        title: null,
        language: null,
        dryRun: false,
        force: false,
        json: false,
        newArticle: false,
        help: false,
    };

    let positionalSlug = false;

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
        } else if (arg === '--new') {
            opts.newArticle = true;
        } else if (arg === '--target') {
            opts.target = requireValue(args, ++i, '--target');
        } else if (arg.startsWith('--target=')) {
            opts.target = valueFromEquals(arg, '--target');
        } else if (arg === '--slug') {
            opts.slug = requireValue(args, ++i, '--slug');
            positionalSlug = true;
        } else if (arg.startsWith('--slug=')) {
            opts.slug = valueFromEquals(arg, '--slug');
            positionalSlug = true;
        } else if (arg === '--title') {
            opts.title = requireValue(args, ++i, '--title');
        } else if (arg.startsWith('--title=')) {
            opts.title = valueFromEquals(arg, '--title');
        } else if (arg === '--language') {
            opts.language = requireValue(args, ++i, '--language');
        } else if (arg.startsWith('--language=')) {
            opts.language = valueFromEquals(arg, '--language');
        } else if (arg.startsWith('--')) {
            throw new Error(`Unknown flag: ${arg}`);
        } else if (!positionalSlug) {
            opts.slug = arg;
            positionalSlug = true;
        } else {
            throw new Error(`Unexpected positional argument: ${arg}`);
        }
    }

    opts.target = resolve(opts.target);
    if (opts.title !== null) opts.title = cleanTitle(opts.title);
    if (opts.language !== null) opts.language = cleanLanguage(opts.language);
    if (opts.slug !== null) opts.slug = normalizeSlug(opts.slug);

    return opts;
}

function requireValue(args, index, flag) {
    const value = args[index];
    if (!value) throw new Error(`${flag} requires a value`);
    return value;
}

function valueFromEquals(arg, flag) {
    const value = arg.slice(`${flag}=`.length);
    if (!value) throw new Error(`${flag} requires a value`);
    return value;
}

export function normalizeSlug(input) {
    const transliterated = String(input)
        .trim()
        .toLowerCase()
        .split('')
        .map((ch) => CYRILLIC[ch] ?? ch)
        .join('');

    return transliterated
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/-{2,}/g, '-')
        .replace(/^-|-$/g, '');
}

export function cleanTitle(input) {
    const title = String(input).trim();
    return title.length ? title : null;
}

export function cleanLanguage(input) {
    const language = String(input).trim().toLowerCase();
    if (!SUPPORTED_LANGUAGES.has(language)) {
        throw new Error(`Unsupported language: ${language}. Supported: ${[...SUPPORTED_LANGUAGES].join(', ')}`);
    }
    return language;
}

export function buildContext(opts, config = {}) {
    const targetStatus = getTargetStatus(opts.target, opts.dryRun);
    const discoveredStates = listStates(opts.target);
    const resumableStates = discoveredStates.filter(isResumableState);
    const autoState =
        !opts.newArticle && !opts.slug && config.autoResumeSingle && resumableStates.length === 1
            ? resumableStates[0]
            : null;

    const seedSlug = opts.slug ?? autoState?.slug ?? null;
    const state = seedSlug ? readState(opts.target, seedSlug) : autoState;
    const slug = seedSlug ?? state?.slug ?? null;
    const articleDir = slug ? safeArticleDir(opts.target, slug) : null;
    const inferredTitle = articleDir ? inferTitleFromIndex(articleDir) : null;
    const title = opts.title ?? state?.title ?? inferredTitle ?? null;
    const language = opts.language ?? state?.language ?? DEFAULT_LANGUAGE;

    const fileStatus = slug ? inspectArticleFiles(opts.target, slug) : null;
    const allQuestions = buildQuestions({
        slug,
        title,
        titleForSlug: title ?? opts.title,
        choiceStates: opts.newArticle ? [] : resumableStates,
    });
    const questions = allQuestions.slice(0, 1);
    const missing = questions.map((q) => q.id);
    const ready = allQuestions.length === 0;

    return {
        skill: 'article-scaffold',
        target: opts.target,
        targetStatus,
        dryRun: opts.dryRun,
        force: opts.force,
        newArticle: opts.newArticle,
        slug,
        title,
        language,
        articleDir,
        state,
        discoveredStates,
        resumableStates,
        fileStatus,
        missing,
        questions,
        ready,
        complete: ready && fileStatus?.complete === true,
    };
}

export function startWizard(opts) {
    const ctx = buildContext(opts);

    if (ctx.slug && !opts.dryRun) {
        writeState(ctx, 'started');
        const nextCtx = buildContext({
            ...opts,
            slug: ctx.slug,
            title: ctx.title,
            language: ctx.language,
        });
        return withNextStep({
            action: nextCtx.ready ? 'ready_to_apply' : 'needs_input',
            ...publicContext(nextCtx),
        });
    }

    return withNextStep({
        action: ctx.ready ? 'ready_to_apply' : 'needs_input',
        ...publicContext(ctx),
    });
}

export function statusReport(opts) {
    const ctx = buildContext(opts);
    const action = ctx.slug ? (ctx.complete ? 'complete' : 'in_progress') : 'needs_input';
    return withNextStep({
        action,
        ...publicContext(ctx),
    });
}

export function resumeWizard(opts) {
    const ctx = buildContext(opts, { autoResumeSingle: true });
    let action;

    if (!ctx.slug) action = 'needs_input';
    else if (!ctx.ready) action = 'needs_input';
    else if (ctx.complete) action = 'complete';
    else action = 'ready_to_apply';

    return withNextStep({
        action,
        ...publicContext(ctx),
    });
}

export function applyScaffold(opts) {
    const ctx = buildContext(opts);

    if (!ctx.ready) {
        if (ctx.slug && !opts.dryRun) writeState(ctx, 'started');
        return withNextStep({
            action: 'needs_input',
            ...publicContext(ctx),
        });
    }

    const files = applyArticleFiles(ctx, opts);

    if (!opts.dryRun) {
        writeState(ctx, 'applied');
    }

    const nextCtx = buildContext({
        ...opts,
        slug: ctx.slug,
        title: ctx.title,
        language: ctx.language,
    });

    return withNextStep({
        action: ctx.dryRun ? 'would_apply' : 'applied',
        ...publicContext(nextCtx),
        files,
    });
}

function publicContext(ctx) {
    const complete = ctx.ready && ctx.fileStatus?.complete === true;

    return {
        skill: ctx.skill,
        target: ctx.target,
        targetStatus: ctx.targetStatus,
        dryRun: ctx.dryRun,
        force: ctx.force,
        newArticle: ctx.newArticle,
        slug: ctx.slug,
        title: ctx.title,
        suggestedThreadTitle: ctx.title,
        language: ctx.language,
        articleDir: ctx.articleDir,
        state: summarizeState(ctx.state),
        discoveredStates: ctx.discoveredStates.map(summarizeState),
        files: ctx.fileStatus,
        missing: ctx.missing,
        questions: ctx.questions,
        currentQuestion: ctx.questions[0] ?? null,
        ready: ctx.ready,
        complete,
    };
}

function summarizeState(state) {
    if (!state) return null;
    return {
        slug: state.slug,
        title: state.title ?? null,
        language: state.language ?? null,
        status: state.status ?? null,
        updatedAt: state.updatedAt ?? null,
    };
}

function isResumableState(state) {
    return state?.status !== 'applied';
}

function withNextStep(report) {
    if (report.action === 'ready_to_apply' || report.action === 'would_apply') {
        report.next = {
            command: applyCommand(report),
        };
    } else if (report.action === 'needs_input') {
        report.next = {
            questions: report.questions,
        };
    } else if (report.action === 'applied' || report.action === 'complete') {
        report.next = {
            recommendation: 'Use article-architect to fill three-act-outline.md, then act-writing-coach to write one act at a time.',
        };
    }
    return report;
}

function buildQuestions({ slug, title, titleForSlug, choiceStates }) {
    const questions = [];

    if (!slug) {
        const suggestion = titleForSlug ? normalizeSlug(titleForSlug) : null;
        questions.push({
            id: 'slug',
            question: 'What folder slug should be used for the article?',
            suggestion: suggestion || null,
            choices: choiceStates.map((state) => state.slug).filter(Boolean),
        });
    }

    if (!title) {
        questions.push({
            id: 'title',
            question: 'What is the article title?',
        });
    }

    return questions;
}

function getTargetStatus(target, dryRun) {
    if (!existsSync(target)) return dryRun ? 'would-create' : 'missing';
    if (!statSync(target).isDirectory()) {
        throw new Error(`Target exists but is not a directory: ${target}`);
    }
    return 'existing';
}

function safeArticleDir(target, slug) {
    if (!slug) throw new Error('Slug is required');
    const targetRoot = resolve(target);
    const articleDir = resolve(targetRoot, slug);
    const rel = relative(targetRoot, articleDir);

    if (rel === '' || rel.startsWith('..') || rel.includes(`..${sep}`)) {
        throw new Error(`Unsafe article slug: ${slug}`);
    }

    return articleDir;
}

function inspectArticleFiles(target, slug) {
    const articleDir = safeArticleDir(target, slug);
    const articleExists = existsSync(articleDir);
    const articleStatus = articleExists
        ? statSync(articleDir).isDirectory()
            ? 'existing'
            : 'not-directory'
        : 'missing';

    const entries = ARTICLE_FILES.map((file) => {
        const path = join(articleDir, file.dest);
        return {
            key: file.key,
            path: relative(target, path),
            exists: existsSync(path),
            description: file.description,
        };
    });

    const imagesDir = join(articleDir, 'images');
    const images = {
        path: relative(target, imagesDir),
        exists: existsSync(imagesDir),
        isDirectory: existsSync(imagesDir) ? statSync(imagesDir).isDirectory() : false,
    };

    return {
        articlePath: relative(target, articleDir),
        articleStatus,
        entries,
        images,
        missing: [
            ...entries.filter((entry) => !entry.exists).map((entry) => entry.path),
            ...(images.exists && images.isDirectory ? [] : [images.path]),
        ],
        complete:
            articleStatus === 'existing' &&
            entries.every((entry) => entry.exists) &&
            images.exists &&
            images.isDirectory,
    };
}

function applyArticleFiles(ctx, opts) {
    const files = [];

    if (!opts.dryRun) ensureDir(ctx.target);
    if (!opts.dryRun) ensureDir(ctx.articleDir);

    const imagesDir = join(ctx.articleDir, 'images');
    files.push(applyDirectory(ctx.target, imagesDir, opts));

    for (const file of ARTICLE_FILES) {
        const rendered = renderTemplate(file.template, ctx);
        const destPath = join(ctx.articleDir, file.dest);
        files.push(applyTextFile(ctx.target, destPath, rendered, file.description, opts));
    }

    return files;
}

function applyDirectory(target, path, opts) {
    const rel = relative(target, path);

    if (!existsSync(path)) {
        if (!opts.dryRun) mkdirSync(path, { recursive: true });
        return { path: rel, action: opts.dryRun ? 'would-create' : 'created', type: 'directory' };
    }

    if (statSync(path).isDirectory()) {
        return { path: rel, action: 'unchanged', type: 'directory' };
    }

    throw new Error(`Path exists but is not a directory: ${path}`);
}

function applyTextFile(target, path, content, description, opts) {
    const rel = relative(target, path);

    if (!existsSync(path)) {
        if (!opts.dryRun) {
            mkdirSync(dirname(path), { recursive: true });
            writeFileSync(path, content);
        }
        return {
            path: rel,
            description,
            action: opts.dryRun ? 'would-create' : 'created',
            type: 'file',
        };
    }

    const current = readFileSync(path, 'utf8');
    if (current === content) {
        return { path: rel, description, action: 'unchanged', type: 'file' };
    }

    if (opts.force) {
        if (!opts.dryRun) writeFileSync(path, content);
        return {
            path: rel,
            description,
            action: opts.dryRun ? 'would-overwrite' : 'overwritten',
            type: 'file',
        };
    }

    const suggestion = nextSuggestionPath(path, content);
    const relSuggestion = relative(target, suggestion.path);
    if (!suggestion.exists && !opts.dryRun) {
        mkdirSync(dirname(suggestion.path), { recursive: true });
        writeFileSync(suggestion.path, content);
    }

    return {
        path: rel,
        suggestionPath: relSuggestion,
        description,
        action: suggestion.exists
            ? 'suggestion-unchanged'
            : opts.dryRun
              ? 'would-create-suggestion'
              : 'suggestion-created',
        type: 'file',
    };
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

function renderTemplate(templateName, ctx) {
    const path = join(assetsDir, 'templates', ctx.language, templateName);
    if (!existsSync(path)) throw new Error(`Missing template: ${path}`);

    const replacements = {
        TITLE: ctx.title,
        SLUG: ctx.slug,
        LANGUAGE: ctx.language,
        ACT1_FILE: 'act-1-setup.md',
        ACT2_FILE: 'act-2-investigation.md',
        ACT3_FILE: 'act-3-resolution.md',
        ACT1_BASENAME: 'act-1-setup',
        ACT2_BASENAME: 'act-2-investigation',
        ACT3_BASENAME: 'act-3-resolution',
    };

    return readFileSync(path, 'utf8').replace(/\{\{([A-Z0-9_]+)\}\}/g, (_, key) => {
        if (!(key in replacements)) throw new Error(`Unknown template token: ${key}`);
        return replacements[key];
    });
}

function ensureDir(path) {
    if (existsSync(path)) {
        if (!statSync(path).isDirectory()) {
            throw new Error(`Path exists but is not a directory: ${path}`);
        }
        return;
    }
    mkdirSync(path, { recursive: true });
}

function stateDir(target) {
    return join(target, '.article-kit', 'scaffold');
}

function statePath(target, slug) {
    return join(stateDir(target), `${slug}.json`);
}

function readState(target, slug) {
    const path = statePath(target, slug);
    if (!existsSync(path)) return null;

    try {
        const data = JSON.parse(readFileSync(path, 'utf8'));
        return data && data.slug === slug ? data : null;
    } catch {
        return null;
    }
}

function listStates(target) {
    const dir = stateDir(target);
    if (!existsSync(dir) || !statSync(dir).isDirectory()) return [];

    return readdirSync(dir)
        .filter((name) => name.endsWith('.json'))
        .map((name) => {
            try {
                return JSON.parse(readFileSync(join(dir, name), 'utf8'));
            } catch {
                return null;
            }
        })
        .filter(Boolean)
        .sort((a, b) => String(b.updatedAt ?? '').localeCompare(String(a.updatedAt ?? '')));
}

function writeState(ctx, status) {
    const now = new Date().toISOString();
    const previous = ctx.state ?? {};
    const next = {
        version: STATE_VERSION,
        createdAt: previous.createdAt ?? now,
        updatedAt: now,
        status,
        slug: ctx.slug,
        title: ctx.title ?? previous.title ?? null,
        language: ctx.language ?? previous.language ?? DEFAULT_LANGUAGE,
        articleDir: ctx.slug,
        files: ARTICLE_FILES.map((file) => file.dest),
    };

    const dir = stateDir(ctx.target);
    mkdirSync(dir, { recursive: true });
    writeFileSync(statePath(ctx.target, ctx.slug), `${JSON.stringify(next, null, 2)}\n`);
}

function inferTitleFromIndex(articleDir) {
    const path = join(articleDir, 'index.md');
    if (!existsSync(path)) return null;

    const lines = readFileSync(path, 'utf8').split(/\r?\n/);
    let inFrontmatter = false;
    let seenFrontmatterStart = false;

    for (const line of lines) {
        if (line.trim() === '---' && !seenFrontmatterStart) {
            seenFrontmatterStart = true;
            inFrontmatter = true;
            continue;
        }
        if (line.trim() === '---' && inFrontmatter) {
            inFrontmatter = false;
            continue;
        }
        if (inFrontmatter) continue;

        const match = line.match(/^#\s+(.+?)\s*$/);
        if (match) return cleanTitle(match[1]);
    }

    return null;
}

function applyCommand(report) {
    const parts = [
        'node',
        shellQuote(join(skillDir, 'scripts', 'scaffold-apply.mjs')),
        '--target',
        shellQuote(report.target),
        '--slug',
        shellQuote(report.slug),
        '--title',
        shellQuote(report.title),
        '--language',
        shellQuote(report.language),
    ];
    if (report.force) parts.push('--force');
    return parts.join(' ');
}

function shellQuote(value) {
    const s = String(value);
    if (/^[a-zA-Z0-9_./:-]+$/.test(s)) return s;
    return `'${s.replace(/'/g, `'\\''`)}'`;
}

export function printUsage(scriptName, extra = '') {
    console.log(`Usage:
  node <SKILL_DIR>/scripts/${scriptName} [--target <path>] [--slug <slug>] [--title <title>] [--language ru|en] [--dry-run] [--force] [--new] [--json]

Flags:
  --target <path>    Article workspace root; default is current working directory
  --slug <slug>      Article folder name; unsafe characters are normalized
  --title <title>    Article title for index.md and three-act-outline.md
  --language ru|en   Template language; default is ru
  --dry-run          Show intended changes without writing article files
  --force            Overwrite conflicting article files instead of writing *.new suggestions
  --new              Ignore saved scaffold state and ask for a new article slug
  --json             Print machine-readable JSON
  --help             Show this help${extra ? `\n\n${extra}` : ''}
`);
}

export function finish(report, opts, humanPrinter) {
    if (opts.json) {
        console.log(JSON.stringify(report, null, 2));
    } else {
        humanPrinter(report);
    }
}

export function printWizardReport(report) {
    console.log(`Article scaffold: ${report.action}`);
    console.log(`Target: ${report.target}`);
    if (report.slug) console.log(`Slug: ${report.slug}`);
    if (report.title) console.log(`Title: ${report.title}`);
    console.log(`Language: ${report.language}`);

    if (report.files?.entries) {
        console.log('');
        console.log('Structure:');
        console.log(`- article: ${report.files.articlePath} (${report.files.articleStatus})`);
        for (const entry of report.files.entries) {
            console.log(`- ${entry.exists ? 'exists' : 'missing'}: ${entry.path}`);
        }
        console.log(`- ${report.files.images.exists ? 'exists' : 'missing'}: ${report.files.images.path}`);
    }

    if (report.questions?.length) {
        console.log('');
        console.log(report.questions.length === 1 ? 'Question:' : 'Questions:');
        for (const question of report.questions) {
            const suggestion = question.suggestion ? ` Suggested: ${question.suggestion}` : '';
            console.log(`- ${question.id}: ${question.question}${suggestion}`);
        }
    }

    if (report.next?.command) {
        console.log('');
        console.log('Next command:');
        console.log(report.next.command);
    }

    if (report.next?.recommendation) {
        console.log('');
        console.log(`Next: ${report.next.recommendation}`);
    }
}

export function printApplyReport(report) {
    console.log(`Article scaffold: ${report.action}`);
    console.log(`Target: ${report.target}`);
    console.log(`Article: ${report.slug}`);
    console.log(`Title: ${report.title}`);
    console.log('');
    console.log('Files:');
    for (const file of report.files ?? []) {
        const suffix = file.suggestionPath ? ` -> ${file.suggestionPath}` : '';
        console.log(`- ${file.action}: ${file.path}${suffix}`);
    }
    if (report.next?.recommendation) {
        console.log('');
        console.log(`Next: ${report.next.recommendation}`);
    }
}
