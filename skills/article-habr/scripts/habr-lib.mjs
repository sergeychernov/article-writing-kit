import {
    existsSync,
    mkdirSync,
    readdirSync,
    readFileSync,
    writeFileSync,
} from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const SKILL_NAME = 'article-habr';
export const STATE_SCHEMA_VERSION = 1;
export const STATE_VERSION = 1;
export const STATE_SCHEMA_URL =
    'https://raw.githubusercontent.com/sergeychernov/article-writing-kit/main/skills/article-habr/assets/schemas/habr-state.schema.json';
export const HUBS_REGISTRY_URL =
    'https://raw.githubusercontent.com/sergeychernov/article-writing-kit/main/skills/article-habr/assets/habr-hubs.json';

export const DEFAULT_MAX_HUBS = 5;
export const DEFAULT_MAX_TAGS = 10;
const TAG_MAX_LEN = 64;
const LEAD_EXCERPT_LEN = 600;

const HERE = dirname(fileURLToPath(import.meta.url));
const ASSETS_DIR = join(HERE, '..', 'assets');
const HUBS_REGISTRY_PATH = join(ASSETS_DIR, 'habr-hubs.json');

const TEXT = {
    ru: {
        slugQuestion: 'Какой slug статьи подготавливаем для Habr?',
        notReady: 'Сначала заверши article-scaffold и напиши черновики act-*.md файлов.',
        needsApply: 'Хабы и теги выбраны. Запусти habr-apply.mjs, чтобы записать их в index.md.',
        askHubs: 'Предложи до 5 тематических хабов из реестра (prefer multiauthor) и спроси подтверждение. Покажи кандидатов с пометкой, можно ли в них публиковать.',
        askTags: 'Предложи до 10 тегов (lowercase, устоявшиеся на Habr) и спроси подтверждение.',
        allDone: 'Хабы и теги применены в index.md.',
        noHubsSelected: 'Хабы ещё не выбраны.',
        noTagsSelected: 'Теги ещё не выбраны.',
    },
    en: {
        slugQuestion: 'Which article slug are we preparing for Habr?',
        notReady: 'Run article-scaffold and draft the act-*.md files first.',
        needsApply: 'Hubs and tags are chosen. Run habr-apply.mjs to write them into index.md.',
        askHubs: 'Propose up to 5 thematic hubs from the registry (prefer multiauthor) and ask the user to confirm. Mark whether each candidate accepts posts.',
        askTags: 'Propose up to 10 tags (lowercase, established on Habr) and ask the user to confirm.',
        allDone: 'Hubs and tags have been applied to index.md.',
        noHubsSelected: 'No hubs selected yet.',
        noTagsSelected: 'No tags selected yet.',
    },
};

export function parseArgs(argv = process.argv.slice(2)) {
    const opts = {
        target: '.',
        slug: null,
        threadTitle: null,
        language: null,
        field: null,
        value: null,
        new: false,
        json: false,
        dryRun: false,
        force: false,
        help: false,
    };

    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i];
        if (arg === '--json') {
            opts.json = true;
        } else if (arg === '--dry-run') {
            opts.dryRun = true;
        } else if (arg === '--force') {
            opts.force = true;
        } else if (arg === '--new') {
            opts.new = true;
        } else if (arg === '--help' || arg === '-h') {
            opts.help = true;
        } else if (arg === '--target') {
            opts.target = requireValue(argv, (i += 1), arg);
        } else if (arg === '--slug') {
            opts.slug = normalizeSlug(requireValue(argv, (i += 1), arg));
        } else if (arg === '--thread-title' || arg === '--chat-title') {
            opts.threadTitle = requireValue(argv, (i += 1), arg);
        } else if (arg === '--language') {
            opts.language = normalizeLanguage(requireValue(argv, (i += 1), arg));
        } else if (arg === '--field') {
            opts.field = normalizeField(requireValue(argv, (i += 1), arg));
        } else if (arg === '--value') {
            opts.value = requireValue(argv, (i += 1), arg);
        } else if (arg.startsWith('--')) {
            throw new Error(`Unknown flag: ${arg}`);
        } else {
            throw new Error(`Unexpected argument: ${arg}`);
        }
    }

    return opts;
}

