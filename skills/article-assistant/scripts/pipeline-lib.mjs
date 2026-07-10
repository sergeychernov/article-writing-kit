import { execSync } from 'node:child_process';
import {
    existsSync,
    readdirSync,
    readFileSync,
} from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const SKILL_NAME = 'article-assistant';
export const STATE_SCHEMA_VERSION = 1;
export const STATE_VERSION = 1;
export const STATE_SCHEMA_URL =
    'https://raw.githubusercontent.com/sergeychernov/article-writing-kit/main/skills/article-assistant/assets/schemas/pipeline-state.schema.json';

const INTENTS = ['auto', 'notes', 'scaffold', 'architect', 'structure', 'habr'];
const STAGES = ['init', 'notes', 'scaffold', 'brief', 'architect', 'draft', 'structure', 'habr', 'done'];
const SUBAGENTS = {
    init: 'article-init',
    notes: 'article-notes',
    scaffold: 'article-scaffold',
    brief: 'article-scaffold',
    architect: 'article-architect',
    structure: 'article-structure',
    habr: 'article-habr',
};

const HERE = dirname(fileURLToPath(import.meta.url));
const SKILLS_DIR = dirname(dirname(HERE));

const TEXT = {
    ru: {
        slugQuestion: 'Какой slug статьи?',
        notInitialized: 'Рабочее пространство не инициализировано. Сначала запусти article-init.',
        routeReason: {
            init: 'workspace not initialized',
            notes: 'notes in progress or requested',
            scaffold: 'scaffold incomplete',
            brief: 'brief incomplete',
            architect: 'architecture missing',
            draft: 'act files have no drafted prose yet',
            structure: 'structure labelling pending',
            habr: 'habr metadata pending',
            done: 'all stages complete',
        },
        allDone: 'Все этапы пройдены. Статья готова.',
        draftHint: 'Черновики act-*.md ещё не написаны. Используй авторский агент/черновик, затем вернись к article-structure.',
    },
    en: {
        slugQuestion: 'Which article slug?',
        notInitialized: 'Workspace is not initialized. Run article-init first.',
        routeReason: {
            init: 'workspace not initialized',
            notes: 'notes in progress or requested',
            scaffold: 'scaffold incomplete',
            brief: 'brief incomplete',
            architect: 'architecture missing',
            draft: 'act files have no drafted prose yet',
            structure: 'structure labelling pending',
            habr: 'habr metadata pending',
            done: 'all stages complete',
        },
        allDone: 'All stages complete. The article is ready.',
        draftHint: 'act-*.md drafts are not written yet. Use a drafting agent/flow, then return to article-structure.',
    },
};

export function parseArgs(argv = process.argv.slice(2)) {
    const opts = {
        target: '.',
        slug: null,
        threadTitle: null,
        language: null,
        intent: 'auto',
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
        } else if (arg === '--slug') {
            opts.slug = normalizeSlug(requireValue(argv, (i += 1), arg));
        } else if (arg === '--thread-title' || arg === '--chat-title') {
            opts.threadTitle = requireValue(argv, (i += 1), arg);
        } else if (arg === '--language') {
            opts.language = normalizeLanguage(requireValue(argv, (i += 1), arg));
        } else if (arg === '--intent') {
            opts.intent = normalizeIntent(requireValue(argv, (i += 1), arg));
        } else if (arg.startsWith('--')) {
            throw new Error(`Unknown flag: ${arg}`);
        } else {
            throw new Error(`Unexpected argument: ${arg}`);
        }
    }

    return opts;
}

export function printUsage() {
    console.log(`Usage:
  node <SKILL_DIR>/scripts/pipeline-status.mjs [--target <path>] [--slug <slug>] [--thread-title <title>] [--intent <auto|notes|scaffold|architect|structure|habr>] [--json]

Flags:
  --target <path>     Article workspace root; default is current working directory
  --slug <slug>       Article folder name; unsafe characters are normalized
  --thread-title <t>  Current IDE thread/chat title; used to recover an article slug
  --chat-title <t>    Alias for --thread-title
  --language ru|en    Output language when no state can provide it
  --intent <i>        Hint which stage the user wants: auto (default), notes, scaffold, architect, structure, habr
  --dry-run           Read-only (pipeline-status is always read-only; kept for consistency)
  --json              Print machine-readable JSON
  --help              Show this help
`);
}

