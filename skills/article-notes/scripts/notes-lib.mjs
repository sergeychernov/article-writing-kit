import {
    existsSync,
    mkdirSync,
    readdirSync,
    readFileSync,
    writeFileSync,
} from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';

export const SKILL_NAME = 'article-notes';
export const STATE_SCHEMA_VERSION = 1;
export const STATE_VERSION = 1;
export const STATE_SCHEMA_URL =
    'https://raw.githubusercontent.com/sergeychernov/article-writing-kit/main/skills/article-notes/assets/schemas/notes-state.schema.json';

export const NOTES_MARKER_START = '<!-- article-kit:notes:start -->';
export const NOTES_MARKER_END = '<!-- article-kit:notes:end -->';

const KINDS = ['idea', 'thesis', 'case', 'question', 'climax'];
const ACTIONS = ['add', 'update', 'delete', 'leading', 'complete', 'skip', 'reopen'];

const TEXT = {
    ru: {
        slugQuestion: 'Какой slug использовать для заметок?',
        notesTitle: 'Авторские заметки',
        addIdea: 'Добавить идею',
        addThesis: 'Добавить тезис',
        addCase: 'Добавить кейс',
        addQuestion: 'Добавить открытый вопрос',
        addClimax: 'Добавить кандидата на кульминацию',
        markComplete: 'Завершить заметки и перейти к скаффолду/брифу',
        skip: 'Пропустить заметки и идти дальше',
        askMenu: 'Что делаем дальше с заметками?',
        askText: 'Запиши текст записи одним сообщением.',
        askKind: 'Укажи тип записи.',
        leadingSet: 'Отмечена ведущая кульминация.',
        leadingCleared: 'Ведущая кульминация снята.',
        complete: 'Заметки завершены. Можно переходить к article-scaffold / article-architect.',
        skipped: 'Заметки пропущены. Иди к article-scaffold / article-architect.',
        reopened: 'Заметки снова открыты.',
        empty: 'Записей пока нет.',
        deleted: 'Запись удалена.',
        added: 'Запись добавлена.',
        updated: 'Запись обновлена.',
        notFound: 'Запись с таким id не найдена.',
        onlyClimaxLeading: 'Ведущей может быть только запись типа climax.',
    },
    en: {
        slugQuestion: 'Which slug should I use for the notes?',
        notesTitle: 'Author Notes',
        addIdea: 'Add an idea',
        addThesis: 'Add a thesis',
        addCase: 'Add a case',
        addQuestion: 'Add an open question',
        addClimax: 'Add a climax candidate',
        markComplete: 'Finish notes and move on to scaffold/brief',
        skip: 'Skip notes and move on',
        askMenu: 'What do we do next with the notes?',
        askText: 'Write the record text in one message.',
        askKind: 'Specify the record kind.',
        leadingSet: 'Leading climax marked.',
        leadingCleared: 'Leading climax cleared.',
        complete: 'Notes finished. You can move on to article-scaffold / article-architect.',
        skipped: 'Notes skipped. Move on to article-scaffold / article-architect.',
        reopened: 'Notes reopened.',
        empty: 'No records yet.',
        deleted: 'Record deleted.',
        added: 'Record added.',
        updated: 'Record updated.',
        notFound: 'No record with that id.',
        onlyClimaxLeading: 'Only a climax record can be the leading climax.',
    },
};