export function printUsage(command) {
    const extra = {
        'habr-status.mjs': '',
        'habr-resume.mjs': ' [--new]',
        'habr-answer.mjs': ' --field <hubs|tags> --value <comma-separated>',
        'habr-apply.mjs': ' [--force] [--dry-run]',
    }[command];

    console.log(`Usage:
  node <SKILL_DIR>/scripts/${command} [--target <path>] [--slug <slug>] [--thread-title <title>]${extra} [--json]

Flags:
  --target <path>     Article workspace root; default is current working directory
  --slug <slug>       Article folder name; unsafe characters are normalized
  --thread-title <t>  Current IDE thread/chat title; used to recover an article slug
  --chat-title <t>    Alias for --thread-title
  --language ru|en    Output language when scaffold state cannot provide it
  --new               (resume) ignore saved habr state and start over
  --field <hubs|tags> (answer) which selection to save
  --value <list>      (answer) comma-separated hubs (titles/aliases) or tags
  --force             (apply) overwrite non-empty tags/hubs in index.md instead of writing *.new
  --dry-run           Show intended changes without writing files
  --json              Print machine-readable JSON
  --help              Show this help
`);
}

export function loadHubRegistry() {
    if (!existsSync(HUBS_REGISTRY_PATH)) {
        throw new Error(`Habr hubs registry not found: ${HUBS_REGISTRY_PATH}`);
    }
    return JSON.parse(readFileSync(HUBS_REGISTRY_PATH, 'utf8'));
}

export function buildContext(opts = {}) {
    const target = resolve(process.cwd(), opts.target || '.');
    const articleKitDir = join(target, '.article-kit');
    const scaffoldDir = join(articleKitDir, 'scaffold');
    const structureDir = join(articleKitDir, 'structure');
    const habrDir = join(articleKitDir, 'habr');
    const discoveredStates = discoverScaffoldStates(scaffoldDir);
    const slugInfo = resolveSlug({
        explicitSlug: opts.slug,
        threadTitle: opts.threadTitle,
        target,
        discoveredStates,
        discoveredHabrStates: discoverHabrStates(habrDir),
    });
    const slug = slugInfo.slug;
    const scaffoldStatePath = slug ? join(scaffoldDir, `${slug}.json`) : null;
    const scaffoldState = scaffoldStatePath ? readJson(scaffoldStatePath) : null;
    const articleDir = slug ? join(target, slug) : null;
    const articleExists = articleDir ? existsSync(articleDir) : false;
    const indexPath = articleDir ? join(articleDir, 'index.md') : null;
    const leadPath = articleDir ? join(articleDir, 'lead.md') : null;
    const outlinePath = articleDir ? join(articleDir, 'three-act-outline.md') : null;
    const statePath = slug ? join(habrDir, `${slug}.json`) : null;
    const existingState = (opts.new ? null : readJson(statePath)) || null;
    const registry = loadHubRegistry();
    const title =
        stringOrNull(scaffoldState?.title) ||
        (articleDir ? readTitleFromIndex(indexPath) : null) ||
        slug;
    const language = normalizeLanguage(opts.language || scaffoldState?.language || existingState?.language || 'ru');
    const indexContent = indexPath && existsSync(indexPath) ? readFileSync(indexPath, 'utf8') : null;
    const leadContent = leadPath && existsSync(leadPath) ? readFileSync(leadPath, 'utf8') : null;
    const outlineContent = outlinePath && existsSync(outlinePath) ? readFileSync(outlinePath, 'utf8') : null;
    const brief = scaffoldState?.brief || extractBriefFromOutline(outlineContent) || null;

    return {
        skill: SKILL_NAME,
        stateSchema: STATE_SCHEMA_URL,
        stateSchemaVersion: STATE_SCHEMA_VERSION,
        target,
        scaffoldDir,
        structureDir,
        habrDir,
        discoveredStates,
        slug,
        slugSource: slugInfo.source,
        suggestedThreadTitle: slug,
        title,
        language,
        articleDir,
        articleExists,
        indexPath,
        leadPath,
        outlinePath,
        indexContent,
        leadContent,
        outlineContent,
        scaffoldStatePath,
        scaffoldState,
        scaffoldStatus: scaffoldState?.status || null,
        brief,
        statePath,
        existingState,
        registry,
        maxHubs: registry?.limits?.maxHubs ?? DEFAULT_MAX_HUBS,
        maxTags: registry?.limits?.maxTags ?? DEFAULT_MAX_TAGS,
    };
}

