import {
    existsSync,
    mkdirSync,
    readdirSync,
    readFileSync,
    writeFileSync,
} from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const SKILL_NAME = 'article-structure';
export const STATE_SCHEMA_VERSION = 1;
export const STATE_VERSION = 1;
export const STATE_SCHEMA_URL =
    'https://raw.githubusercontent.com/sergeychernov/article-writing-kit/main/skills/article-structure/assets/schemas/structure-state.schema.json';

export const STRUCTURE_MARKER_START = '<!-- article-kit:structure:start -->';
export const STRUCTURE_MARKER_END = '<!-- article-kit:structure:end -->';

const ACT_KEYS = ['act1', 'act2', 'act3'];
const HEADING_PREFIX = { h2: '## ', h3: '### ' };
const HEADING_LEVELS = ['h2', 'h3'];
const ALLOWED_LEVELS = ['h2', 'h3', 'callout'];
const CALLOUT_RE = /^>\s*\[!([^\]]+)\]\s*(-?)\s*(.*)$/;
const PREVIEW_LEN = 200;

const TEXT = {
    ru: {
        slugQuestion: 'Какой slug статьи структурируем?',
        structureTitle: 'Структура заголовков',
        act1: 'Акт 1',
        act2: 'Акт 2',
        act3: 'Акт 3',
        chunk: 'Кусок',
        level: 'Уровень',
        heading: 'Заголовок',
        lines: 'Строки',
        none: 'нет',
        anchor: 'Текст начинается с',
        anchorHeading: 'Текст, перед которым добавится заголовок',
        anchorChunk: 'Границы куска проходят по тексту',
        askChunking: 'Предложи логическую разбивку этого акта на куски и спроси подтверждение границ.',
        askHeading: 'Предложи 2-3 варианта заголовка для куска разного уровня (H2/H3) и спроси выбор.',
        proposalQuestion: 'Открытый вопрос',
        proposalQuestionDesc: 'заголовок в форме вопроса, который ставит проблему',
        proposalIrony: 'Ироничный',
        proposalIronyDesc: 'заголовок с лёгкой иронией/парадоксом',
        proposalPlain: 'Простой формальный',
        proposalPlainDesc: 'сухой описательный заголовок',
        chunksPlanned: 'Разбивка акта готова — переходи к заголовкам кусков.',
        actDone: 'Все куски акта размечены.',
        allDone: 'Все акты размечены. Запусти structure-apply.mjs.',
        noSegments: 'В акте нет текста для разбивки. Сначала напиши черновик акта.',
        notReady: 'Сначала заверши article-scaffold и напиши черновики act-*.md файлов.',
    },
    en: {
        slugQuestion: 'Which article slug are we structuring?',
        structureTitle: 'Heading Structure',
        act1: 'Act 1',
        act2: 'Act 2',
        act3: 'Act 3',
        chunk: 'Chunk',
        level: 'Level',
        heading: 'Heading',
        lines: 'Lines',
        none: 'none',
        anchor: 'Text begins with',
        anchorHeading: 'Text the heading will be inserted before',
        anchorChunk: 'Chunk boundary falls in the text',
        askChunking: 'Propose a logical chunking of this act and ask the user to confirm boundaries.',
        askHeading: 'Propose 2-3 heading variants of different levels (H2/H3) for the chunk and ask the user to pick.',
        proposalQuestion: 'Open question',
        proposalQuestionDesc: 'a heading phrased as a question that frames the problem',
        proposalIrony: 'Ironic',
        proposalIronyDesc: 'a heading with light irony or paradox',
        proposalPlain: 'Plain formal',
        proposalPlainDesc: 'a dry descriptive heading',
        chunksPlanned: 'Act chunking is ready — proceed to per-chunk headings.',
        actDone: 'All chunks of the act are labelled.',
        allDone: 'All acts are labelled. Run structure-apply.mjs.',
        noSegments: 'The act has no text to chunk. Draft the act first.',
        notReady: 'Run article-scaffold and draft the act-*.md files first.',
    },
};

export function parseArgs(argv = process.argv.slice(2)) {
    const opts = {
        target: '.',
        slug: null,
        threadTitle: null,
        language: null,
        act: null,
        chunk: null,
        startLine: null,
        endLine: null,
        preview: null,
        level: null,
        text: null,
        skipHeading: false,
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
        } else if (arg === '--skip-heading') {
            opts.skipHeading = true;
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
        } else if (arg === '--act') {
            opts.act = normalizeActKey(requireValue(argv, (i += 1), arg));
        } else if (arg === '--chunk') {
            opts.chunk = requireValue(argv, (i += 1), arg);
        } else if (arg === '--start-line') {
            opts.startLine = parseLine(requireValue(argv, (i += 1), arg), arg);
        } else if (arg === '--end-line') {
            opts.endLine = parseLine(requireValue(argv, (i += 1), arg), arg);
        } else if (arg === '--preview') {
            opts.preview = requireValue(argv, (i += 1), arg);
        } else if (arg === '--level') {
            opts.level = normalizeLevel(requireValue(argv, (i += 1), arg));
        } else if (arg === '--text') {
            opts.text = requireValue(argv, (i += 1), arg);
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
        'structure-status.mjs': '',
        'structure-resume.mjs': ' [--new]',
        'structure-prepare.mjs': '',
        'structure-answer.mjs':
            ' --act <act1|act2|act3> --chunk <id> [--start-line N --end-line M --preview <text>] [--level <h2|h3|callout> --text <heading> | --text <callout-title> | --skip-heading]',
        'structure-apply.mjs': ' [--act <act1|act2|act3>] [--force] [--dry-run]',
    }[command];

    console.log(`Usage:
  node <SKILL_DIR>/scripts/${command} [--target <path>] [--slug <slug>] [--thread-title <title>]${extra} [--json]

Flags:
  --target <path>     Article workspace root; default is current working directory
  --slug <slug>       Article folder name; unsafe characters are normalized
  --thread-title <t>  Current IDE thread/chat title; used to recover an article slug
  --chat-title <t>    Alias for --thread-title
  --language ru|en    Output language when scaffold state cannot provide it
  --new               (resume) ignore saved structure state and start over
  --act <key>         (answer) act1 | act2 | act3
  --chunk <id>        (answer) chunk id, for example c1
  --start-line <N>    (answer) first line of the chunk in the act file
  --end-line <M>      (answer) last line of the chunk in the act file
  --preview <text>    (answer) short preview of the chunk content
  --level <h2|h3|callout>  (answer) chosen heading level; "callout" is auto-allowed for callout chunks and may be omitted when --text is given
  --text <heading>    (answer) chosen heading text
  --skip-heading      (answer) register the chunk without a heading
  --act <key>         (apply) scope the apply to a single act (act1 | act2 | act3)
  --force             (apply) overwrite existing headings in act files, or re-apply an already-applied act
  --dry-run           Show intended changes without writing files
  --json              Print machine-readable JSON
  --help              Show this help
`);
}