export function buildContext(opts = {}) {
    const target = resolve(process.cwd(), opts.target || '.');
    const articleKitDir = join(target, '.article-kit');
    const notesDir = join(articleKitDir, 'notes');
    const scaffoldDir = join(articleKitDir, 'scaffold');
    const architectDir = join(articleKitDir, 'architect');
    const structureDir = join(articleKitDir, 'structure');
    const habrDir = join(articleKitDir, 'habr');
    const discoveredNotes = discoverStates(notesDir);
    const discoveredScaffold = discoverStates(scaffoldDir);
    const slugInfo = resolveSlug({
        explicitSlug: opts.slug,
        threadTitle: opts.threadTitle,
        target,
        discoveredNotes,
        discoveredScaffold,
    });
    const slug = slugInfo.slug;
    const initialized = isWorkspaceInitialized(target);
    const language = normalizeLanguage(opts.language || 'ru');

    return {
        skill: SKILL_NAME,
        stateSchema: STATE_SCHEMA_URL,
        target,
        articleKitDir,
        notesDir,
        scaffoldDir,
        architectDir,
        structureDir,
        habrDir,
        discoveredNotes,
        discoveredScaffold,
        slug,
        slugSource: slugInfo.source,
        suggestedThreadTitle: slug,
        initialized,
        language,
        intent: opts.intent || 'auto',
    };
}

export function createPipelineResponse(ctx) {
    const l = labels(ctx.language);

    if (!ctx.initialized) {
        return publicContext(ctx, {
            action: 'route',
            stage: 'init',
            recommendedSubagent: SUBAGENTS.init,
            optionalSubagents: [],
            reason: l.routeReason.init,
            message: l.notInitialized,
            statusByPhase: { init: { initialized: false } },
            next: { recommendation: 'Delegate to article-init to initialize the workspace.' },
        });
    }

    if (!ctx.slug) {
        return publicContext(ctx, {
            action: 'needs_input',
            stage: 'unknown',
            recommendedSubagent: null,
            optionalSubagents: [],
            reason: 'slug required',
            currentQuestion: {
                id: 'slug',
                kind: 'text',
                question: l.slugQuestion,
            },
            statusByPhase: {},
            next: { recommendation: 'Provide --slug or run inside an article folder.' },
        });
    }

    const statusByPhase = collectPhaseStatuses(ctx);
    const route = decideRoute(ctx, statusByPhase, l);

    return publicContext(ctx, {
        action: 'route',
        stage: route.stage,
        recommendedSubagent: route.recommendedSubagent,
        optionalSubagents: route.optionalSubagents,
        reason: route.reason,
        message: route.message || null,
        statusByPhase,
        next: route.next,
    });
}

export function outputResult(result, opts, humanFormatter) {
    if (opts.json) {
        console.log(`${JSON.stringify(result, null, 2)}\n`.trimEnd());
        return;
    }
    console.log(humanFormatter(result));
}

export function formatHuman(result) {
    const lines = [
        `Article assistant: ${result.slug || 'slug required'}`,
        `Action: ${result.action}`,
    ];
    if (result.stage) lines.push(`Stage: ${result.stage}`);
    if (result.recommendedSubagent) lines.push(`Delegate to: ${result.recommendedSubagent}`);
    if (result.reason) lines.push(`Reason: ${result.reason}`);
    if (result.message) lines.push(result.message);
    if (result.optionalSubagents?.length) {
        lines.push(`Optional: ${result.optionalSubagents.join(', ')}`);
    }
    if (result.next?.recommendation) lines.push(`Next: ${result.next.recommendation}`);
    return lines.join('\n');
}