export function createStatusResponse(ctx) {
    const currentQuestion = ctx.slug
        ? null
        : {
              id: 'slug',
              kind: 'text',
              question: labels(ctx.language).slugQuestion,
          };

    const state = ctx.existingState;
    const frontmatter = ctx.indexContent ? parseFrontmatter(ctx.indexContent) : null;
    const fmHubs = frontmatter ? readArrayField(frontmatter, 'hubs') : [];
    const fmTags = frontmatter ? readArrayField(frontmatter, 'tags') : [];

    return publicContext(ctx, {
        phase: 'habr',
        action: ctx.slug ? 'status' : 'needs_input',
        currentQuestion,
        ready: Boolean(ctx.slug && ctx.articleExists),
        complete: isApplied(state),
        hubs: state?.hubs || [],
        tags: state?.tags || [],
        maxHubs: ctx.maxHubs,
        maxTags: ctx.maxTags,
        indexFrontmatter: ctx.indexContent
            ? { present: Boolean(frontmatter), hubs: fmHubs, tags: fmTags }
            : null,
        registry: registrySummary(ctx.registry),
        next: nextStep(ctx, 'status'),
    });
}

export function createResumeResponse(ctx) {
    if (!ctx.slug) return needsSlug(ctx);
    if (!ctx.articleExists) {
        return publicContext(ctx, {
            phase: 'habr',
            action: 'needs_scaffold',
            ready: false,
            complete: false,
            message: labels(ctx.language).notReady,
            next: { recommendation: labels(ctx.language).notReady },
        });
    }

    const state = ctx.existingState || buildInitialState(ctx);
    const cursor = computeCursor(state);
    const l = labels(ctx.language);

    const articleContext = buildArticleContext(ctx);

    if (!cursor) {
        const applied = isApplied(state);
        return publicContext(ctx, {
            phase: 'habr',
            action: applied ? 'all_done' : 'needs_apply',
            ready: true,
            complete: applied,
            hubs: state.hubs,
            tags: state.tags,
            maxHubs: ctx.maxHubs,
            maxTags: ctx.maxTags,
            cursor: null,
            articleContext,
            message: applied ? l.allDone : l.needsApply,
            next: {
                recommendation: applied
                    ? 'Nothing to do — hubs and tags are already applied to index.md.'
                    : 'Run habr-apply.mjs to write the chosen hubs and tags into index.md.',
            },
        });
    }

    if (cursor.phase === 'hubs') {
        return publicContext(ctx, {
            phase: 'habr',
            action: 'needs_hubs',
            ready: true,
            complete: false,
            cursor,
            hubs: state.hubs,
            tags: state.tags,
            maxHubs: ctx.maxHubs,
            maxTags: ctx.maxTags,
            articleContext,
            registry: registrySummary(ctx.registry),
            currentQuestion: {
                id: 'hubs',
                kind: 'multi_choice',
                question: l.askHubs,
            },
            instructions: [
                `Read the full registry at ${HUBS_REGISTRY_PATH} and pick candidates that match the article topic.`,
                `Prefer hubs with multiauthor=true (marked with * on Habr) — only those accept posts from a regular author. You may include up to ${ctx.maxHubs} hubs.`,
                'Save the selection with habr-answer.mjs --field hubs --value "Title 1, Title 2, …" (titles or aliases from the registry).',
            ],
        });
    }

    return publicContext(ctx, {
        phase: 'habr',
        action: 'needs_tags',
        ready: true,
        complete: false,
        cursor,
        hubs: state.hubs,
        tags: state.tags,
        maxHubs: ctx.maxHubs,
        maxTags: ctx.maxTags,
        articleContext,
        currentQuestion: {
            id: 'tags',
            kind: 'multi_choice',
            question: l.askTags,
        },
        instructions: [
            `Propose up to ${ctx.maxTags} lowercase tags that are established on Habr and match the article topic.`,
            'Save the selection with habr-answer.mjs --field tags --value "tag1, tag2, …".',
        ],
    });
}