export function buildContext(opts = {}) {
    const target = resolve(process.cwd(), opts.target || '.');
    const scaffoldDir = join(target, '.article-kit', 'scaffold');
    const structureDir = join(target, '.article-kit', 'structure');
    const discoveredStates = discoverScaffoldStates(scaffoldDir);
    const slugInfo = resolveSlug({
        explicitSlug: opts.slug,
        threadTitle: opts.threadTitle,
        target,
        discoveredStates,
    });
    const slug = slugInfo.slug;
    const scaffoldStatePath = slug ? join(scaffoldDir, `${slug}.json`) : null;
    const scaffoldState = scaffoldStatePath ? readJson(scaffoldStatePath) : null;
    const articleDir = slug ? join(target, slug) : null;
    const articleExists = articleDir ? existsSync(articleDir) : false;
    const outlinePath = articleDir ? join(articleDir, 'three-act-outline.md') : null;
    const outline = outlinePath && existsSync(outlinePath) ? readFileSync(outlinePath, 'utf8') : null;
    const statePath = slug ? join(structureDir, `${slug}.json`) : null;
    const existingState = statePath ? readJson(statePath) : null;
    const title =
        stringOrNull(scaffoldState?.title) ||
        (articleDir ? readTitleFromIndex(join(articleDir, 'index.md')) : null) ||
        slug;
    const language = normalizeLanguage(opts.language || scaffoldState?.language || existingState?.language || 'ru');
    const actFiles = resolveActFiles({ slug, scaffoldState, articleDir });
    const actContents = readActContents(actFiles);

    return {
        skill: SKILL_NAME,
        stateSchema: STATE_SCHEMA_URL,
        stateSchemaVersion: STATE_SCHEMA_VERSION,
        target,
        scaffoldDir,
        structureDir,
        discoveredStates,
        slug,
        slugSource: slugInfo.source,
        suggestedThreadTitle: slug,
        title,
        language,
        articleDir,
        articleExists,
        outlinePath,
        outline,
        scaffoldStatePath,
        scaffoldState,
        scaffoldStatus: scaffoldState?.status || null,
        actFiles,
        actContents,
        statePath,
        existingState,
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

    const actStatus = ACT_KEYS.map((key) => {
        const file = ctx.actFiles[key];
        const content = ctx.actContents[key];
        const segments = content ? segmentize(content.text) : [];
        return {
            key,
            file: file ? rel(ctx.target, file) : null,
            exists: Boolean(file),
            ready: segments.length > 0,
            segmentCount: segments.length,
            existingHeadingCount: content ? countHeadings(content.text) : 0,
        };
    });

    return publicContext(ctx, {
        phase: 'structure',
        action: ctx.slug ? 'status' : 'needs_input',
        currentQuestion,
        ready: Boolean(ctx.slug && ctx.articleExists && actStatus.some((a) => a.ready)),
        complete: isStructureComplete(ctx.existingState),
        acts: actStatus,
        files: fileStatus(ctx),
        next: nextStep(ctx, 'status'),
    });
}

export function createPrepareResponse(ctx) {
    if (!ctx.slug) {
        return needsSlug(ctx);
    }
    if (!ctx.articleExists) {
        return publicContext(ctx, {
            phase: 'structure',
            action: 'needs_scaffold',
            ready: false,
            complete: false,
            message: labels(ctx.language).notReady,
            files: fileStatus(ctx),
        });
    }

    const acts = {};
    for (const key of ACT_KEYS) {
        const file = ctx.actFiles[key];
        const content = ctx.actContents[key];
        acts[key] = {
            file: file ? rel(ctx.target, file) : null,
            exists: Boolean(file),
            ready: Boolean(content && segmentize(content.text).length > 0),
            segments: content ? segmentize(content.text) : [],
        };
    }

    return publicContext(ctx, {
        phase: 'structure',
        action: 'prepare_structure',
        ready: Object.values(acts).some((a) => a.ready),
        complete: isStructureComplete(ctx.existingState),
        files: fileStatus(ctx),
        acts,
        outputContract: structureOutputContract(),
        existingState: ctx.existingState
            ? {
                  actsOrder: ctx.existingState.actsOrder || ACT_KEYS,
                  acts: ctx.existingState.acts || null,
                  cursor: ctx.existingState.cursor || null,
                  appliedAt: ctx.existingState.appliedAt || null,
              }
            : null,
        instructions: [
            'For each act, group raw segments into logical chunks and confirm boundaries with the user.',
            'For each chunk propose exactly 6 heading variants in three styles: 2 open questions, 2 ironic, 2 plain formal — each at an allowed level (H2 first; H3 only after an H2).',
            'Use allowedLevels and proposalStyle returned by structure-resume.mjs for each chunk; never propose a level outside allowedLevels.',
            'After each act is fully labelled, run structure-apply.mjs --act <key> to write headings and sync the outline.',
            'Do not edit act files or three-act-outline.md directly; let structure-apply.mjs perform the writes.',
        ],
    });
}

export function createResumeResponse(ctx) {
    if (!ctx.slug) {
        return needsSlug(ctx);
    }
    if (!ctx.articleExists) {
        return publicContext(ctx, {
            phase: 'structure',
            action: 'needs_scaffold',
            ready: false,
            complete: false,
            message: labels(ctx.language).notReady,
            files: fileStatus(ctx),
        });
    }

    const state = ctx.existingState || buildInitialState(ctx);
    const cursor = computeCursor(ctx, state);
    const l = labels(ctx.language);
    const pendingApplyActs = ACT_KEYS.filter(
        (k) => state.acts[k] && isActLabelledComplete(state.acts[k]) && !state.acts[k].appliedAt
    );
    const appliedActs = ACT_KEYS.filter((k) => state.acts[k]?.appliedAt);

    if (!cursor) {
        const recommendation = pendingApplyActs.length
            ? `Run structure-apply.mjs --act ${pendingApplyActs[0]} to write that act's headings, then repeat for any remaining acts.`
            : 'All acts are already applied. Outline is synced.';
        return publicContext(ctx, {
            phase: 'structure',
            action: 'all_done',
            ready: true,
            complete: isStructureComplete(state) && appliedActs.length === ACT_KEYS.length,
            files: fileStatus(ctx),
            cursor: null,
            pendingApplyActs,
            appliedActs,
            message: l.allDone,
            next: { recommendation },
        });
    }

    const act = state.acts[cursor.actId];
    const responseBase = {
        phase: 'structure',
        action: cursor.phase === 'chunking' ? 'needs_chunking' : 'needs_heading',
        ready: true,
        complete: false,
        files: fileStatus(ctx),
        cursor,
        actId: cursor.actId,
        actLabel: actLabel(cursor.actId, l),
        pendingApplyActs,
        appliedActs,
        instructions:
            cursor.phase === 'chunking'
                ? [l.askChunking]
                : [l.askHeading],
    };

    if (cursor.phase === 'chunking') {
        return publicContext(ctx, {
            ...responseBase,
            act: {
                file: act.file ? rel(ctx.target, resolve(ctx.articleDir, act.file)) : null,
                exists: act.exists,
                ready: act.ready,
                segments: act.segments.map((s) => ({ ...s })),
                existingChunks: act.chunks.map((c) => ({ ...c })),
            },
            anchor: act.segments[0]?.preview || '',
            currentQuestion: {
                id: 'chunking',
                kind: 'confirm',
                question: chunkingQuestion(ctx, cursor.actId, l),
            },
            presentation: {
                identifyChunksBy: 'preview',
                note: 'Show segment previews to the user, not line numbers. Line numbers are internal and only used when calling structure-answer.mjs.',
            },
        });
    }

    const chunk = act.chunks.find((c) => c.id === cursor.chunkId);
    const tree = headingTreeState(act, chunk?.id);
    const callout = chunkCalloutInfo(ctx, cursor.actId, chunk);
    const allowedLevels = callout ? ['callout'] : allowedLevelsFor(act, chunk?.id);
    const proposalStyle = headingProposalStyle(l);
    const calloutInfo = callout
        ? { type: callout.type, fold: callout.fold, hasTitle: Boolean(callout.title) }
        : null;
    const baseNote = callout
        ? `This chunk is an Obsidian callout (!${callout.type}). Propose 6 variants as callout title text (no ## prefix); apply will write \`> [!${callout.type}] <title>\`. ${callout.title ? 'The callout already has a title — it will be replaced only with --force.' : ''}`
        : (tree.hasH2
              ? 'Propose H2 (next sibling section) or H3 (subsection nesting under currentSection). '
              : 'This is the first heading of the act — propose only H2. H3 is allowed only after an H2 has been placed. ') +
          'Always propose exactly 6 variants following proposalStyle: 2 open questions, 2 ironic, 2 plain formal — each at a level from allowedLevels.';
    return publicContext(ctx, {
        ...responseBase,
        chunk,
        anchor: chunk?.preview || '',
        allowedLevels,
        currentSection: tree.currentH2,
        hasH2: tree.hasH2,
        callout: calloutInfo,
        proposalStyle,
        currentQuestion: {
            id: 'heading',
            kind: 'choice',
            question: headingQuestion(chunk, l, calloutInfo),
        },
        presentation: {
            identifyChunksBy: 'preview',
            allowedLevels,
            currentSection: tree.currentH2,
            callout: calloutInfo,
            proposalStyle,
            note: baseNote,
        },
    });
}

export function saveAnswer(ctx, opts) {
    if (!ctx.slug) return needsSlug(ctx);
    if (!ctx.articleExists) {
        return publicContext(ctx, {
            phase: 'structure',
            action: 'needs_scaffold',
            ready: false,
            complete: false,
            message: labels(ctx.language).notReady,
            files: fileStatus(ctx),
        });
    }
    if (!opts.act) throw new Error('--act is required for structure-answer.mjs');
    if (!opts.chunk) throw new Error('--chunk is required for structure-answer.mjs');

    const state = ctx.existingState || buildInitialState(ctx);
    ensureStateActs(ctx, state);
    const act = state.acts[opts.act];

    if (opts.startLine != null && opts.endLine != null) {
        if (opts.endLine < opts.startLine) {
            throw new Error(`--end-line must be greater than or equal to --start-line for chunk ${opts.chunk}`);
        }
        const preview = stringOrNull(opts.preview) || previewFromRange(ctx, opts.act, opts.startLine, opts.endLine);
        const existing = act.chunks.find((c) => c.id === opts.chunk);
        if (existing) {
            existing.startLine = opts.startLine;
            existing.endLine = opts.endLine;
            existing.preview = preview;
        } else {
            act.chunks.push({
                id: opts.chunk,
                startLine: opts.startLine,
                endLine: opts.endLine,
                preview,
                heading: null,
            });
        }
    }

    const chunk = act.chunks.find((c) => c.id === opts.chunk);
    if (!chunk) {
        throw new Error(
            `Chunk ${opts.chunk} not found in ${opts.act}. Provide --start-line and --end-line to register it first.`
        );
    }

    let changed = false;
    if (opts.skipHeading) {
        if (chunk.heading !== null) changed = true;
        chunk.heading = null;
    } else if (opts.level && opts.text) {
        const callout = chunkCalloutInfo(ctx, opts.act, chunk);
        const allowed = callout ? ['callout'] : allowedLevelsFor(act, chunk.id);
        if (!allowed.includes(opts.level)) {
            throw new Error(
                `Heading level ${opts.level} is not allowed here. ${callout ? 'This chunk is a callout — use level "callout" (or omit --level).' : 'The first heading in an act must be H2; H3 is only allowed after an H2 has been placed.'} Allowed: ${allowed.join(', ')}.`
            );
        }
        const prev = chunk.heading;
        const next = { level: opts.level, text: String(opts.text).trim() };
        if (!prev || prev.level !== next.level || prev.text !== next.text) changed = true;
        chunk.heading = next;
    } else if (opts.text && !opts.level) {
        const callout = chunkCalloutInfo(ctx, opts.act, chunk);
        if (!callout) {
            throw new Error('--level is required for non-callout chunks. Provide --level <h2|h3>, or use --skip-heading.');
        }
        const prev = chunk.heading;
        const next = { level: 'callout', text: String(opts.text).trim() };
        if (!prev || prev.level !== next.level || prev.text !== next.text) changed = true;
        chunk.heading = next;
    } else if (opts.level || opts.text) {
        throw new Error('Provide both --level and --text, or use --skip-heading.');
    }

    if (changed) act.appliedAt = null;

    sortChunks(act);
    state.updatedAt = new Date().toISOString();
    state.cursor = computeCursor(ctx, state);

    const actions = [];
    if (opts.dryRun) {
        actions.push({ path: rel(ctx.target, ctx.statePath), status: 'would-write' });
    } else {
        mkdirSync(ctx.structureDir, { recursive: true });
        writeJson(ctx.statePath, state);
        actions.push({ path: rel(ctx.target, ctx.statePath), status: 'written' });
    }

    return publicContext(ctx, {
        phase: 'structure',
        action: opts.dryRun ? 'dry_run' : 'saved',
        ready: true,
        complete: isStructureComplete(state),
        files: fileStatus(ctx),
        cursor: state.cursor,
        chunk,
        actions,
    });
}

export function applyStructure(ctx, opts) {
    if (!ctx.slug) return needsSlug(ctx);
    if (!ctx.articleExists) {
        return publicContext(ctx, {
            phase: 'structure',
            action: 'needs_scaffold',
            ready: false,
            complete: false,
            message: labels(ctx.language).notReady,
            files: fileStatus(ctx),
        });
    }

    const state = ctx.existingState;
    if (!state || !state.acts) {
        throw new Error('No structure state found. Run structure-prepare and structure-answer first.');
    }
    const labelled = collectLabelledChunks(state);
    if (labelled.length === 0) {
        throw new Error('No labelled chunks in state. Run structure-answer with --level and --text first.');
    }

    const actions = [];
    const conflicts = [];

    const targetActs = opts.act ? [opts.act] : ACT_KEYS;

    for (const key of targetActs) {
        const act = state.acts[key];
        const file = ctx.actFiles[key];
        if (!file || !act) continue;
        const content = ctx.actContents[key];
        if (!content) continue;

        const chunks = act.chunks.filter((c) => c.heading);
        if (chunks.length === 0) continue;

        if (act.appliedAt && !opts.force) {
            actions.push({
                act: key,
                path: rel(ctx.target, file),
                status: 'skipped-already-applied',
                insertedHeadings: 0,
                replacedHeadings: 0,
                conflict: false,
            });
            continue;
        }

        const result = applyHeadingsToAct(content, chunks, opts);
        const targetPath = result.hasConflict && !opts.force ? `${file}.new` : file;

        actions.push({
            act: key,
            path: rel(ctx.target, targetPath),
            status: opts.dryRun
                ? result.hasConflict && !opts.force
                    ? 'would-write-suggestion'
                    : 'would-write'
                : result.hasConflict && !opts.force
                    ? 'suggestion-written'
                    : 'written',
            insertedHeadings: result.insertedHeadings,
            replacedHeadings: result.replacedHeadings,
            calloutTitled: result.calloutTitled,
            conflict: result.hasConflict,
        });
        if (result.hasConflict && !opts.force) conflicts.push(rel(ctx.target, file));

        if (!opts.dryRun) {
            writeFileSync(targetPath, result.text, 'utf8');
            act.appliedAt = new Date().toISOString();
        }
    }

    const outlineText = ctx.outline ?? '';
    const renderedBlock = renderStructureBlock(state, ctx.language);
    const nextOutline = replaceStructureBlock(outlineText, renderedBlock);
    const outlineChanged = nextOutline !== outlineText;
    const outlineTarget = ctx.outlinePath;

    if (outlineChanged) {
        actions.push({
            path: rel(ctx.target, outlineTarget),
            status: opts.dryRun ? 'would-write' : 'written',
            conflict: false,
        });
        if (!opts.dryRun) writeFileSync(outlineTarget, nextOutline, 'utf8');
    }

    const now = new Date().toISOString();
    state.updatedAt = now;
    state.appliedAt = state.appliedAt || now;
    if (!opts.dryRun) {
        mkdirSync(ctx.structureDir, { recursive: true });
        writeJson(ctx.statePath, state);
        actions.push({ path: rel(ctx.target, ctx.statePath), status: 'written', conflict: false });
    }

    return publicContext(ctx, {
        phase: 'structure',
        action: opts.dryRun ? 'dry_run' : 'applied',
        ready: true,
        complete: isStructureComplete(state) && ACT_KEYS.every((k) => state.acts[k]?.appliedAt),
        scopedAct: opts.act || null,
        files: fileStatus(ctx),
        force: opts.force,
        dryRun: opts.dryRun,
        actions,
        conflicts,
        outlineSync: outlineChanged ? 'updated' : 'unchanged',
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
    const lines = [`Article structure: ${result.slug || 'slug required'}`, `Status: ${result.action}`];
    if (result.currentQuestion) lines.push(`Question: ${result.currentQuestion.question}`);
    for (const act of result.acts || []) {
        lines.push(`- ${act.key}: ${act.file || 'missing'} (${act.segmentCount} segments, ${act.existingHeadingCount} headings)`);
    }
    if (result.next?.recommendation) lines.push(`Next: ${result.next.recommendation}`);
    return lines.join('\n');
}

export function formatPrepareHuman(result) {
    const lines = [`Article structure prepare: ${result.slug || 'slug required'}`, `Action: ${result.action}`];
    if (result.message) lines.push(result.message);
    for (const [key, act] of Object.entries(result.acts || {})) {
        lines.push(`- ${key}: ${act.file || 'missing'} (${act.segments.length} segments)`);
    }
    if (result.outputContract) lines.push('Output contract is available with --json.');
    return lines.join('\n');
}

export function formatResumeHuman(result) {
    const lines = [`Article structure resume: ${result.slug || 'slug required'}`, `Action: ${result.action}`];
    if (result.cursor) lines.push(`Cursor: ${result.cursor.actId} / ${result.cursor.phase}${result.cursor.chunkId ? ' / ' + result.cursor.chunkId : ''}`);
    if (result.anchor) lines.push(`Anchor: «${result.anchor}»`);
    if (result.currentQuestion) lines.push(`Question: ${result.currentQuestion.question}`);
    if (result.message) lines.push(result.message);
    return lines.join('\n');
}

export function formatAnswerHuman(result) {
    const lines = [`Article structure answer: ${result.slug || 'slug required'}`, `Action: ${result.action}`];
    if (result.chunk) {
        const h = result.chunk.heading;
        const anchor = result.chunk.preview ? ` «${result.chunk.preview}»` : '';
        lines.push(`- ${result.chunk.id}${anchor} -> ${h ? h.level.toUpperCase() + ' ' + h.text : '(no heading)'}`);
    }
    for (const action of result.actions || []) lines.push(`- ${action.status}: ${action.path}`);
    return lines.join('\n');
}

export function formatApplyHuman(result) {
    const lines = [`Article structure apply: ${result.slug || 'slug required'}`, `Action: ${result.action}`];
    for (const action of result.actions || []) lines.push(`- ${action.status}: ${action.path}`);
    if (result.conflicts?.length) {
        lines.push(`Conflicts (use --force to overwrite): ${result.conflicts.join(', ')}`);
    }
    return lines.join('\n');
}

function needsSlug(ctx) {
    return publicContext(ctx, {
        phase: 'structure',
        action: 'needs_input',
        currentQuestion: {
            id: 'slug',
            kind: 'text',
            question: labels(ctx.language).slugQuestion,
        },
        ready: false,
        complete: false,
        files: fileStatus(ctx),
    });
}

function buildInitialState(ctx) {
    const acts = {};
    for (const key of ACT_KEYS) {
        const file = ctx.actFiles[key];
        const content = ctx.actContents[key];
        const segments = content ? segmentize(content.text) : [];
        acts[key] = {
            file: file ? basename(file) : null,
            exists: Boolean(file),
            ready: segments.length > 0,
            segments,
            chunks: [],
        };
    }
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
        source: {
            scaffoldState: ctx.scaffoldStatePath ? rel(ctx.target, ctx.scaffoldStatePath) : null,
            scaffoldUpdatedAt: ctx.scaffoldState?.updatedAt || null,
        },
        actsOrder: [...ACT_KEYS],
        acts,
        cursor: null,
        appliedAt: null,
    };
}

function ensureStateActs(ctx, state) {
    if (!state.acts) state.acts = {};
    for (const key of ACT_KEYS) {
        if (!state.acts[key]) {
            const file = ctx.actFiles[key];
            const content = ctx.actContents[key];
            state.acts[key] = {
                file: file ? basename(file) : null,
                exists: Boolean(file),
                ready: content ? segmentize(content.text).length > 0 : false,
                segments: content ? segmentize(content.text) : [],
                chunks: [],
            };
        }
        if (!state.acts[key].segments?.length && ctx.actContents[key]) {
            state.acts[key].segments = segmentize(ctx.actContents[key].text);
            state.acts[key].ready = state.acts[key].segments.length > 0;
        }
        if (!Array.isArray(state.acts[key].chunks)) state.acts[key].chunks = [];
        if (state.acts[key].appliedAt === undefined) state.acts[key].appliedAt = null;
    }
    state.actsOrder = state.actsOrder && state.actsOrder.length === 3 ? state.actsOrder : [...ACT_KEYS];
    state.slug = state.slug || ctx.slug;
    state.title = state.title || ctx.title;
    state.language = normalizeLanguage(state.language || ctx.language);
    state.articleDir = state.articleDir || ctx.slug;
    state.$schema = state.$schema || STATE_SCHEMA_URL;
    state.schemaVersion = state.schemaVersion || STATE_SCHEMA_VERSION;
    state.version = state.version || STATE_VERSION;
    state.generatedBy = state.generatedBy || SKILL_NAME;
    state.createdAt = state.createdAt || new Date().toISOString();
}

function computeCursor(ctx, state) {
    for (const key of state.actsOrder || ACT_KEYS) {
        const act = state.acts[key];
        if (!act) continue;
        if (!act.ready) continue;
        if (act.chunks.length === 0) {
            return { actId: key, phase: 'chunking', chunkId: null };
        }
        const unlabelled = act.chunks.find((c) => !c.heading);
        if (unlabelled) {
            return { actId: key, phase: 'headings', chunkId: unlabelled.id };
        }
    }
    return null;
}

function isStructureComplete(state) {
    if (!state?.acts) return false;
    for (const key of ACT_KEYS) {
        const act = state.acts[key];
        if (!act || !act.ready) continue;
        if (!isActLabelledComplete(act)) return false;
    }
    return true;
}

function isActLabelledComplete(act) {
    if (!act || !act.ready) return false;
    if (act.chunks.length === 0) return false;
    return act.chunks.every((c) => c.heading);
}

function headingTreeState(act, excludeChunkId = null) {
    const labelled = (act?.chunks || [])
        .filter((c) => c.heading && c.id !== excludeChunkId)
        .sort((a, b) => a.startLine - b.startLine);
    const hasH2 = labelled.some((c) => c.heading.level === 'h2');
    const lastH2 = [...labelled].reverse().find((c) => c.heading.level === 'h2') || null;
    const lastHeading = labelled[labelled.length - 1] || null;
    return {
        hasH2,
        currentH2: lastH2 ? lastH2.heading.text : null,
        lastHeading,
        labelledCount: labelled.length,
    };
}

function allowedLevelsFor(act, excludeChunkId = null) {
    const tree = headingTreeState(act, excludeChunkId);
    if (!tree.hasH2) return ['h2'];
    return ['h2', 'h3'];
}

function allowedLevelsForChunk(ctx, actKey, chunk, act) {
    if (chunkCalloutInfo(ctx, actKey, chunk)) return ['callout'];
    return allowedLevelsFor(act, chunk?.id);
}

function collectLabelledChunks(state) {
    const all = [];
    for (const key of ACT_KEYS) {
        const act = state.acts[key];
        if (!act) continue;
        all.push(...act.chunks.filter((c) => c.heading));
    }
    return all;
}

function sortChunks(act) {
    act.chunks.sort((a, b) => a.startLine - b.startLine);
}

function applyHeadingsToAct(content, chunks, opts) {
    const lines = content.text.split(/\r?\n/);
    let hasConflict = false;
    let insertedHeadings = 0;
    let replacedHeadings = 0;
    let calloutTitled = 0;

    const sorted = [...chunks].sort((a, b) => b.startLine - a.startLine);
    for (const chunk of sorted) {
        const idx = chunk.startLine - 1;
        if (idx < 0 || idx >= lines.length) {
            throw new Error(`Chunk ${chunk.id} startLine ${chunk.startLine} is out of range for ${content.file}`);
        }
        const existing = lines[idx] || '';

        if (chunk.heading.level === 'callout') {
            const callout = detectCallout(existing);
            if (!callout) {
                throw new Error(
                    `Chunk ${chunk.id} was labelled as callout but line ${chunk.startLine} is not a callout marker in ${content.file}: "${existing.trim()}"`
                );
            }
            if (callout.title) {
                if (opts.force) {
                    lines[idx] = renderCalloutLine(callout, chunk.heading.text);
                    replacedHeadings += 1;
                } else {
                    hasConflict = true;
                }
            } else {
                lines[idx] = renderCalloutLine(callout, chunk.heading.text);
                calloutTitled += 1;
            }
            continue;
        }

        const prefix = HEADING_PREFIX[chunk.heading.level];
        const headingLine = `${prefix}${chunk.heading.text}`;
        if (/^#{1,6}\s+/.test(existing)) {
            if (opts.force) {
                lines[idx] = headingLine;
                replacedHeadings += 1;
            } else {
                hasConflict = true;
            }
        } else {
            lines.splice(idx, 0, headingLine);
            insertedHeadings += 1;
        }
    }

    return {
        text: `${lines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd()}\n`,
        hasConflict,
        insertedHeadings,
        replacedHeadings,
        calloutTitled,
    };
}

function renderCalloutLine(callout, title) {
    const fold = callout.fold ? '-' : '';
    return `> [!${callout.type}]${fold} ${title}`;
}

function renderStructureBlock(state, language) {
    const l = labels(language);
    const lines = [STRUCTURE_MARKER_START, `## ${l.structureTitle}`, ''];
    for (const key of state.actsOrder || ACT_KEYS) {
        const act = state.acts[key];
        if (!act) continue;
        const labelled = act.chunks.filter((c) => c.heading);
        if (labelled.length === 0) continue;
        lines.push(`### ${actLabel(key, l)} (${act.file || ''})`, '');
        for (const chunk of labelled) {
            const level =
                chunk.heading.level === 'callout'
                    ? `CALLOUT`
                    : chunk.heading.level.toUpperCase();
            const preview = chunk.preview ? ` — «${chunk.preview}»` : '';
            lines.push(
                `- **${l.chunk} \`${chunk.id}\`** (${l.lines} ${chunk.startLine}-${chunk.endLine}${preview}): ${level} \`${chunk.heading.text}\``
            );
        }
        lines.push('');
    }
    lines.push(STRUCTURE_MARKER_END);
    return lines.join('\n');
}

function replaceStructureBlock(outline, block) {
    if (!outline) return `${block}\n`;
    const start = outline.indexOf(STRUCTURE_MARKER_START);
    const end = outline.indexOf(STRUCTURE_MARKER_END);
    if (start === -1 || end === -1 || end < start) {
        const trimmed = outline.trimEnd();
        return `${trimmed}\n\n${block}\n`;
    }
    const before = outline.slice(0, start);
    const after = outline.slice(end + STRUCTURE_MARKER_END.length);
    return `${before}${block}${after}`.replace(/\n{3,}/g, '\n\n');
}

function structureOutputContract() {
    return {
        schema: STATE_SCHEMA_URL,
        heading: {
            level: 'h2 | h3 | callout — H2 is a top-level section, H3 is a subsection nesting under an existing H2, "callout" is a title for an Obsidian `> [!TYPE]` block. The first heading in an act must be H2. Callout chunks are auto-detected from the first line.',
            text: 'Heading text in the article language.',
        },
        chunk: {
            id: 'Stable chunk id, for example c1, c2.',
            startLine: '1-indexed first line of the chunk in the act file (from prepare segments).',
            endLine: '1-indexed last line of the chunk in the act file.',
            preview: 'Short preview of the chunk content.',
            heading: 'A heading object or null when the chunk has no heading.',
        },
        instructions:
            'Group prepare segments into logical chunks per act, confirm boundaries with the user, then propose heading variants for each chunk.',
    };
}

function segmentize(text) {
    if (!text) return [];
    const lines = text.split(/\r?\n/);
    const segments = [];
    let current = [];
    let startIdx = null;

    const flush = (endIdx) => {
        if (current.length === 0 || startIdx == null) return;
        const preview = previewLines(current);
        segments.push({
            index: segments.length,
            startLine: startIdx + 1,
            endLine: endIdx,
            preview,
        });
        current = [];
        startIdx = null;
    };

    for (let i = 0; i < lines.length; i += 1) {
        const line = lines[i];
        const trimmed = line.trim();
        if (!trimmed) {
            flush(i);
            continue;
        }
        if (startIdx == null) startIdx = i;
        current.push(line);
    }
    flush(lines.length - 1);
    return segments;
}

function countHeadings(text) {
    if (!text) return 0;
    const matches = text.match(/^#{1,6}\s+\S/gm);
    return matches ? matches.length : 0;
}

function previewFromRange(ctx, actKey, startLine, endLine) {
    const content = ctx.actContents[actKey];
    if (!content) return '';
    const lines = content.text.split(/\r?\n/).slice(startLine - 1, endLine);
    return previewLines(lines);
}

function chunkingQuestion(ctx, actId, l) {
    const act = ctx.existingState?.acts?.[actId];
    const first = act?.segments?.[0];
    const anchor = first?.preview ? `\n\n${l.anchorChunk}: «${first.preview}»` : '';
    return `${l.askChunking} (${actLabel(actId, l)})${anchor}`;
}

function headingQuestion(chunk, l, calloutInfo = null) {
    if (!chunk) return l.askHeading;
    const anchor = chunk.preview ? `\n\n${l.anchorHeading}:\n«${chunk.preview}»` : '';
    if (calloutInfo) {
        const titleNote = calloutInfo.hasTitle
            ? `\n\nУ callout уже есть заголовок — он будет заменён (только с --force).`
            : '';
        return `Предложи 6 вариантов заголовка-названия для callout [!${calloutInfo.type}] (без ##).${anchor}${titleNote}`;
    }
    return `${l.askHeading}${anchor}`;
}

function headingProposalStyle(l) {
    return [
        { kind: 'question', count: 2, label: l.proposalQuestion, description: l.proposalQuestionDesc },
        { kind: 'irony', count: 2, label: l.proposalIrony, description: l.proposalIronyDesc },
        { kind: 'plain', count: 2, label: l.proposalPlain, description: l.proposalPlainDesc },
    ];
}

function actLabel(key, l) {
    if (key === 'act1') return l.act1;
    if (key === 'act2') return l.act2;
    return l.act3;
}

function nextStep(ctx, action) {
    if (!ctx.slug) return { recommendation: 'Provide article slug.' };
    if (!ctx.articleExists) return { recommendation: labels(ctx.language).notReady };
    if (action === 'status') {
        return { recommendation: 'Run structure-prepare.mjs to read act segments and the output contract.' };
    }
    return { recommendation: 'Run structure-resume.mjs to continue the interactive labelling.' };
}

function resolveActFiles({ slug, scaffoldState, articleDir }) {
    if (!slug || !articleDir) return { act1: null, act2: null, act3: null };
    const files = { act1: null, act2: null, act3: null };
    const scaffoldFiles = Array.isArray(scaffoldState?.files) ? scaffoldState.files : [];

    for (const key of ACT_KEYS) {
        const fromState = scaffoldFiles.find((name) => new RegExp(`^act-${actNumber(key)}-[a-z0-9-]+\\.md$`, 'i').test(name) || name === `act-${actNumber(key)}.md`);
        if (fromState) {
            const path = join(articleDir, fromState);
            if (existsSync(path)) files[key] = path;
            continue;
        }
        const matches = existsSync(articleDir)
            ? readdirSync(articleDir)
                  .filter((name) => new RegExp(`^act-${actNumber(key)}(?:-[a-z0-9-]+)?\\.md$`, 'i').test(name))
                  .sort()
            : [];
        if (matches.length > 0) files[key] = join(articleDir, matches[0]);
    }

    return files;
}

function readActContents(actFiles) {
    const contents = {};
    for (const key of ACT_KEYS) {
        const path = actFiles[key];
        if (path && existsSync(path)) {
            contents[key] = { file: basename(path), text: readFileSync(path, 'utf8') };
        } else {
            contents[key] = null;
        }
    }
    return contents;
}

function actNumber(key) {
    return key === 'act1' ? 1 : key === 'act2' ? 2 : 3;
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

function resolveSlug({ explicitSlug, threadTitle, target, discoveredStates }) {
    if (explicitSlug) return { slug: explicitSlug, source: 'argument' };
    const threadSlug = normalizeSlug(threadTitle);
    if (threadSlug) {
        const hasMatchingState = discoveredStates.some((s) => s.slug === threadSlug);
        const hasMatchingFolder = existsSync(join(target, threadSlug));
        if (hasMatchingState || hasMatchingFolder) return { slug: threadSlug, source: 'thread-title' };
    }
    const cwdSlug = normalizeSlug(basename(process.cwd()));
    if (cwdSlug) {
        const hasMatchingState = discoveredStates.some((s) => s.slug === cwdSlug);
        const hasMatchingFolder = existsSync(join(target, cwdSlug));
        if (hasMatchingState || hasMatchingFolder) return { slug: cwdSlug, source: 'cwd' };
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
    if (heading) return heading[1].trim();
    const title = text.match(/^title:\s*["']?(.+?)["']?\s*$/m);
    return title ? title[1].trim() : null;
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

function fileStatus(ctx) {
    return {
        articleDir: ctx.articleDir
            ? { path: rel(ctx.target, ctx.articleDir), exists: ctx.articleExists }
            : null,
        outline: ctx.outlinePath
            ? { path: rel(ctx.target, ctx.outlinePath), exists: existsSync(ctx.outlinePath) }
            : null,
        structureState: ctx.statePath
            ? { path: rel(ctx.target, ctx.statePath), exists: existsSync(ctx.statePath) }
            : null,
        acts: ACT_KEYS.map((key) => ({
            key,
            path: ctx.actFiles[key] ? rel(ctx.target, ctx.actFiles[key]) : null,
            exists: Boolean(ctx.actFiles[key]),
        })),
    };
}

function requireValue(argv, index, flag) {
    const value = argv[index];
    if (!value || value.startsWith('--')) throw new Error(`Missing value for ${flag}`);
    return value;
}

function parseLine(value, flag) {
    const num = Number.parseInt(value, 10);
    if (!Number.isFinite(num) || num < 1) throw new Error(`${flag} must be a positive integer.`);
    return num;
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

function normalizeActKey(value) {
    const key = String(value).trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    if (key === 'act1' || key === '1') return 'act1';
    if (key === 'act2' || key === '2') return 'act2';
    if (key === 'act3' || key === '3') return 'act3';
    throw new Error(`--act must be one of act1, act2, act3 (got: ${value})`);
}

function normalizeLevel(value) {
    const level = String(value).trim().toLowerCase().replace(/^#/, '').replace(/^h/, 'h');
    if (!ALLOWED_LEVELS.includes(level)) {
        throw new Error(`--level must be one of h2, h3, callout (got: ${value})`);
    }
    return level;
}

function stringOrNull(value) {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
}

function previewLines(lines) {
    const cleaned = (Array.isArray(lines) ? lines : [lines])
        .map((line) => line.trim())
        .filter((line) => line && !/^<!--.*-->$/.test(line));
    if (cleaned.length === 0) return '';
    const stripped = cleaned.map((line) => {
        const callout = line.match(CALLOUT_RE);
        if (callout) {
            const inner = callout[3].replace(/^>\s?/gm, '').trim();
            return inner || `[!${callout[1]}]`;
        }
        return line.replace(/^>\s?/, '');
    });
    return truncate(stripped.join(' '), PREVIEW_LEN);
}

function detectCallout(line) {
    if (!line) return null;
    const m = String(line).match(CALLOUT_RE);
    if (!m) return null;
    return { type: m[1].trim(), fold: m[2] === '-', title: m[3].trim() };
}

function chunkCalloutInfo(ctx, actKey, chunk) {
    const content = ctx?.actContents?.[actKey];
    if (!content || !chunk) return null;
    const lines = content.text.split(/\r?\n/);
    const line = lines[chunk.startLine - 1];
    return detectCallout(line);
}

function truncate(text, max) {
    const clean = String(text).replace(/\s+/g, ' ').trim();
    return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

function labels(language) {
    return TEXT[normalizeLanguage(language)];
}

function rel(root, path) {
    if (!path) return null;
    const value = relative(root, path);
    return value && !value.startsWith('..') ? value : path;
}

export const __internal = { segmentize, applyHeadingsToAct, renderStructureBlock, replaceStructureBlock };