function decideRoute(ctx, statusByPhase, l) {
    const intent = ctx.intent;

    // Explicit intent overrides the recommended route (the user asked for it).
    if (intent !== 'auto' && SUBAGENTS[intent]) {
        return {
            stage: intent,
            recommendedSubagent: SUBAGENTS[intent],
            optionalSubagents: intent === 'scaffold' || intent === 'architect' ? ['article-notes'] : [],
            reason: `intent=${intent}`,
            message: null,
            next: { recommendation: `Delegate to ${SUBAGENTS[intent]} as the user requested.` },
        };
    }

    const notes = statusByPhase.notes;
    if (notes?.status === 'started') {
        return {
            stage: 'notes',
            recommendedSubagent: SUBAGENTS.notes,
            optionalSubagents: [],
            reason: l.routeReason.notes,
            next: { recommendation: 'Resume article-notes; when complete or skipped, rerun pipeline-status.' },
        };
    }

    const scaffold = statusByPhase.scaffold;
    const brief = statusByPhase.brief;

    // Brief missing fields → finish the brief (article-scaffold handles brief).
    if (brief?.action === 'needs_input' || brief?.status === 'needs_brief') {
        return {
            stage: 'brief',
            recommendedSubagent: SUBAGENTS.brief,
            optionalSubagents: ['article-notes'],
            reason: l.routeReason.brief,
            next: { recommendation: 'Delegate to article-scaffold (brief flow) to finish the brief.' },
        };
    }
    // Brief blocked by missing scaffold → finish scaffold first.
    if (brief?.action === 'needs_scaffold_input' || brief?.status === 'needs_scaffold_input') {
        return {
            stage: 'scaffold',
            recommendedSubagent: SUBAGENTS.scaffold,
            optionalSubagents: ['article-notes'],
            reason: l.routeReason.scaffold,
            next: { recommendation: 'Finish article-scaffold (folder) before the brief.' },
        };
    }
    // Scaffold folder itself incomplete (no brief state yet).
    const scaffoldNeedsInput =
        scaffold?.action === 'needs_input' ||
        scaffold?.action === 'needs_scaffold_input' ||
        scaffold?.status === 'needs_scaffold' ||
        scaffold?.status === 'needs_scaffold_input' ||
        scaffold?.status === 'in_progress';
    if (scaffold?.status !== 'skill_missing' && scaffoldNeedsInput) {
        return {
            stage: 'scaffold',
            recommendedSubagent: SUBAGENTS.scaffold,
            optionalSubagents: ['article-notes'],
            reason: l.routeReason.scaffold,
            next: { recommendation: 'Delegate to article-scaffold to create the folder and files.' },
        };
    }

    const architect = statusByPhase.architect;
    if (architect?.status === 'skill_missing') {
        // Skip architect routing if the skill is not installed; fall through to draft/structure.
    } else if (architect?.ready === true && architect?.complete !== true) {
        return {
            stage: 'architect',
            recommendedSubagent: SUBAGENTS.architect,
            optionalSubagents: [],
            reason: l.routeReason.architect,
            next: { recommendation: 'Delegate to article-architect to build the three-act outline.' },
        };
    }

    const draft = statusByPhase.draft;
    if (draft?.status === 'needs_draft') {
        return {
            stage: 'draft',
            recommendedSubagent: null,
            optionalSubagents: [],
            reason: l.routeReason.draft,
            message: l.draftHint,
            next: { recommendation: 'Draft act-*.md prose, then rerun pipeline-status to reach article-structure.' },
        };
    }

    const structure = statusByPhase.structure;
    if (structure?.action === 'needs_scaffold' || structure?.status === 'needs_scaffold') {
        return {
            stage: 'scaffold',
            recommendedSubagent: SUBAGENTS.scaffold,
            optionalSubagents: [],
            reason: l.routeReason.scaffold,
            next: { recommendation: 'Run article-scaffold first; structure needs drafted act files.' },
        };
    }
    if (structure?.ready === true && structure?.complete !== true) {
        return {
            stage: 'structure',
            recommendedSubagent: SUBAGENTS.structure,
            optionalSubagents: [],
            reason: l.routeReason.structure,
            next: { recommendation: 'Delegate to article-structure to label the drafted article with headings.' },
        };
    }

    if (structure?.complete === true) {
        const habr = statusByPhase.habr;
        if (habr?.status === 'skill_missing') {
            // Skip habr routing if the skill is not installed; fall through to done.
        } else if (habr?.complete !== true) {
            return {
                stage: 'habr',
                recommendedSubagent: SUBAGENTS.habr,
                optionalSubagents: [],
                reason: l.routeReason.habr,
                next: { recommendation: 'Delegate to article-habr to pick Habr format, audience, complexity, hubs and tags.' },
            };
        }
        return {
            stage: 'done',
            recommendedSubagent: null,
            optionalSubagents: [],
            reason: l.routeReason.done,
            message: l.allDone,
            next: { recommendation: 'The article is structured and ready to publish.' },
        };
    }

    return {
        stage: 'unknown',
        recommendedSubagent: null,
        optionalSubagents: [],
        reason: 'could not determine stage',
        next: { recommendation: 'Inspect statusByPhase and ask the user which stage to run.' },
    };
}

