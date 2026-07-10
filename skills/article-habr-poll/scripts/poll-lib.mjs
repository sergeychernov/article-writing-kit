#!/usr/bin/env node
// article-habr-poll: shared library for optional Habr in-article poll drafting.

import {
    existsSync,
    mkdirSync,
    readdirSync,
    readFileSync,
    writeFileSync,
} from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const SKILL_NAME = 'article-habr-poll';
export const STATE_SCHEMA_VERSION = 1;
export const STATE_VERSION = 1;
export const STATE_SCHEMA_URL =
    'https://raw.githubusercontent.com/sergeychernov/article-writing-kit/main/skills/article-habr-poll/assets/schemas/habr-poll-state.schema.json';

export const POLL_MARKER_START = '<!-- article-kit:habr-poll:start -->';
export const POLL_MARKER_END = '<!-- article-kit:habr-poll:end -->';
export const MIN_OPTIONS = 2;
export const MAX_OPTIONS = 10;
export const QUESTION_MAX_LEN = 300;
export const OPTION_MAX_LEN = 120;
const LEAD_EXCERPT_LEN = 600;

const HERE = dirname(fileURLToPath(import.meta.url));

const TEXT = {
    ru: {
        slugQuestion: 'Какой slug статьи готовим опрос для Habr?',
        notReady: 'Сначала заверши article-scaffold и напиши черновики act-*.md файлов.',
        needsApply: 'Опрос собран. Запусти poll-apply.mjs — блок добавится в конец act-3 (на Habr опрос только в конце статьи).',
        askDecision: 'Нужен ли встроенный опрос Habr в этой статье? (да/нет)',
        askQuestion: 'Сформулируй вопрос опроса и спроси подтверждение.',
        askOptions: 'Предложи 2–10 вариантов ответа (через запятую) и спроси подтверждение.',
        askMultiple: 'Разрешить несколько ответов? (да/нет)',
        allDone: 'Опрос применён в конец статьи (или сознательно пропущен).',
        skipped: 'Опрос не нужен — шаг пропущен.',
    },
    en: {
        slugQuestion: 'Which article slug are we drafting a Habr poll for?',
        notReady: 'Run article-scaffold and draft the act-*.md files first.',
        needsApply: 'Poll is ready. Run poll-apply.mjs — the block is appended to the end of act-3 (Habr only allows polls at the end of an article).',
        askDecision: 'Do you want an in-article Habr poll for this article? (yes/no)',
        askQuestion: 'Propose the poll question and ask the user to confirm.',
        askOptions: 'Propose 2–10 answer options (comma-separated) and ask the user to confirm.',
        askMultiple: 'Allow multiple answers? (yes/no)',
        allDone: 'Poll applied at the end of the article (or intentionally skipped).',
        skipped: 'No poll needed — step skipped.',
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
        if (arg === '--json') opts.json = true;
        else if (arg === '--dry-run') opts.dryRun = true;
        else if (arg === '--force') opts.force = true;
        else if (arg === '--new') opts.new = true;
        else if (arg === '--help' || arg === '-h') opts.help = true;
        else if (arg === '--target') opts.target = requireValue(argv, (i += 1), arg);
        else if (arg === '--slug') opts.slug = normalizeSlug(requireValue(argv, (i += 1), arg));
        else if (arg === '--thread-title' || arg === '--chat-title') {
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
        'poll-status.mjs': '',
        'poll-resume.mjs': ' [--new]',
        'poll-answer.mjs': ' --field <decision|question|options|multiple> --value <v>',
        'poll-apply.mjs': ' [--force] [--dry-run]',
    }[command];

    console.log(`Usage:
  node <SKILL_DIR>/scripts/${command} [--target <path>] [--slug <slug>] [--thread-title <title>]${extra} [--json]

Flags:
  --target <path>     Article workspace root; default is current working directory
  --slug <slug>       Article folder name; unsafe characters are normalized
  --thread-title <t>  Current IDE thread/chat title; used to recover an article slug
  --chat-title <t>    Alias for --thread-title
  --language ru|en    Output language when scaffold state cannot provide it
  --new               (resume) ignore saved poll state and start over
  --field <f>         (answer) decision | question | options | multiple
  --value <v>         (answer) yes/no, question text, or comma-separated options
  --force             (apply) replace an existing poll marker block
  --dry-run           Show intended changes without writing files
  --json              Print machine-readable JSON
  --help              Show this help
`);
}

export function buildContext(opts = {}) {
    const target = resolve(process.cwd(), opts.target || '.');
    const articleKitDir = join(target, '.article-kit');
    const scaffoldDir = join(articleKitDir, 'scaffold');
    const pollDir = join(articleKitDir, 'habr-poll');
    const discoveredStates = discoverScaffoldStates(scaffoldDir);
    const slugInfo = resolveSlug({
        explicitSlug: opts.slug,
        threadTitle: opts.threadTitle,
        target,
        discoveredStates,
        discoveredPollStates: discoverPollStates(pollDir),
    });
    const slug = slugInfo.slug;
    const scaffoldStatePath = slug ? join(scaffoldDir, `${slug}.json`) : null;
    const scaffoldState = scaffoldStatePath ? readJson(scaffoldStatePath) : null;
    const articleDir = slug ? join(target, slug) : null;
    const articleExists = articleDir ? existsSync(articleDir) : false;
    const statePath = slug ? join(pollDir, `${slug}.json`) : null;
    const existingState = (opts.new ? null : readJson(statePath)) || null;
    const title =
        stringOrNull(scaffoldState?.title) ||
        (articleDir ? readTitleFromIndex(join(articleDir, 'index.md')) : null) ||
        slug;
    const language = normalizeLanguage(
        opts.language || scaffoldState?.language || existingState?.language || 'ru',
    );
    const files = articleExists ? discoverArticleFiles(articleDir) : null;
    const leadContent =
        files?.leadPath && existsSync(files.leadPath) ? readFileSync(files.leadPath, 'utf8') : null;

    return {
        skill: SKILL_NAME,
        stateSchema: STATE_SCHEMA_URL,
        stateSchemaVersion: STATE_SCHEMA_VERSION,
        target,
        scaffoldDir,
        pollDir,
        discoveredStates,
        slug,
        slugSource: slugInfo.source,
        suggestedThreadTitle: slug,
        title,
        language,
        articleDir,
        articleExists,
        files,
        leadContent,
        scaffoldStatePath,
        scaffoldState,
        scaffoldStatus: scaffoldState?.status || null,
        brief: scaffoldState?.brief || null,
        statePath,
        existingState,
        limits: {
            minOptions: MIN_OPTIONS,
            maxOptions: MAX_OPTIONS,
            questionMaxLen: QUESTION_MAX_LEN,
            optionMaxLen: OPTION_MAX_LEN,
        },
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
    return publicContext(ctx, {
        phase: 'habr-poll',
        action: ctx.slug ? 'status' : 'needs_input',
        currentQuestion,
        ready: Boolean(ctx.slug && ctx.articleExists),
        complete: isComplete(state),
        wanted: state?.wanted ?? null,
        question: state?.question || null,
        options: state?.options || [],
        multiple: state?.multiple ?? null,
        applyTarget: summarizeApplyTarget(ctx),
        limits: ctx.limits,
        articleFiles: summarizeFiles(ctx),
        next: nextStep(ctx, 'status'),
    });
}

export function createResumeResponse(ctx) {
    if (!ctx.slug) return needsSlug(ctx);
    if (!ctx.articleExists) {
        return publicContext(ctx, {
            phase: 'habr-poll',
            action: 'needs_scaffold',
            ready: false,
            complete: false,
            message: labels(ctx.language).notReady,
            next: { recommendation: labels(ctx.language).notReady },
        });
    }

    const state = ctx.existingState || buildInitialState(ctx);
    ensureStateShape(ctx, state);
    const cursor = computeCursor(state);
    const l = labels(ctx.language);
    const articleContext = buildArticleContext(ctx);
    const selectionBase = {
        wanted: state.wanted,
        question: state.question,
        options: state.options,
        multiple: state.multiple,
        applyTarget: summarizeApplyTarget(ctx),
        limits: ctx.limits,
        articleContext,
        articleFiles: summarizeFiles(ctx),
    };

    if (!cursor) {
        const applied = isComplete(state);
        const skipped = state.wanted === false;
        return publicContext(ctx, {
            phase: 'habr-poll',
            action: applied ? (skipped ? 'skipped' : 'all_done') : 'needs_apply',
            ready: true,
            complete: applied,
            cursor: null,
            ...selectionBase,
            message: applied ? (skipped ? l.skipped : l.allDone) : l.needsApply,
            next: {
                recommendation: applied
                    ? skipped
                        ? 'Nothing to do — poll was skipped.'
                        : 'Nothing to do — poll block is already applied.'
                    : 'Run poll-apply.mjs to insert the poll markdown block.',
            },
        });
    }

    const phaseMap = {
        decision: {
            action: 'needs_decision',
            id: 'decision',
            kind: 'choice',
            question: l.askDecision,
            instructions: [
                'Ask whether an in-article Habr poll is useful for engagement.',
                'Skip when the article does not benefit from a poll.',
                'Save with poll-answer.mjs --field decision --value yes|no.',
            ],
        },
        question: {
            action: 'needs_question',
            id: 'question',
            kind: 'text',
            question: l.askQuestion,
            instructions: [
                'Propose one clear poll question grounded in articleContext.',
                `Max length ${QUESTION_MAX_LEN}.`,
                'Save with poll-answer.mjs --field question --value "…".',
            ],
        },
        options: {
            action: 'needs_options',
            id: 'options',
            kind: 'multi_choice',
            question: l.askOptions,
            instructions: [
                `Propose ${MIN_OPTIONS}–${MAX_OPTIONS} short mutually exclusive options.`,
                'Save with poll-answer.mjs --field options --value "A, B, C".',
            ],
        },
        multiple: {
            action: 'needs_multiple',
            id: 'multiple',
            kind: 'choice',
            question: l.askMultiple,
            instructions: [
                'Default to single-choice (no) unless the question clearly needs multi-select.',
                'Save with poll-answer.mjs --field multiple --value yes|no.',
                'Habr attaches polls only at the end of the article; poll-apply appends to act-3-*.md.',
            ],
        },
    };

    const step = phaseMap[cursor.phase];
    return publicContext(ctx, {
        phase: 'habr-poll',
        action: step.action,
        ready: true,
        complete: false,
        cursor,
        ...selectionBase,
        currentQuestion: {
            id: step.id,
            kind: step.kind,
            question: step.question,
        },
        instructions: step.instructions,
    });
}

export function saveAnswer(ctx, opts) {
    if (!ctx.slug) return needsSlug(ctx);
    if (!ctx.articleExists) {
        return publicContext(ctx, {
            phase: 'habr-poll',
            action: 'needs_scaffold',
            ready: false,
            complete: false,
            message: labels(ctx.language).notReady,
        });
    }
    if (!opts.field) {
        throw new Error(
            '--field is required for poll-answer.mjs (decision | question | options | multiple)',
        );
    }
    if (opts.value == null) throw new Error('--value is required for poll-answer.mjs');

    const state = ctx.existingState || buildInitialState(ctx);
    ensureStateShape(ctx, state);

    if (opts.field === 'decision') {
        state.wanted = parseYesNo(opts.value);
        if (state.wanted === false) {
            state.question = null;
            state.options = [];
            state.multiple = null;
            state.appliedAt = new Date().toISOString();
        } else {
            state.appliedAt = null;
        }
    } else if (opts.field === 'question') {
        const question = String(opts.value).trim();
        if (!question) throw new Error('Question must be non-empty.');
        if (question.length > QUESTION_MAX_LEN) {
            throw new Error(`Question too long: ${question.length}. Maximum is ${QUESTION_MAX_LEN}.`);
        }
        state.question = question;
        state.wanted = true;
        state.appliedAt = null;
    } else if (opts.field === 'options') {
        const options = splitList(opts.value);
        if (options.length < MIN_OPTIONS) {
            throw new Error(`Need at least ${MIN_OPTIONS} options (got ${options.length}).`);
        }
        if (options.length > MAX_OPTIONS) {
            throw new Error(`Too many options: ${options.length}. Maximum is ${MAX_OPTIONS}.`);
        }
        for (const opt of options) {
            if (opt.length > OPTION_MAX_LEN) {
                throw new Error(`Option too long (${opt.length}): "${opt.slice(0, 40)}…". Max ${OPTION_MAX_LEN}.`);
            }
        }
        const unique = [];
        for (const opt of options) {
            if (!unique.some((u) => u.toLowerCase() === opt.toLowerCase())) unique.push(opt);
        }
        state.options = unique;
        state.wanted = true;
        state.appliedAt = null;
    } else if (opts.field === 'multiple') {
        state.multiple = parseYesNo(opts.value);
        state.wanted = true;
        state.appliedAt = null;
    } else {
        throw new Error(`Unknown field: ${opts.field}`);
    }

    state.updatedAt = new Date().toISOString();
    state.cursor = computeCursor(state);

    const actions = [];
    if (opts.dryRun) {
        actions.push({ path: rel(ctx.target, ctx.statePath), status: 'would-write' });
    } else {
        mkdirSync(ctx.pollDir, { recursive: true });
        writeJson(ctx.statePath, state);
        actions.push({ path: rel(ctx.target, ctx.statePath), status: 'written' });
    }

    return publicContext(ctx, {
        phase: 'habr-poll',
        action: opts.dryRun ? 'dry_run' : 'saved',
        ready: true,
        complete: isComplete(state),
        field: opts.field,
        wanted: state.wanted,
        question: state.question,
        options: state.options,
        multiple: state.multiple,
        applyTarget: summarizeApplyTarget(ctx),
        cursor: state.cursor,
        actions,
    });
}

export function applyPoll(ctx, opts) {
    if (!ctx.slug) return needsSlug(ctx);
    if (!ctx.articleExists) {
        return publicContext(ctx, {
            phase: 'habr-poll',
            action: 'needs_scaffold',
            ready: false,
            complete: false,
            message: labels(ctx.language).notReady,
        });
    }

    const state = ctx.existingState;
    if (!state) throw new Error('No poll state found. Run poll-resume and poll-answer first.');
    ensureStateShape(ctx, state);

    if (state.wanted === false) {
        const now = new Date().toISOString();
        state.updatedAt = now;
        state.appliedAt = now;
        state.cursor = null;
        const actions = [];
        if (!opts.dryRun) {
            mkdirSync(ctx.pollDir, { recursive: true });
            writeJson(ctx.statePath, state);
            actions.push({ path: rel(ctx.target, ctx.statePath), status: 'written' });
        }
        return publicContext(ctx, {
            phase: 'habr-poll',
            action: opts.dryRun ? 'dry_run' : 'skipped',
            ready: true,
            complete: true,
            wanted: false,
            message: labels(ctx.language).skipped,
            actions,
            conflicts: [],
        });
    }

    if (!state.question || state.options.length < MIN_OPTIONS || state.multiple == null) {
        throw new Error('Poll is incomplete. Finish poll-answer steps first.');
    }

    const targetPath = resolveEndOfArticlePath(ctx);
    const existingMarker = findPollMarkerInArticle(ctx);
    const targetOriginal = readFileSync(targetPath, 'utf8');
    const nextContent = appendPollBlock(removePollBlock(targetOriginal), state, ctx.language);
    const hasExistingMarker = Boolean(existingMarker);
    const needsMove = existingMarker && existingMarker.path !== targetPath;
    const wouldChange = nextContent !== targetOriginal || needsMove;
    const hasConflict = hasExistingMarker && wouldChange && !opts.force;

    if (hasConflict) {
        const suggestionPath = `${targetPath}.new`;
        const actions = [
            {
                path: rel(ctx.target, suggestionPath),
                status: opts.dryRun ? 'would-write-suggestion' : 'suggestion-written',
                conflict: true,
            },
        ];
        if (!opts.dryRun) {
            writeFileSync(suggestionPath, nextContent, 'utf8');
            const now = new Date().toISOString();
            state.updatedAt = now;
            state.appliedAt = now;
            state.cursor = null;
            mkdirSync(ctx.pollDir, { recursive: true });
            writeJson(ctx.statePath, state);
            actions.push({ path: rel(ctx.target, ctx.statePath), status: 'written', conflict: false });
        }
        const conflicts = [rel(ctx.target, targetPath)];
        if (needsMove) conflicts.unshift(rel(ctx.target, existingMarker.path));
        return publicContext(ctx, {
            phase: 'habr-poll',
            action: opts.dryRun ? 'dry_run' : 'applied',
            ready: true,
            complete: isComplete(state),
            force: opts.force,
            dryRun: opts.dryRun,
            wanted: state.wanted,
            question: state.question,
            options: state.options,
            multiple: state.multiple,
            applyTarget: summarizeApplyTarget(ctx),
            actions,
            conflicts,
        });
    }

    const actions = [];
    if (!opts.dryRun && needsMove && opts.force) {
        writeFileSync(existingMarker.path, removePollBlock(existingMarker.text), 'utf8');
        actions.push({
            path: rel(ctx.target, existingMarker.path),
            status: 'written',
            conflict: false,
        });
    }

    const unchanged = nextContent === targetOriginal && !needsMove;
    if (unchanged) {
        actions.push({ path: rel(ctx.target, targetPath), status: 'unchanged', conflict: false });
    } else {
        actions.push({
            path: rel(ctx.target, targetPath),
            status: opts.dryRun ? 'would-write' : 'written',
            conflict: false,
        });
    }

    if (!opts.dryRun) {
        if (!unchanged || needsMove) writeFileSync(targetPath, nextContent, 'utf8');
        const now = new Date().toISOString();
        state.updatedAt = now;
        state.appliedAt = now;
        state.cursor = null;
        mkdirSync(ctx.pollDir, { recursive: true });
        writeJson(ctx.statePath, state);
        actions.push({ path: rel(ctx.target, ctx.statePath), status: 'written', conflict: false });
    }

    return publicContext(ctx, {
        phase: 'habr-poll',
        action: opts.dryRun ? 'dry_run' : 'applied',
        ready: true,
        complete: isComplete(state),
        force: opts.force,
        dryRun: opts.dryRun,
        wanted: state.wanted,
        question: state.question,
        options: state.options,
        multiple: state.multiple,
        applyTarget: summarizeApplyTarget(ctx),
        actions,
        conflicts: [],
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
    const lines = [`Article habr-poll: ${result.slug || 'slug required'}`, `Status: ${result.action}`];
    if (result.currentQuestion) lines.push(`Question: ${result.currentQuestion.question}`);
    lines.push(`Wanted: ${result.wanted == null ? '—' : result.wanted}`);
    lines.push(`Poll Q: ${result.question || '—'}`);
    lines.push(`Options (${result.options?.length || 0}): ${(result.options || []).join(' | ') || '—'}`);
    lines.push(`Multiple: ${result.multiple == null ? '—' : result.multiple}`);
    lines.push(`Apply target: ${formatApplyTarget(result.applyTarget)}`);
    if (result.next?.recommendation) lines.push(`Next: ${result.next.recommendation}`);
    return lines.join('\n');
}

export function formatResumeHuman(result) {
    const lines = [`Article habr-poll resume: ${result.slug || 'slug required'}`, `Action: ${result.action}`];
    if (result.cursor) lines.push(`Cursor: ${result.cursor.phase}`);
    if (result.message) lines.push(result.message);
    if (result.next?.recommendation) lines.push(`Next: ${result.next.recommendation}`);
    return lines.join('\n');
}

export function formatAnswerHuman(result) {
    const lines = [`Article habr-poll answer: ${result.slug || 'slug required'}`, `Action: ${result.action}`];
    lines.push(`Field: ${result.field}`);
    if (result.field === 'decision') lines.push(`Wanted: ${result.wanted}`);
    if (result.field === 'question') lines.push(`Question: ${result.question}`);
    if (result.field === 'options') lines.push(`Options: ${(result.options || []).join(' | ')}`);
    if (result.field === 'multiple') lines.push(`Multiple: ${result.multiple}`);
    for (const action of result.actions || []) lines.push(`- ${action.status}: ${action.path}`);
    return lines.join('\n');
}

export function formatApplyHuman(result) {
    const lines = [`Article habr-poll apply: ${result.slug || 'slug required'}`, `Action: ${result.action}`];
    if (result.message) lines.push(result.message);
    for (const action of result.actions || []) lines.push(`- ${action.status}: ${action.path}`);
    if (result.conflicts?.length) {
        lines.push(`Conflicts (use --force to overwrite): ${result.conflicts.join(', ')}`);
    }
    return lines.join('\n');
}

function needsSlug(ctx) {
    return publicContext(ctx, {
        phase: 'habr-poll',
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
        wanted: null,
        question: null,
        options: [],
        multiple: null,
        cursor: { phase: 'decision' },
        appliedAt: null,
    };
}

function ensureStateShape(ctx, state) {
    if (!Array.isArray(state.options)) state.options = [];
    if (state.wanted === undefined) state.wanted = null;
    if (state.question === undefined) state.question = null;
    if (state.multiple === undefined) state.multiple = null;
    delete state.placement;
    state.slug = state.slug || ctx.slug;
    state.title = state.title || ctx.title;
    state.language = normalizeLanguage(state.language || ctx.language);
    state.articleDir = state.articleDir || ctx.slug;
    state.$schema = state.$schema || STATE_SCHEMA_URL;
    state.schemaVersion = state.schemaVersion || STATE_SCHEMA_VERSION;
    state.version = state.version || STATE_VERSION;
    state.generatedBy = state.generatedBy || SKILL_NAME;
    state.createdAt = state.createdAt || new Date().toISOString();
    if (state.appliedAt === undefined) state.appliedAt = null;
    state.cursor = computeCursor(state);
}

function computeCursor(state) {
    if (state.wanted === false && state.appliedAt) return null;
    if (state.wanted == null) return { phase: 'decision' };
    if (state.wanted === false) return null;
    if (!state.question) return { phase: 'question' };
    if (!Array.isArray(state.options) || state.options.length < MIN_OPTIONS) return { phase: 'options' };
    if (state.multiple == null) return { phase: 'multiple' };
    return null;
}

function isComplete(state) {
    if (!state) return false;
    if (state.wanted === false) return Boolean(state.appliedAt);
    return (
        Boolean(state.appliedAt) &&
        state.wanted === true &&
        Boolean(state.question) &&
        Array.isArray(state.options) &&
        state.options.length >= MIN_OPTIONS &&
        state.multiple != null
    );
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
              }
            : null,
    };
}

function discoverArticleFiles(articleDir) {
    const names = readdirSync(articleDir);
    const leadPath = join(articleDir, 'lead.md');
    const act1 = names.find((n) => /^act-1.*\.md$/i.test(n));
    const act2 = names.find((n) => /^act-2.*\.md$/i.test(n));
    const act3 = names.find((n) => /^act-3.*\.md$/i.test(n));
    return {
        leadPath: existsSync(leadPath) ? leadPath : null,
        act1Path: act1 ? join(articleDir, act1) : null,
        act2Path: act2 ? join(articleDir, act2) : null,
        act3Path: act3 ? join(articleDir, act3) : null,
        act1Name: act1 || null,
        act2Name: act2 || null,
        act3Name: act3 || null,
    };
}

function summarizeFiles(ctx) {
    if (!ctx.files) return null;
    return {
        lead: ctx.files.leadPath ? rel(ctx.target, ctx.files.leadPath) : null,
        act1: ctx.files.act1Path ? rel(ctx.target, ctx.files.act1Path) : null,
        act2: ctx.files.act2Path ? rel(ctx.target, ctx.files.act2Path) : null,
        act3: ctx.files.act3Path ? rel(ctx.target, ctx.files.act3Path) : null,
    };
}

function summarizeApplyTarget(ctx) {
    const path = ctx.files?.act3Path;
    return {
        constraint: 'habr-end-of-article',
        file: path ? rel(ctx.target, path) : null,
        act3Name: ctx.files?.act3Name || null,
        note: 'Habr attaches polls only at the end of the article; poll-apply appends to act-3-*.md.',
    };
}

function formatApplyTarget(applyTarget) {
    if (!applyTarget?.file) return 'act-3 (end of article)';
    return `${applyTarget.file} (end of article)`;
}

function articleFilePaths(ctx) {
    if (!ctx.files) return [];
    return [ctx.files.leadPath, ctx.files.act1Path, ctx.files.act2Path, ctx.files.act3Path].filter(Boolean);
}

function resolveEndOfArticlePath(ctx) {
    const path = ctx.files?.act3Path;
    if (!path || !existsSync(path)) {
        throw new Error(
            'Act 3 file not found. Habr polls go at the end of the article — draft act-3-*.md first.',
        );
    }
    return path;
}

function findPollMarkerInArticle(ctx) {
    for (const path of articleFilePaths(ctx)) {
        const text = readFileSync(path, 'utf8');
        if (text.includes(POLL_MARKER_START)) {
            return { path, text };
        }
    }
    return null;
}

function removePollBlock(text) {
    if (!text.includes(POLL_MARKER_START)) return text;
    const start = text.indexOf(POLL_MARKER_START);
    const end = text.indexOf(POLL_MARKER_END);
    if (end === -1) throw new Error('Broken poll marker: start without end.');
    const endIdx = end + POLL_MARKER_END.length;
    return `${text.slice(0, start).replace(/\n+$/, '')}${text.slice(endIdx).replace(/^\n+/, '\n')}`.replace(
        /\n{3,}/g,
        '\n\n',
    ).trimEnd() + '\n';
}

function appendPollBlock(text, state, language) {
    const block = renderPollBlock(state, language);
    const trimmed = text.replace(/\s+$/, '');
    return `${trimmed}\n\n${block}\n`;
}

function renderPollBlock(state, language) {
    const lang = normalizeLanguage(language);
    const heading = lang === 'en' ? 'Poll' : 'Опрос';
    const multiNote =
        state.multiple === true
            ? lang === 'en'
                ? '_Multiple answers. Habr attaches polls only at the end of the article — recreate in the editor._'
                : '_Можно выбрать несколько ответов. На Habr опрос только в конце статьи — перенеси в редактор._'
            : lang === 'en'
              ? '_Single choice. Habr attaches polls only at the end of the article — recreate in the editor._'
              : '_Один ответ. На Habr опрос только в конце статьи — перенеси в редактор._';
    const options = state.options.map((opt) => `> - [ ] ${opt}`).join('\n');
    return [
        POLL_MARKER_START,
        `> **${heading}:** ${state.question}`,
        '>',
        options,
        '>',
        `> ${multiNote}`,
        POLL_MARKER_END,
    ].join('\n');
}

function parseYesNo(value) {
    const raw = String(value).trim().toLowerCase();
    if (['yes', 'y', 'true', '1', 'да', 'д'].includes(raw)) return true;
    if (['no', 'n', 'false', '0', 'нет', 'н'].includes(raw)) return false;
    throw new Error(`Expected yes/no (got: ${value})`);
}

function splitList(value) {
    return String(value)
        .split(/[,;\n]/)
        .map((part) => part.trim())
        .filter((part) => part.length > 0);
}

function nextStep(ctx, action) {
    if (!ctx.slug) return { recommendation: 'Provide article slug.' };
    if (!ctx.articleExists) return { recommendation: labels(ctx.language).notReady };
    if (action === 'status') {
        return { recommendation: 'Run poll-resume.mjs to start or continue the poll dialogue.' };
    }
    return { recommendation: 'Run poll-answer.mjs, then poll-apply.mjs when ready.' };
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

function discoverPollStates(pollDir) {
    if (!existsSync(pollDir)) return [];
    return readdirSync(pollDir)
        .filter((name) => name.endsWith('.json'))
        .map((name) => {
            const path = join(pollDir, name);
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

function resolveSlug({ explicitSlug, threadTitle, target, discoveredStates, discoveredPollStates }) {
    if (explicitSlug) return { slug: explicitSlug, source: 'argument' };
    const threadSlug = normalizeSlug(threadTitle);
    if (threadSlug) {
        const hasState = discoveredStates.some((s) => s.slug === threadSlug);
        const hasPoll = (discoveredPollStates || []).some((s) => s.slug === threadSlug);
        const hasFolder = existsSync(join(target, threadSlug));
        if (hasState || hasPoll || hasFolder) return { slug: threadSlug, source: 'thread-title' };
    }
    const cwdSlug = normalizeSlug(basename(process.cwd()));
    if (cwdSlug) {
        const hasState = discoveredStates.some((s) => s.slug === cwdSlug);
        const hasPoll = (discoveredPollStates || []).some((s) => s.slug === cwdSlug);
        const hasFolder = existsSync(join(target, cwdSlug)) && cwdSlug !== basename(target);
        if (hasState || hasPoll || hasFolder) return { slug: cwdSlug, source: 'cwd' };
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

function writeJson(path, value) {
    writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function readTitleFromIndex(indexPath) {
    if (!existsSync(indexPath)) return null;
    const text = readFileSync(indexPath, 'utf8');
    const heading = text.match(/^#\s+(.+)$/m);
    return heading ? heading[1].trim() : null;
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
    if (!['decision', 'question', 'options', 'multiple'].includes(field)) {
        throw new Error(
            `--field must be one of decision, question, options, multiple (got: ${value})`,
        );
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

function rel(root, path) {
    if (!path) return null;
    const value = relative(root, path);
    return value && !value.startsWith('..') ? value : path;
}