export function saveAnswer(ctx, opts) {
    if (!ctx.slug) return needsSlug(ctx);
    if (!ctx.articleExists) {
        return publicContext(ctx, {
            phase: 'habr',
            action: 'needs_scaffold',
            ready: false,
            complete: false,
            message: labels(ctx.language).notReady,
        });
    }
    if (!opts.field) throw new Error('--field is required for habr-answer.mjs (hubs | tags)');
    if (opts.value == null) throw new Error('--value is required for habr-answer.mjs');

    const state = ctx.existingState || buildInitialState(ctx);
    ensureStateShape(ctx, state);

    if (opts.field === 'hubs') {
        const inputs = splitList(opts.value);
        const resolved = [];
        const errors = [];
        for (const raw of inputs) {
            const match = matchHub(raw, ctx.registry);
            if (!match) {
                errors.push(raw);
                continue;
            }
            if (!resolved.some((h) => h.alias === match.alias)) resolved.push(match);
        }
        if (errors.length > 0) {
            throw new Error(
                `Unknown hub(s): ${errors.join(', ')}. Use a title or alias from assets/habr-hubs.json.`
            );
        }
        if (resolved.length > ctx.maxHubs) {
            throw new Error(`Too many hubs: ${resolved.length}. Maximum is ${ctx.maxHubs}.`);
        }
        state.hubs = resolved;
    } else {
        const inputs = splitList(opts.value);
        const tags = [];
        const tagErrors = [];
        for (const raw of inputs) {
            const tag = normalizeTag(raw);
            if (!tag) continue;
            if (tag.length > TAG_MAX_LEN) {
                tagErrors.push(`${raw} (too long)`);
                continue;
            }
            if (!tags.includes(tag)) tags.push(tag);
        }
        if (tagErrors.length > 0) {
            throw new Error(`Invalid tag(s): ${tagErrors.join(', ')}.`);
        }
        if (tags.length > ctx.maxTags) {
            throw new Error(`Too many tags: ${tags.length}. Maximum is ${ctx.maxTags}.`);
        }
        state.tags = tags;
    }

    state.updatedAt = new Date().toISOString();
    state.appliedAt = null;
    state.cursor = computeCursor(state);

    const actions = [];
    if (opts.dryRun) {
        actions.push({ path: rel(ctx.target, ctx.statePath), status: 'would-write' });
    } else {
        mkdirSync(ctx.habrDir, { recursive: true });
        writeJson(ctx.statePath, state);
        actions.push({ path: rel(ctx.target, ctx.statePath), status: 'written' });
    }

    return publicContext(ctx, {
        phase: 'habr',
        action: opts.dryRun ? 'dry_run' : 'saved',
        ready: true,
        complete: isApplied(state),
        field: opts.field,
        hubs: state.hubs,
        tags: state.tags,
        maxHubs: ctx.maxHubs,
        maxTags: ctx.maxTags,
        cursor: state.cursor,
        actions,
    });
}