function collectPhaseStatuses(ctx) {
    const phases = {};

    phases.notes = notesPhase(ctx);
    phases.scaffold = spawnStatus(ctx, 'article-scaffold', 'scaffold-status.mjs');
    phases.brief = spawnStatus(ctx, 'article-scaffold', 'brief-status.mjs');
    phases.architect = spawnStatus(ctx, 'article-architect', 'architect-status.mjs');
    phases.draft = draftPhase(ctx);
    phases.structure = spawnStatus(ctx, 'article-structure', 'structure-status.mjs');
    phases.habr = spawnStatus(ctx, 'article-habr', 'habr-status.mjs');

    return phases;
}

function notesPhase(ctx) {
    const statePath = join(ctx.notesDir, `${ctx.slug}.json`);
    const state = readJson(statePath);
    if (!state) {
        return { status: 'absent', action: null, recordCount: 0, leadingClimaxId: null };
    }
    return {
        status: state.status || 'started',
        action: state.status === 'started' ? 'needs_input' : state.status,
        recordCount: state.records?.length || 0,
        leadingClimaxId: state.leadingClimaxId || null,
    };
}

function draftPhase(ctx) {
    const scaffoldState = readJson(join(ctx.scaffoldDir, `${ctx.slug}.json`));
    const articleDir = join(ctx.target, ctx.slug);
    if (!existsSync(articleDir)) {
        return { status: 'needs_scaffold', action: 'needs_scaffold' };
    }
    const actFiles = resolveActFiles({ slug: ctx.slug, scaffoldState, articleDir });
    let totalProse = 0;
    let present = 0;
    for (const key of ['act1', 'act2', 'act3']) {
        const path = actFiles[key];
        if (!path || !existsSync(path)) continue;
        present += 1;
        const text = readFileSync(path, 'utf8');
        const prose = text
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter((line) => line && !line.startsWith('<!--') && !line.startsWith('#') && !line.startsWith('>'))
            .join(' ').length;
        totalProse += prose;
    }
    const drafted = present > 0 && totalProse > 200;
    return {
        status: drafted ? 'drafted' : 'needs_draft',
        actFilesPresent: present,
        totalProse,
    };
}