export function parseArgs(argv = process.argv.slice(2)) {
    const opts = {
        target: '.',
        slug: null,
        threadTitle: null,
        language: null,
        action: null,
        kind: null,
        id: null,
        text: null,
        tags: null,
        leading: false,
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
        } else if (arg === '--new') {
            opts.new = true;
        } else if (arg === '--force') {
            opts.force = true;
        } else if (arg === '--leading') {
            opts.leading = true;
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
        } else if (arg === '--action') {
            opts.action = normalizeAction(requireValue(argv, (i += 1), arg));
        } else if (arg === '--kind') {
            opts.kind = normalizeKind(requireValue(argv, (i += 1), arg));
        } else if (arg === '--id') {
            opts.id = requireValue(argv, (i += 1), arg);
        } else if (arg === '--text') {
            opts.text = requireValue(argv, (i += 1), arg);
        } else if (arg === '--tags') {
            opts.tags = requireValue(argv, (i += 1), arg)
                .split(',')
                .map((tag) => tag.trim())
                .filter(Boolean);
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
        'notes-status.mjs': '',
        'notes-resume.mjs': ' [--new]',
        'notes-answer.mjs':
            ' --action <add|update|delete|leading|complete|skip|reopen> [--kind <idea|thesis|case|question|climax>] [--id <id>] [--text <text>] [--tags a,b] [--leading]',
        'notes-sync.mjs': ' [--force]',
    }[command];

    console.log(`Usage:
  node <SKILL_DIR>/scripts/${command} [--target <path>] [--slug <slug>] [--thread-title <title>]${extra} [--json]

Flags:
  --target <path>     Article workspace root; default is current working directory
  --slug <slug>       Article folder name; unsafe characters are normalized
  --thread-title <t>  Current IDE thread/chat title; used to recover an article slug
  --chat-title <t>    Alias for --thread-title
  --language ru|en    Output language when no notes state exists yet
  --new               (resume) ignore saved notes state and start over
  --action <a>        (answer) add | update | delete | leading | complete | skip | reopen
  --kind <kind>       (answer, add) idea | thesis | case | question | climax
  --id <id>           (answer, update/delete/leading) record id, for example n3
  --text <text>       (answer, add/update) record text
  --tags <a,b>        (answer, add/update) optional comma-separated tags
  --leading           (answer, add/leading) mark a climax record as the leading climax
  --force             (sync) overwrite an existing article-notes.md outside the managed block
  --dry-run           Show intended changes without writing files
  --json              Print machine-readable JSON
  --help              Show this help
`);
}