export function applyHabr(ctx, opts) {
    if (!ctx.slug) return needsSlug(ctx);
    if (!ctx.articleExists) {
        return publicContext(ctx, {
            phase: 'habr',
            action: 'needs_scaffold',
            ready: false,
            complete: false,
            message: labels(ctx.language).notReady,
        });
    }

    const state = ctx.existingState;
    if (!state) {
        throw new Error('No habr state found. Run habr-resume and habr-answer first.');
    }
    if (state.hubs.length === 0 && state.tags.length === 0) {
        throw new Error('Nothing to apply — hubs and tags are both empty. Run habr-answer first.');
    }

    const indexContent = ctx.indexContent ?? '';
    const fm = parseFrontmatter(indexContent);
    const existingHubs = fm ? readArrayField(fm, 'hubs') : [];
    const existingTags = fm ? readArrayField(fm, 'tags') : [];

    const newHubTitles = state.hubs.map((h) => h.title);
    const newTags = state.tags;

    const hubsDiff = !shallowEqual(existingHubs, newHubTitles);
    const tagsDiff = !shallowEqual(existingTags, newTags);
    const hubsOccupied = existingHubs.length > 0 && hubsDiff;
    const tagsOccupied = existingTags.length > 0 && tagsDiff;
    const hasConflict = (hubsOccupied || tagsOccupied) && !opts.force;

    const nextContent = renderIndexWithFrontmatter(indexContent, fm, newHubTitles, newTags);
    const targetPath = hasConflict ? `${ctx.indexPath}.new` : ctx.indexPath;

    const actions = [];
    if (hasConflict) {
        actions.push({
            path: rel(ctx.target, targetPath),
            status: opts.dryRun ? 'would-write-suggestion' : 'suggestion-written',
            conflict: true,
        });
    } else if (!hubsDiff && !tagsDiff) {
        actions.push({
            path: rel(ctx.target, ctx.indexPath),
            status: 'unchanged',
            conflict: false,
        });
    } else {
        actions.push({
            path: rel(ctx.target, targetPath),
            status: opts.dryRun ? 'would-write' : 'written',
            conflict: false,
        });
    }

    const conflicts = hasConflict ? [rel(ctx.target, ctx.indexPath)] : [];

    if (!opts.dryRun) {
        if (hasConflict || hubsDiff || tagsDiff) {
            writeFileSync(targetPath, nextContent, 'utf8');
        }
        const now = new Date().toISOString();
        state.updatedAt = now;
        state.appliedAt = now;
        mkdirSync(ctx.habrDir, { recursive: true });
        writeJson(ctx.statePath, state);
        actions.push({ path: rel(ctx.target, ctx.statePath), status: 'written', conflict: false });
    }

    return publicContext(ctx, {
        phase: 'habr',
        action: opts.dryRun ? 'dry_run' : 'applied',
        ready: true,
        complete: isApplied(state),
        force: opts.force,
        dryRun: opts.dryRun,
        hubs: state.hubs,
        tags: state.tags,
        maxHubs: ctx.maxHubs,
        maxTags: ctx.maxTags,
        actions,
        conflicts,
    });
}

export function outputResult(result, opts, humanFormatter) {
    if (opts.json) {
        console.log(`${JSON.stringify(result, null, 2)}\n`.trimEnd());
        return;
    }
    console.log(humanFormatter(result));
}

export function formatStatusHuman(result) {
    const lines = [`Article habr: ${result.slug || 'slug required'}`, `Status: ${result.action}`];
    if (result.currentQuestion) lines.push(`Question: ${result.currentQuestion.question}`);
    lines.push(`Hubs (${result.hubs?.length || 0}/${result.maxHubs}): ${(result.hubs || []).map((h) => h.title).join(', ') || '—'}`);
    lines.push(`Tags (${result.tags?.length || 0}/${result.maxTags}): ${(result.tags || []).join(', ') || '—'}`);
    if (result.next?.recommendation) lines.push(`Next: ${result.next.recommendation}`);
    return lines.join('\n');
}

export function formatResumeHuman(result) {
    const lines = [`Article habr resume: ${result.slug || 'slug required'}`, `Action: ${result.action}`];
    if (result.cursor) lines.push(`Cursor: ${result.cursor.phase}`);
    if (result.articleContext?.title) lines.push(`Title: ${result.articleContext.title}`);
    lines.push(`Hubs: ${(result.hubs || []).map((h) => h.title).join(', ') || '—'}`);
    lines.push(`Tags: ${(result.tags || []).join(', ') || '—'}`);
    if (result.message) lines.push(result.message);
    if (result.next?.recommendation) lines.push(`Next: ${result.next.recommendation}`);
    return lines.join('\n');
}

export function formatAnswerHuman(result) {
    const lines = [`Article habr answer: ${result.slug || 'slug required'}`, `Action: ${result.action}`];
    if (result.field === 'hubs') {
        lines.push(`Hubs: ${(result.hubs || []).map((h) => `${h.title}${h.multiauthor ? ' *' : ''}`).join(', ') || '—'}`);
    } else if (result.field === 'tags') {
        lines.push(`Tags: ${(result.tags || []).join(', ') || '—'}`);
    }
    for (const action of result.actions || []) lines.push(`- ${action.status}: ${action.path}`);
    return lines.join('\n');
}

export function formatApplyHuman(result) {
    const lines = [`Article habr apply: ${result.slug || 'slug required'}`, `Action: ${result.action}`];
    for (const action of result.actions || []) lines.push(`- ${action.status}: ${action.path}`);
    if (result.conflicts?.length) {
        lines.push(`Conflicts (use --force to overwrite): ${result.conflicts.join(', ')}`);
    }
    return lines.join('\n');
}