function spawnStatus(ctx, skill, script) {
    const scriptPath = join(SKILLS_DIR, skill, 'scripts', script);
    if (!existsSync(scriptPath)) {
        return { status: 'skill_missing', action: 'skill_missing', skill, script };
    }
    try {
        const cmd = [
            process.execPath,
            `"${scriptPath}"`,
            '--target',
            `"${ctx.target}"`,
            '--slug',
            ctx.slug,
            '--json',
        ].join(' ');
        const stdout = execSync(cmd, { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
        const parsed = JSON.parse(stdout);
        return summarizeStatus(parsed);
    } catch (error) {
        return {
            status: 'error',
            action: 'error',
            skill,
            script,
            message: error.message.split('\n')[0],
        };
    }
}

function summarizeStatus(parsed) {
    if (!parsed || typeof parsed !== 'object') return { status: 'unknown', action: 'unknown' };
    return {
        status: parsed.status || parsed.action || null,
        action: parsed.action || null,
        ready: parsed.ready ?? null,
        complete: parsed.complete ?? null,
        skipped: parsed.skipped ?? null,
        missingBriefFields: parsed.missingBriefFields || null,
        currentQuestion: parsed.currentQuestion || null,
        next: parsed.next || null,
    };
}

function resolveActFiles({ slug, scaffoldState, articleDir }) {
    const files = { act1: null, act2: null, act3: null };
    if (!existsSync(articleDir)) return files;
    const scaffoldFiles = Array.isArray(scaffoldState?.files) ? scaffoldState.files : [];
    for (const key of ['act1', 'act2', 'act3']) {
        const num = key === 'act1' ? 1 : key === 'act2' ? 2 : 3;
        const fromState = scaffoldFiles.find(
            (name) => new RegExp(`^act-${num}-[a-z0-9-]+\\.md$`, 'i').test(name) || name === `act-${num}.md`
        );
        if (fromState) {
            const path = join(articleDir, fromState);
            if (existsSync(path)) files[key] = path;
            continue;
        }
        const matches = readdirSync(articleDir)
            .filter((name) => new RegExp(`^act-${num}(?:-[a-z0-9-]+)?\\.md$`, 'i').test(name))
            .sort();
        if (matches.length > 0) files[key] = join(articleDir, matches[0]);
    }
    return files;
}

function isWorkspaceInitialized(target) {
    if (existsSync(join(target, '.article-kit'))) return true;
    if (existsSync(join(target, '.cursor', 'rules', 'article-writing-obsidian.mdc'))) return true;
    if (existsSync(join(target, 'AGENTS.md')) && existsSync(join(target, '.article-kit')) === false) {
        // AGENTS.md alone is weak evidence; require an article-kit marker too.
        return false;
    }
    return false;
}

function discoverStates(dir) {
    if (!existsSync(dir)) return [];
    return readdirSync(dir)
        .filter((name) => name.endsWith('.json'))
        .map((name) => {
            const path = join(dir, name);
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

function resolveSlug({ explicitSlug, threadTitle, target, discoveredNotes, discoveredScaffold }) {
    if (explicitSlug) return { slug: explicitSlug, source: 'argument' };
    const threadSlug = normalizeSlug(threadTitle);
    if (threadSlug) {
        const matchNotes = discoveredNotes.some((s) => s.slug === threadSlug);
        const matchScaffold = discoveredScaffold.some((s) => s.slug === threadSlug);
        const matchFolder = existsSync(join(target, threadSlug));
        if (matchNotes || matchScaffold || matchFolder) return { slug: threadSlug, source: 'thread-title' };
        return { slug: threadSlug, source: 'thread-title-new' };
    }
    const cwdSlug = normalizeSlug(basename(process.cwd()));
    if (cwdSlug) {
        const matchNotes = discoveredNotes.some((s) => s.slug === cwdSlug);
        const matchScaffold = discoveredScaffold.some((s) => s.slug === cwdSlug);
        const matchFolder = existsSync(join(target, cwdSlug)) && cwdSlug !== basename(target);
        if (matchNotes || matchScaffold || matchFolder) return { slug: cwdSlug, source: 'cwd' };
    }
    if (discoveredScaffold.length === 1) return { slug: discoveredScaffold[0].slug, source: 'single-scaffold-state' };
    if (discoveredNotes.length === 1) return { slug: discoveredNotes[0].slug, source: 'single-notes-state' };
    return { slug: null, source: null };
}

function publicContext(ctx, extra = {}) {
    return {
        skill: SKILL_NAME,
        stateSchema: STATE_SCHEMA_URL,
        stateSchemaVersion: STATE_SCHEMA_VERSION,
        target: ctx.target,
        slug: ctx.slug,
        slugSource: ctx.slugSource,
        suggestedThreadTitle: ctx.suggestedThreadTitle,
        language: ctx.language,
        initialized: ctx.initialized,
        intent: ctx.intent,
        discoveredNotes: ctx.discoveredNotes.map((s) => ({
            slug: s.slug,
            title: s.title,
            status: s.status,
            updatedAt: s.updatedAt,
        })),
        discoveredScaffold: ctx.discoveredScaffold.map((s) => ({
            slug: s.slug,
            title: s.title,
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

function normalizeIntent(value) {
    const intent = String(value).trim().toLowerCase();
    if (!INTENTS.includes(intent)) {
        throw new Error(`--intent must be one of ${INTENTS.join(', ')} (got: ${value})`);
    }
    return intent;
}

function stringOrNull(value) {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
}

function readJson(path) {
    if (!path || !existsSync(path)) return null;
    try {
        return JSON.parse(readFileSync(path, 'utf8'));
    } catch {
        return null;
    }
}

function labels(language) {
    return TEXT[normalizeLanguage(language)];
}