export function buildContext(opts = {}) {
    const target = resolve(process.cwd(), opts.target || '.');
    const notesDir = join(target, '.article-kit', 'notes');
    const articleKitDir = join(target, '.article-kit');
    const scaffoldDir = join(target, '.article-kit', 'scaffold');
    const discoveredNotes = discoverNotesStates(notesDir);
    const discoveredScaffold = discoverScaffoldSlugs(scaffoldDir);
    const slugInfo = resolveSlug({
        explicitSlug: opts.slug,
        threadTitle: opts.threadTitle,
        target,
        discoveredNotes,
        discoveredScaffold,
    });
    const slug = slugInfo.slug;
    const statePath = slug ? join(notesDir, `${slug}.json`) : null;
    const existingState = statePath ? readJson(statePath) : null;
    const articleDir = slug ? join(target, slug) : null;
    const notesMarkdownPath = articleDir ? join(articleDir, 'article-notes.md') : null;
    const title = stringOrNull(existingState?.title) || slug;
    const language = normalizeLanguage(opts.language || existingState?.language || 'ru');

    return {
        skill: SKILL_NAME,
        stateSchema: STATE_SCHEMA_URL,
        stateSchemaVersion: STATE_SCHEMA_VERSION,
        target,
        notesDir,
        articleKitDir,
        discoveredNotes,
        discoveredScaffold,
        slug,
        slugSource: slugInfo.source,
        suggestedThreadTitle: slug,
        title,
        language,
        articleDir,
        articleExists: articleDir ? existsSync(articleDir) : false,
        notesMarkdownPath,
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

    const state = ctx.existingState;
    const counts = recordCounts(state);

    return publicContext(ctx, {
        phase: 'notes',
        action: ctx.slug ? 'status' : 'needs_input',
        currentQuestion,
        ready: Boolean(ctx.slug),
        complete: isComplete(state),
        skipped: isSkipped(state),
        status: state?.status || null,
        counts,
        recordCount: state?.records?.length || 0,
        leadingClimaxId: state?.leadingClimaxId || null,
        files: fileStatus(ctx),
        next: nextStep(ctx, 'status'),
    });
}

export function createResumeResponse(ctx, opts = {}) {
    if (!ctx.slug) return needsSlug(ctx);

    const state = (opts.new ? null : ctx.existingState) || buildInitialState(ctx);
    if (opts.new && ctx.existingState && !opts.dryRun) {
        // Starting over: keep slug/title/language but clear records.
        Object.assign(state, {
            records: [],
            leadingClimaxId: null,
            status: 'started',
            syncedAt: null,
            updatedAt: new Date().toISOString(),
        });
        mkdirSync(ctx.notesDir, { recursive: true });
        writeJson(ctx.statePath, state);
    }

    if (state.status === 'complete' || state.status === 'skipped') {
        return publicContext(ctx, {
            phase: 'notes',
            action: state.status === 'complete' ? 'notes_complete' : 'notes_skipped',
            ready: true,
            complete: state.status === 'complete',
            skipped: state.status === 'skipped',
            status: state.status,
            files: fileStatus(ctx),
        records: state.records.map((r) => publicRecord(r, state.leadingClimaxId)),
        leadingClimaxId: state.leadingClimaxId || null,
        message: labels(ctx.language)[state.status === 'complete' ? 'complete' : 'skipped'],
            next: {
                recommendation:
                    state.status === 'complete'
                        ? 'Run article-scaffold or article-architect next.'
                        : 'Run article-scaffold or article-architect next; notes were skipped.',
                canReopen: 'Run notes-answer.mjs --action reopen to reopen the notes.',
            },
        });
    }

    const l = labels(ctx.language);
    return publicContext(ctx, {
        phase: 'notes',
        action: 'needs_input',
        ready: true,
        complete: false,
        skipped: false,
        status: state.status,
        files: fileStatus(ctx),
        records: state.records.map((r) => publicRecord(r, state.leadingClimaxId)),
        leadingClimaxId: state.leadingClimaxId || null,
        currentQuestion: {
            id: 'menu',
            kind: 'choice',
            question: l.askMenu,
            options: [
                { id: 'add_idea', label: l.addIdea, action: 'add', kind: 'idea' },
                { id: 'add_thesis', label: l.addThesis, action: 'add', kind: 'thesis' },
                { id: 'add_case', label: l.addCase, action: 'add', kind: 'case' },
                { id: 'add_question', label: l.addQuestion, action: 'add', kind: 'question' },
                { id: 'add_climax', label: l.addClimax, action: 'add', kind: 'climax' },
                { id: 'complete', label: l.markComplete, action: 'complete' },
                { id: 'skip', label: l.skip, action: 'skip' },
            ],
        },
        instructions: [
            'Ask the user to pick one menu option per turn. For add/update, collect a single text message.',
            'Do not invent records without explicit user text; for --action add always pass the user wording as --text.',
            'Use --action complete when the user is done, or --action skip to abandon notes. Either lets the pipeline move to scaffold/architect.',
        ],
    });
}

export function saveAnswer(ctx, opts) {
    if (!ctx.slug) return needsSlug(ctx);
    if (!opts.action) throw new Error('--action is required for notes-answer.mjs');

    const state = ctx.existingState || buildInitialState(ctx);
    const l = labels(ctx.language);
    const now = new Date().toISOString();
    const actions = [];

    if (state.status === 'complete' || state.status === 'skipped') {
        if (opts.action !== 'reopen') {
            return publicContext(ctx, {
                phase: 'notes',
                action: state.status === 'complete' ? 'notes_complete' : 'notes_skipped',
                ready: true,
                complete: state.status === 'complete',
                skipped: state.status === 'skipped',
                status: state.status,
                files: fileStatus(ctx),
                records: state.records.map((r) => publicRecord(r, state.leadingClimaxId)),
                leadingClimaxId: state.leadingClimaxId || null,
                message: l[state.status === 'complete' ? 'complete' : 'skipped'],
                next: {
                    recommendation: 'Run notes-answer.mjs --action reopen to edit notes again.',
                },
            });
        }
    }

    let message = '';
    let changedRecords = false;

    switch (opts.action) {
        case 'add': {
            if (!opts.kind) throw new Error('--kind is required for --action add');
            if (!opts.text) throw new Error('--text is required for --action add');
            const id = nextRecordId(state);
            const record = {
                id,
                kind: opts.kind,
                text: String(opts.text).trim(),
                tags: Array.isArray(opts.tags) ? opts.tags : [],
                createdAt: now,
                updatedAt: now,
            };
            state.records.push(record);
            if (opts.kind === 'climax' && opts.leading) {
                state.leadingClimaxId = id;
            }
            message = l.added;
            changedRecords = true;
            actions.push({ recordId: id, kind: record.kind, status: 'added' });
            break;
        }
        case 'update': {
            if (!opts.id) throw new Error('--id is required for --action update');
            const record = state.records.find((r) => r.id === opts.id);
            if (!record) throw new Error(l.notFound);
            if (opts.text) record.text = String(opts.text).trim();
            if (Array.isArray(opts.tags)) record.tags = opts.tags;
            if (opts.kind) record.kind = opts.kind;
            record.updatedAt = now;
            message = l.updated;
            changedRecords = true;
            actions.push({ recordId: record.id, kind: record.kind, status: 'updated' });
            break;
        }
        case 'delete': {
            if (!opts.id) throw new Error('--id is required for --action delete');
            const idx = state.records.findIndex((r) => r.id === opts.id);
            if (idx === -1) throw new Error(l.notFound);
            const [removed] = state.records.splice(idx, 1);
            if (state.leadingClimaxId === removed.id) state.leadingClimaxId = null;
            message = l.deleted;
            changedRecords = true;
            actions.push({ recordId: removed.id, kind: removed.kind, status: 'deleted' });
            break;
        }
        case 'leading': {
            if (opts.leading === false && !opts.id) {
                state.leadingClimaxId = null;
                message = l.leadingCleared;
            } else {
                if (!opts.id) throw new Error('--id is required for --action leading');
                const record = state.records.find((r) => r.id === opts.id);
                if (!record) throw new Error(l.notFound);
                if (record.kind !== 'climax') throw new Error(l.onlyClimaxLeading);
                state.leadingClimaxId = record.id;
                message = l.leadingSet;
            }
            actions.push({ leadingClimaxId: state.leadingClimaxId, status: 'leading' });
            break;
        }
        case 'complete': {
            state.status = 'complete';
            state.syncedAt = null;
            message = l.complete;
            actions.push({ status: 'complete' });
            break;
        }
        case 'skip': {
            state.status = 'skipped';
            message = l.skipped;
            actions.push({ status: 'skipped' });
            break;
        }
        case 'reopen': {
            state.status = 'started';
            message = l.reopened;
            actions.push({ status: 'reopened' });
            break;
        }
        default:
            throw new Error(`Unknown action: ${opts.action}`);
    }

    state.updatedAt = now;

    if (changedRecords && state.status === 'complete') {
        // Editing records after completion reopens the notes.
        state.status = 'started';
    }

    if (!opts.dryRun) {
        mkdirSync(ctx.notesDir, { recursive: true });
        writeJson(ctx.statePath, state);
        actions.push({ path: rel(ctx.target, ctx.statePath), status: 'written' });
    } else {
        actions.push({ path: rel(ctx.target, ctx.statePath), status: 'would-write' });
    }

    return publicContext(ctx, {
        phase: 'notes',
        action: opts.dryRun ? 'dry_run' : 'saved',
        ready: true,
        complete: state.status === 'complete',
        skipped: state.status === 'skipped',
        status: state.status,
        files: fileStatus(ctx),
        records: state.records.map((r) => publicRecord(r, state.leadingClimaxId)),
        leadingClimaxId: state.leadingClimaxId || null,
        message,
        actions,
        next: nextStep(ctx, 'answer', state),
    });
}

export function syncNotes(ctx, opts = {}) {
    if (!ctx.slug) return needsSlug(ctx);
    const state = ctx.existingState;
    if (!state) {
        throw new Error('No notes state found. Run notes-resume.mjs and add records first.');
    }

    const block = renderNotesBlock(state, ctx.language);
    const existing = ctx.notesMarkdownPath && existsSync(ctx.notesMarkdownPath)
        ? readFileSync(ctx.notesMarkdownPath, 'utf8')
        : null;
    const next = replaceNotesBlock(existing, block, opts.force);
    const changed = next !== existing;

    const actions = [];
    if (changed && ctx.notesMarkdownPath) {
        if (!opts.dryRun) {
            mkdirSync(ctx.articleDir, { recursive: true });
            writeFileSync(ctx.notesMarkdownPath, next, 'utf8');
        }
        actions.push({
            path: rel(ctx.target, ctx.notesMarkdownPath),
            status: opts.dryRun ? 'would-write' : 'written',
        });
    } else if (ctx.notesMarkdownPath) {
        actions.push({ path: rel(ctx.target, ctx.notesMarkdownPath), status: 'unchanged' });
    }

    const now = new Date().toISOString();
    state.updatedAt = now;
    if (changed && !opts.dryRun) {
        state.syncedAt = now;
        mkdirSync(ctx.notesDir, { recursive: true });
        writeJson(ctx.statePath, state);
        actions.push({ path: rel(ctx.target, ctx.statePath), status: 'written' });
    }

    return publicContext(ctx, {
        phase: 'notes',
        action: opts.dryRun ? 'dry_run' : 'synced',
        ready: true,
        complete: state.status === 'complete',
        skipped: state.status === 'skipped',
        status: state.status,
        files: fileStatus(ctx),
        records: state.records.map((r) => publicRecord(r, state.leadingClimaxId)),
        leadingClimaxId: state.leadingClimaxId || null,
        markdownPath: ctx.notesMarkdownPath ? rel(ctx.target, ctx.notesMarkdownPath) : null,
        actions,
        outlineSync: changed ? 'updated' : 'unchanged',
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
    const lines = [`Article notes: ${result.slug || 'slug required'}`, `Status: ${result.action}`];
    if (result.currentQuestion) lines.push(`Question: ${result.currentQuestion.question}`);
    if (result.status) lines.push(`Notes status: ${result.status}`);
    if (result.recordCount != null) lines.push(`Records: ${result.recordCount}`);
    if (result.next?.recommendation) lines.push(`Next: ${result.next.recommendation}`);
    return lines.join('\n');
}

export function formatResumeHuman(result) {
    const lines = [`Article notes resume: ${result.slug || 'slug required'}`, `Action: ${result.action}`];
    if (result.message) lines.push(result.message);
    if (result.currentQuestion) {
        lines.push(`Question: ${result.currentQuestion.question}`);
        for (const option of result.currentQuestion.options || []) {
            lines.push(`- ${option.id}: ${option.label}`);
        }
    }
    for (const record of result.records || []) {
        lines.push(`- ${record.id} [${record.kind}] ${record.text}`);
    }
    return lines.join('\n');
}

export function formatAnswerHuman(result) {
    const lines = [`Article notes answer: ${result.slug || 'slug required'}`, `Action: ${result.action}`];
    if (result.message) lines.push(result.message);
    for (const action of result.actions || []) {
        const desc = action.recordId
            ? `${action.recordId} [${action.kind || ''}] ${action.status}`
            : action.status;
        lines.push(`- ${desc}${action.path ? `: ${action.path}` : ''}`);
    }
    if (result.next?.recommendation) lines.push(`Next: ${result.next.recommendation}`);
    return lines.join('\n');
}

export function formatSyncHuman(result) {
    const lines = [`Article notes sync: ${result.slug || 'slug required'}`, `Action: ${result.action}`];
    for (const action of result.actions || []) lines.push(`- ${action.status}: ${action.path}`);
    return lines.join('\n');
}

function needsSlug(ctx) {
    return publicContext(ctx, {
        phase: 'notes',
        action: 'needs_input',
        currentQuestion: {
            id: 'slug',
            kind: 'text',
            question: labels(ctx.language).slugQuestion,
        },
        ready: false,
        complete: false,
        skipped: false,
        files: fileStatus(ctx),
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
        status: 'started',
        records: [],
        leadingClimaxId: null,
        syncedAt: null,
    };
}

function recordCounts(state) {
    const counts = { idea: 0, thesis: 0, case: 0, question: 0, climax: 0 };
    for (const record of state?.records || []) {
        if (counts[record.kind] != null) counts[record.kind] += 1;
    }
    return counts;
}

function nextRecordId(state) {
    let max = 0;
    for (const record of state?.records || []) {
        const num = Number.parseInt(String(record.id).replace(/^n/, ''), 10);
        if (Number.isFinite(num) && num > max) max = num;
    }
    return `n${max + 1}`;
}

function isComplete(state) {
    return Boolean(state && state.status === 'complete');
}

function isSkipped(state) {
    return Boolean(state && state.status === 'skipped');
}

function renderNotesBlock(state, language) {
    const l = labels(language);
    const lines = [NOTES_MARKER_START, `## ${l.notesTitle}`, ''];
    const records = state.records || [];
    if (records.length === 0) {
        lines.push(`_${l.empty}_`, '');
    } else {
        for (const record of records) {
            const tag = record.tags?.length ? ` _#${record.tags.join(' #')}_` : '';
            const leading = record.kind === 'climax' && state.leadingClimaxId === record.id ? ' ★' : '';
            lines.push(`- **${record.kind}${leading}** (${record.id}): ${record.text}${tag}`);
        }
        lines.push('');
    }
    lines.push(NOTES_MARKER_END);
    return lines.join('\n');
}

function replaceNotesBlock(existing, block, force) {
    if (!existing) return `${block}\n`;
    const start = existing.indexOf(NOTES_MARKER_START);
    const end = existing.indexOf(NOTES_MARKER_END);
    if (start === -1 || end === -1 || end < start) {
        const trimmed = existing.trimEnd();
        return `${trimmed}\n\n${block}\n`;
    }
    const before = existing.slice(0, start);
    const after = existing.slice(end + NOTES_MARKER_END.length);
    return `${before}${block}${after}`.replace(/\n{3,}/g, '\n\n');
}

function nextStep(ctx, action, state) {
    if (!ctx.slug) return { recommendation: 'Provide article slug.' };
    if (action === 'status') {
        return { recommendation: 'Run notes-resume.mjs to start the interactive notes dialogue.' };
    }
    if (state?.status === 'complete' || state?.status === 'skipped') {
        return {
            recommendation: 'Run notes-sync.mjs to write article-notes.md, then move on to article-scaffold or article-architect.',
        };
    }
    return { recommendation: 'Continue with notes-resume.mjs; add more records or run --action complete/skip.' };
}

function discoverNotesStates(notesDir) {
    if (!existsSync(notesDir)) return [];
    return readdirSync(notesDir)
        .filter((name) => name.endsWith('.json'))
        .map((name) => {
            const path = join(notesDir, name);
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

function discoverScaffoldSlugs(scaffoldDir) {
    if (!existsSync(scaffoldDir)) return [];
    return readdirSync(scaffoldDir)
        .filter((name) => name.endsWith('.json'))
        .map((name) => normalizeSlug(name.replace(/\.json$/, '')))
        .filter(Boolean);
}

function resolveSlug({ explicitSlug, threadTitle, target, discoveredNotes, discoveredScaffold }) {
    if (explicitSlug) return { slug: explicitSlug, source: 'argument' };
    const threadSlug = normalizeSlug(threadTitle);
    if (threadSlug) {
        const matchNotes = discoveredNotes.some((s) => s.slug === threadSlug);
        const matchScaffold = discoveredScaffold.includes(threadSlug);
        const matchFolder = existsSync(join(target, threadSlug));
        if (matchNotes || matchScaffold || matchFolder) return { slug: threadSlug, source: 'thread-title' };
        // For notes, a fresh thread title can seed a new notes state.
        return { slug: threadSlug, source: 'thread-title-new' };
    }
    const cwdSlug = normalizeSlug(basename(process.cwd()));
    if (cwdSlug) {
        const matchNotes = discoveredNotes.some((s) => s.slug === cwdSlug);
        const matchScaffold = discoveredScaffold.includes(cwdSlug);
        const matchFolder = existsSync(join(target, cwdSlug));
        if (matchNotes || matchScaffold || matchFolder) return { slug: cwdSlug, source: 'cwd' };
    }
    if (discoveredNotes.length === 1) return { slug: discoveredNotes[0].slug, source: 'single-state' };
    return { slug: null, source: null };
}

function publicRecord(record, leadingClimaxId = null) {
    return {
        id: record.id,
        kind: record.kind,
        text: record.text,
        tags: Array.isArray(record.tags) ? record.tags : [],
        isLeadingClimax: record.kind === 'climax' && record.id === leadingClimaxId,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
    };
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
        discoveredNotes: ctx.discoveredNotes.map((s) => ({
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
        notesMarkdown: ctx.notesMarkdownPath
            ? { path: rel(ctx.target, ctx.notesMarkdownPath), exists: existsSync(ctx.notesMarkdownPath) }
            : null,
        notesState: ctx.statePath
            ? { path: rel(ctx.target, ctx.statePath), exists: existsSync(ctx.statePath) }
            : null,
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

function normalizeKind(value) {
    const kind = String(value).trim().toLowerCase();
    if (!KINDS.includes(kind)) {
        throw new Error(`--kind must be one of ${KINDS.join(', ')} (got: ${value})`);
    }
    return kind;
}

function normalizeAction(value) {
    const action = String(value).trim().toLowerCase();
    if (!ACTIONS.includes(action)) {
        throw new Error(`--action must be one of ${ACTIONS.join(', ')} (got: ${value})`);
    }
    return action;
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

function writeJson(path, value) {
    writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function labels(language) {
    return TEXT[normalizeLanguage(language)];
}

function rel(root, path) {
    if (!path) return null;
    const value = relative(root, path);
    return value && !value.startsWith('..') ? value : path;
}