function needsSlug(ctx) {
    return publicContext(ctx, {
        phase: 'habr',
        action: 'needs_input',
        currentQuestion: {
            id: 'slug',
            kind: 'text',
            question: labels(ctx.language).slugQuestion,
        },
        ready: false,
        complete: false,
    });
}

function buildInitialState(ctx) {
    return {
        $schema: STATE_SCHEMA_URL,
        schemaVersion: STATE_SCHEMA_VERSION,
        version: STATE_VERSION,
        generatedBy: SKILL_NAME,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        slug: ctx.slug,
        title: ctx.title,
        language: ctx.language,
        articleDir: ctx.slug,
        maxHubs: ctx.maxHubs,
        maxTags: ctx.maxTags,
        hubs: [],
        tags: [],
        cursor: { phase: 'hubs' },
        appliedAt: null,
    };
}

function ensureStateShape(ctx, state) {
    if (!Array.isArray(state.hubs)) state.hubs = [];
    if (!Array.isArray(state.tags)) state.tags = [];
    state.maxHubs = ctx.maxHubs;
    state.maxTags = ctx.maxTags;
    state.slug = state.slug || ctx.slug;
    state.title = state.title || ctx.title;
    state.language = normalizeLanguage(state.language || ctx.language);
    state.articleDir = state.articleDir || ctx.slug;
    state.$schema = state.$schema || STATE_SCHEMA_URL;
    state.schemaVersion = state.schemaVersion || STATE_SCHEMA_VERSION;
    state.version = state.version || STATE_VERSION;
    state.generatedBy = state.generatedBy || SKILL_NAME;
    state.createdAt = state.createdAt || new Date().toISOString();
    state.appliedAt = null;
    state.cursor = computeCursor(state);
}

function computeCursor(state) {
    if (!Array.isArray(state.hubs) || state.hubs.length === 0) {
        return { phase: 'hubs' };
    }
    if (!Array.isArray(state.tags) || state.tags.length === 0) {
        return { phase: 'tags' };
    }
    return null;
}

function isApplied(state) {
    return Boolean(state?.appliedAt) && (state?.hubs?.length > 0 || state?.tags?.length > 0);
}

function buildArticleContext(ctx) {
    const leadExcerpt = ctx.leadContent
        ? truncate(stripMarkdown(ctx.leadContent), LEAD_EXCERPT_LEN)
        : null;
    const brief = ctx.brief || null;
    return {
        title: ctx.title,
        leadExcerpt,
        brief: brief
            ? {
                  topic: brief.topic || null,
                  goal: brief.goal || null,
                  audience: brief.audience || null,
                  readerTakeaway: brief.readerTakeaway || null,
                  publicationTargets: brief.publicationTargets || null,
              }
            : null,
    };
}

function matchHub(input, registry) {
    const raw = String(input).trim().replace(/\s*\*\s*$/, '').toLowerCase();
    if (!raw) return null;
    const hubs = Array.isArray(registry?.hubs) ? registry.hubs : [];
    const byAlias = hubs.find((h) => h.alias.toLowerCase() === raw);
    if (byAlias) return { alias: byAlias.alias, title: byAlias.title, multiauthor: byAlias.multiauthor };
    const byTitle = hubs.find((h) => h.title.toLowerCase() === raw);
    if (byTitle) return { alias: byTitle.alias, title: byTitle.title, multiauthor: byTitle.multiauthor };
    const normalized = normalizeHubAlias(raw);
    const byNorm = hubs.find((h) => h.alias.toLowerCase() === normalized || normalizeHubAlias(h.title) === normalized);
    if (byNorm) return { alias: byNorm.alias, title: byNorm.title, multiauthor: byNorm.multiauthor };
    return null;
}

function normalizeHubAlias(value) {
    return String(value)
        .trim()
        .toLowerCase()
        .replace(/['"`]/g, '')
        .replace(/[^a-zа-яё0-9#+.$*]+/giu, '-')
        .replace(/^-+|-+$/g, '')
        .replace(/-{2,}/g, '-');
}

function normalizeTag(value) {
    const tag = String(value)
        .trim()
        .replace(/^#/, '')
        .replace(/\s+/g, ' ')
        .toLowerCase();
    return tag || null;
}

function splitList(value) {
    return String(value)
        .split(/[,;\n]/)
        .map((part) => part.trim())
        .filter((part) => part.length > 0);
}

function registrySummary(registry) {
    return {
        source: registry?.source || null,
        fetchedAt: registry?.fetchedAt || null,
        hubCount: registry?.hubCount ?? (Array.isArray(registry?.hubs) ? registry.hubs.length : 0),
        limits: registry?.limits || null,
        registryPath: HUBS_REGISTRY_PATH,
    };
}

function parseFrontmatter(text) {
    if (!text) return null;
    const lines = text.split(/\r?\n/);
    if (lines[0]?.trim() !== '---') return null;
    let end = -1;
    for (let i = 1; i < lines.length; i += 1) {
        if (lines[i].trim() === '---') {
            end = i;
            break;
        }
    }
    if (end === -1) return null;
    return { startLine: 0, endLine: end, lines: lines.slice(1, end), raw: lines.slice(0, end + 1) };
}

function readArrayField(fm, key) {
    const line = fm.lines.find((l) => new RegExp(`^${key}\\s*:`).test(l));
    if (!line) return [];
    const value = line.slice(line.indexOf(':') + 1).trim();
    if (!value || value === '[]') return [];
    const inner = value.replace(/^\[/, '').replace(/\]$/, '').trim();
    if (!inner) return [];
    return inner
        .split(',')
        .map((part) => part.trim().replace(/^["']|["']$/g, ''))
        .filter((part) => part.length > 0);
}

function renderIndexWithFrontmatter(text, fm, hubTitles, tags) {
    const lines = text.split(/\r?\n/);
    if (!fm) {
        const front = [
            '---',
            `tags: [${tags.map(quote).join(', ')}]`,
            'publication:',
            `hubs: [${hubTitles.map(quote).join(', ')}]`,
            '---',
            '',
        ];
        return `${front.join('\n')}\n${lines.join('\n').replace(/^\n+/, '')}`;
    }

    const fmLines = [...fm.lines];
    const replaceOrInsert = (key, rendered) => {
        const idx = fmLines.findIndex((l) => new RegExp(`^${key}\\s*:`).test(l));
        if (idx >= 0) {
            fmLines[idx] = rendered;
        } else {
            fmLines.push(rendered);
        }
    };
    replaceOrInsert('tags', `tags: [${tags.map(quote).join(', ')}]`);
    replaceOrInsert('hubs', `hubs: [${hubTitles.map(quote).join(', ')}]`);

    const before = lines.slice(0, fm.startLine);
    const after = lines.slice(fm.endLine + 1);
    return [...before, '---', ...fmLines, '---', ...after].join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
}

function quote(value) {
    return `"${String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function shallowEqual(a, b) {
    if (!Array.isArray(a) || !Array.isArray(b)) return false;
    if (a.length !== b.length) return false;
    return a.every((v, i) => v === b[i]);
}

function stripMarkdown(text) {
    return String(text)
        .replace(/^---[\s\S]*?---\n?/, '')
        .replace(/!\[\[[^\]]+\]\]/g, '')
        .replace(/\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g, '$1')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .replace(/^#{1,6}\s+/gm, '')
        .replace(/^>\s?/gm, '')
        .replace(/[*_`~]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function truncate(text, max) {
    const clean = String(text).replace(/\s+/g, ' ').trim();
    return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

function nextStep(ctx, action) {
    if (!ctx.slug) return { recommendation: 'Provide article slug.' };
    if (!ctx.articleExists) return { recommendation: labels(ctx.language).notReady };
    if (action === 'status') return { recommendation: 'Run habr-resume.mjs to start or continue the hubs/tags dialogue.' };
    return { recommendation: 'Run habr-answer.mjs to save the next selection, then habr-apply.mjs.' };
}

function discoverScaffoldStates(scaffoldDir) {
    if (!existsSync(scaffoldDir)) return [];
    return readdirSync(scaffoldDir)
        .filter((name) => name.endsWith('.json'))
        .map((name) => {
            const path = join(scaffoldDir, name);
            const state = readJson(path);
            return {
                slug: normalizeSlug(state?.slug) || normalizeSlug(name.replace(/\.json$/, '')),
                title: stringOrNull(state?.title),
                language: normalizeLanguage(state?.language || 'ru'),
                status: state?.status || null,
                updatedAt: state?.updatedAt || null,
                path,
            };
        })
        .filter((item) => item.slug)
        .sort((a, b) => a.slug.localeCompare(b.slug));
}

function discoverHabrStates(habrDir) {
    if (!existsSync(habrDir)) return [];
    return readdirSync(habrDir)
        .filter((name) => name.endsWith('.json'))
        .map((name) => {
            const path = join(habrDir, name);
            const state = readJson(path);
            return {
                slug: normalizeSlug(state?.slug) || normalizeSlug(name.replace(/\.json$/, '')),
                status: state?.appliedAt ? 'applied' : 'started',
                updatedAt: state?.updatedAt || null,
                path,
            };
        })
        .filter((item) => item.slug)
        .sort((a, b) => a.slug.localeCompare(b.slug));
}

function resolveSlug({ explicitSlug, threadTitle, target, discoveredStates, discoveredHabrStates }) {
    if (explicitSlug) return { slug: explicitSlug, source: 'argument' };
    const threadSlug = normalizeSlug(threadTitle);
    if (threadSlug) {
        const hasState = discoveredStates.some((s) => s.slug === threadSlug);
        const hasHabr = (discoveredHabrStates || []).some((s) => s.slug === threadSlug);
        const hasFolder = existsSync(join(target, threadSlug));
        if (hasState || hasHabr || hasFolder) return { slug: threadSlug, source: 'thread-title' };
    }
    const cwdSlug = normalizeSlug(basename(process.cwd()));
    if (cwdSlug) {
        const hasState = discoveredStates.some((s) => s.slug === cwdSlug);
        const hasHabr = (discoveredHabrStates || []).some((s) => s.slug === cwdSlug);
        const hasFolder = existsSync(join(target, cwdSlug)) && cwdSlug !== basename(target);
        if (hasState || hasHabr || hasFolder) return { slug: cwdSlug, source: 'cwd' };
    }
    if (discoveredStates.length === 1) return { slug: discoveredStates[0].slug, source: 'single-state' };
    return { slug: null, source: null };
}

function extractBriefFromOutline(outline) {
    if (!outline) return null;
    const start = outline.indexOf('<!-- article-kit:brief:start -->');
    const end = outline.indexOf('<!-- article-kit:brief:end -->');
    if (start === -1 || end === -1) return null;
    return { extractedFromOutline: true };
}

function readJson(path) {
    if (!path || !existsSync(path)) return null;
    try {
        return JSON.parse(readFileSync(path, 'utf8'));
    } catch {
        return null;
    }
}

function writeJson(path, value) {
    writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function readTitleFromIndex(indexPath) {
    if (!existsSync(indexPath)) return null;
    const text = readFileSync(indexPath, 'utf8');
    const heading = text.match(/^#\s+(.+)$/m);
    if (heading) return heading[1].trim();
    return null;
}

function publicContext(ctx, extra = {}) {
    return {
        skill: SKILL_NAME,
        stateSchema: STATE_SCHEMA_URL,
        stateSchemaVersion: STATE_SCHEMA_VERSION,
        target: ctx.target,
        slug: ctx.slug,
        slugSource: ctx.slugSource,
        title: ctx.title,
        suggestedThreadTitle: ctx.suggestedThreadTitle,
        language: ctx.language,
        articleDir: ctx.articleDir ? rel(ctx.target, ctx.articleDir) : null,
        scaffoldState: ctx.scaffoldStatePath ? rel(ctx.target, ctx.scaffoldStatePath) : null,
        scaffoldStatus: ctx.scaffoldStatus,
        discoveredStates: ctx.discoveredStates.map((s) => ({
            slug: s.slug,
            title: s.title,
            language: s.language,
            status: s.status,
            updatedAt: s.updatedAt,
        })),
        ...extra,
    };
}

function requireValue(argv, index, flag) {
    const value = argv[index];
    if (!value || value.startsWith('--')) throw new Error(`Missing value for ${flag}`);
    return value;
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

function normalizeField(value) {
    const field = String(value).trim().toLowerCase();
    if (field !== 'hubs' && field !== 'tags') {
        throw new Error(`--field must be one of hubs, tags (got: ${value})`);
    }
    return field;
}

function stringOrNull(value) {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
}

function labels(language) {
    return TEXT[normalizeLanguage(language)];
}

function rel(root, path) {
    if (!path) return null;
    const value = relative(root, path);
    return value && !value.startsWith('..') ? value : path;
}
