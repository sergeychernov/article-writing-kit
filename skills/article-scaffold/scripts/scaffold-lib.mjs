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

export const BRIEF_FIELDS = [
    {
        id: 'topic',
        kind: 'text',
        labels: { en: 'Topic', ru: 'Тема' },
        questions: {
            en: 'What is the article topic?',
            ru: 'О чем будет статья?',
        },
    },
    {
        id: 'goal',
        kind: 'text',
        labels: { en: 'Goal', ru: 'Цель' },
        questions: {
            en: 'Why are you writing this article?',
            ru: 'Зачем ты пишешь эту статью?',
        },
    },
    {
        id: 'repository',
        kind: 'repository',
        optionalWhen: 'repositoryContext',
        labels: { en: 'Relevant Repositories', ru: 'Релевантные репозитории' },
        questions: {
            en: 'Are there relevant repositories for this article? Send one or more HTTPS/SSH URLs, or answer "no".',
            ru: 'Для статьи существуют релевантные репозитории? Пришли одну или несколько ссылок HTTPS/SSH, либо ответь «нет».',
        },
    },
    {
        id: 'audience',
        kind: 'text',
        labels: { en: 'Audience', ru: 'Аудитория' },
        questions: {
            en: 'Who is the target audience?',
            ru: 'Для кого эта статья?',
        },
    },
    {
        id: 'publicationTargets',
        kind: 'list',
        labels: { en: 'Publication Targets', ru: 'Площадки публикации' },
        questions: {
            en: 'Where do you plan to publish it?',
            ru: 'Где ты планируешь её публиковать?',
        },
    },
    {
        id: 'readerTakeaway',
        kind: 'text',
        labels: { en: 'Reader Takeaway', ru: 'Что унесет читатель' },
        questions: {
            en: 'What should the reader take away?',
            ru: 'Что читатель должен унести после прочтения?',
        },
    },
    {
        id: 'constraints',
        kind: 'text',
        labels: { en: 'Constraints', ru: 'Ограничения и важные детали' },
        questions: {
            en: 'What constraints or must-keep details should future agents respect?',
            ru: 'Какие ограничения или важные детали будущие агенты должны сохранить?',
        },
    },
];

const BRIEF_BLOCK_START = '<!-- article-kit:brief:start -->';
const BRIEF_BLOCK_END = '<!-- article-kit:brief:end -->';

const SCAFFOLD_QUESTIONS = {
    slug: {
        en: 'What folder slug should be used for the article?',
        ru: 'Какой slug использовать для папки статьи?',
    },
    title: {
        en: 'What is the article title?',
        ru: 'Какой заголовок статьи записать в index.md?',
    },
};

const REPOSITORY_CONTEXT_PATTERNS = [
    /\bgithub\b/i,
    /\bgitlab\b/i,
    /\bbitbucket\b/i,
    /\brepository\b/i,
    /\brepo\b/i,
    /\bopen[-\s]?source\b/i,
    /\btool\b/i,
    /\bcli\b/i,
    /\bsdk\b/i,
    /\bapi\b/i,
    /\bplugin\b/i,
    /\bpackage\b/i,
    /\blibrary\b/i,
    /\bframework\b/i,
    /\bextension\b/i,
    /\bskills?\b/i,
    /\bagents?\b/i,
    /\bcursor\b/i,
    /\bcodex\b/i,
    /\bclaude(?:\s+code)?\b/i,
    /инструмент/i,
    /репозитор/i,
    /опенсорс/i,
    /\bopen source\b/i,
    /скилл/i,
    /агент/i,
    /пакет/i,
    /библиотек/i,
    /фреймворк/i,
    /плагин/i,
    /расширени[ея]/i,
    /утилит/i,
];

const NO_REPOSITORY_ANSWERS = new Set([
    'no',
    'nope',
    'none',
    'n/a',
    'na',
    'not now',
    'нет',
    'не',
    'нету',
    'нет ссылки',
    'без репозитория',
    'не знаю',
]);

const STATE_VERSION = 1;
const STATE_SCHEMA_VERSION = 1;
const STATE_SCHEMA_URL =
    'https://raw.githubusercontent.com/sergeychernov/article-writing-kit/main/skills/article-scaffold/assets/schemas/scaffold-state.schema.json';

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
        threadTitle: null,
        context: [],
        language: null,
        dryRun: false,
        force: false,
        json: false,
        newArticle: false,
        field: null,
        value: null,
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
        } else if (arg === '--field') {
            opts.field = requireValue(args, ++i, '--field');
        } else if (arg.startsWith('--field=')) {
            opts.field = valueFromEquals(arg, '--field');
        } else if (arg === '--value') {
            opts.value = requireValue(args, ++i, '--value');
        } else if (arg.startsWith('--value=')) {
            opts.value = valueFromEquals(arg, '--value');
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
        } else if (arg === '--thread-title' || arg === '--chat-title') {
            opts.threadTitle = requireValue(args, ++i, arg);
        } else if (arg.startsWith('--thread-title=')) {
            opts.threadTitle = valueFromEquals(arg, '--thread-title');
        } else if (arg.startsWith('--chat-title=')) {
            opts.threadTitle = valueFromEquals(arg, '--chat-title');
        } else if (arg === '--context') {
            opts.context.push(requireValue(args, ++i, '--context'));
        } else if (arg.startsWith('--context=')) {
            opts.context.push(valueFromEquals(arg, '--context'));
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
    if (opts.threadTitle !== null) opts.threadTitle = cleanTitle(opts.threadTitle);
    opts.context = opts.context.map((item) => String(item).trim()).filter(Boolean);
    if (opts.language !== null) opts.language = cleanLanguage(opts.language);
    if (opts.slug !== null) opts.slug = normalizeSlug(opts.slug);
    if (opts.field !== null) opts.field = String(opts.field).trim();
    if (opts.value !== null) opts.value = String(opts.value).trim();

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

function recoverSlugFromThreadTitle(target, threadTitle) {
    const slug = threadTitle ? normalizeSlug(threadTitle) : null;
    if (!slug) return null;

    const articleDir = safeArticleDir(target, slug);
    if (!existsSync(articleDir)) return null;
    if (!statSync(articleDir).isDirectory()) return null;

    return slug;
}

export function buildContext(opts, config = {}) {
    const targetStatus = getTargetStatus(opts.target, opts.dryRun);
    const discoveredStates = listStates(opts.target);
    const resumableStates = discoveredStates.filter(isResumableState);
    const threadSlug = recoverSlugFromThreadTitle(opts.target, opts.threadTitle);
    const autoResumeStates = config.autoResumeApplied ? discoveredStates : resumableStates;
    const autoState =
        !opts.newArticle && !opts.slug && config.autoResumeSingle && autoResumeStates.length === 1
            ? autoResumeStates[0]
            : null;

    const seedSlug = opts.slug ?? threadSlug ?? autoState?.slug ?? null;
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
        choiceStates: opts.newArticle ? [] : config.choiceAllStates ? discoveredStates : resumableStates,
        language,
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
        threadTitle: opts.threadTitle,
        context: opts.context,
        recoveredSlug: threadSlug,
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

export function resumeBrief(opts) {
    const ctx = buildContext(opts, {
        autoResumeSingle: true,
        autoResumeApplied: true,
        choiceAllStates: true,
    });
    return withBriefNextStep(publicBriefContext(ctx));
}

export function statusBrief(opts) {
    const ctx = buildContext(opts, {
        autoResumeSingle: true,
        autoResumeApplied: true,
        choiceAllStates: true,
    });
    return withBriefNextStep(publicBriefContext(ctx));
}

export function answerBrief(opts) {
    const ctx = buildContext(opts, {
        autoResumeSingle: true,
        autoResumeApplied: true,
        choiceAllStates: true,
    });
    const report = publicBriefContext(ctx);

    if (!ctx.ready) {
        return withBriefNextStep(report);
    }

    if (!opts.field) {
        throw new Error('--field is required');
    }
    if (opts.value === null) {
        throw new Error('--value is required');
    }

    const field = findBriefField(opts.field);
    const value = parseBriefValue(field, opts.value);
    const brief = normalizeBrief(ctx.state?.brief);
    brief[field.id] = value;

    if (!opts.dryRun) {
        writeBriefAnswer(ctx, field, value);
    }

    const nextCtx = opts.dryRun
        ? {
              ...ctx,
              state: {
                  ...(ctx.state ?? {}),
                  slug: ctx.slug,
                  title: ctx.title,
                  language: ctx.language,
                  brief,
              },
          }
        : buildContext(
              {
                  ...opts,
                  slug: ctx.slug,
                  title: ctx.title,
                  language: ctx.language,
              },
              {
                  autoResumeSingle: true,
                  autoResumeApplied: true,
                  choiceAllStates: true,
              },
          );

    return withBriefNextStep({
        ...publicBriefContext(nextCtx),
        action: opts.dryRun ? 'would_save_answer' : 'answer_saved',
        saved: {
            field: field.id,
            value,
        },
        markdown: syncBriefToOutline(nextCtx, opts),
    });
}

export function syncBriefMarkdown(opts) {
    const ctx = buildContext(opts, {
        autoResumeSingle: true,
        autoResumeApplied: true,
        choiceAllStates: true,
    });
    const report = publicBriefContext(ctx);

    if (!ctx.ready || Object.keys(report.brief ?? {}).length === 0) {
        return withBriefNextStep(report);
    }

    return withBriefNextStep({
        ...report,
        action: opts.dryRun ? 'would_sync' : 'synced',
        markdown: syncBriefToOutline(ctx, opts),
    });
}

function publicContext(ctx) {
    const complete = ctx.ready && ctx.fileStatus?.complete === true;

    return {
        skill: ctx.skill,
        stateSchema: STATE_SCHEMA_URL,
        stateSchemaVersion: STATE_SCHEMA_VERSION,
        target: ctx.target,
        targetStatus: ctx.targetStatus,
        dryRun: ctx.dryRun,
        force: ctx.force,
        newArticle: ctx.newArticle,
        slug: ctx.slug,
        title: ctx.title,
        suggestedThreadTitle: ctx.slug,
        threadTitle: ctx.threadTitle,
        recoveredSlug: ctx.recoveredSlug,
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

function publicBriefContext(ctx) {
    const brief = normalizeBrief(ctx.state?.brief);
    const briefQuestions = ctx.ready ? buildBriefQuestions(brief, ctx).slice(0, 1) : [];
    const briefComplete = ctx.ready && buildBriefQuestions(brief, ctx).length === 0;
    const action = !ctx.ready ? 'needs_scaffold_input' : briefComplete ? 'brief_complete' : 'needs_input';

    return {
        ...publicContext(ctx),
        phase: 'brief',
        action,
        structureComplete: ctx.ready && ctx.fileStatus?.complete === true,
        complete: briefComplete,
        brief,
        briefComplete,
        questions: ctx.ready ? briefQuestions : ctx.questions,
        currentQuestion: ctx.ready ? briefQuestions[0] ?? null : ctx.questions[0] ?? null,
        missing: ctx.ready ? briefQuestions.map((q) => q.id) : ctx.missing,
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

function withBriefNextStep(report) {
    const architectRecommendation = 'Use article-architect with the brief block in three-act-outline.md.';

    if (report.action === 'needs_input' || report.action === 'needs_scaffold_input') {
        report.next = {
            questions: report.questions,
        };
    } else if (report.action === 'answer_saved' || report.action === 'would_save_answer') {
        report.next = report.briefComplete
            ? { recommendation: architectRecommendation }
            : { questions: report.questions };
    } else if (report.action === 'synced' || report.action === 'would_sync') {
        report.next = report.briefComplete
            ? { recommendation: architectRecommendation }
            : { questions: report.questions };
    } else if (report.action === 'brief_complete') {
        report.next = {
            recommendation: architectRecommendation,
        };
    }
    return report;
}

function buildQuestions({ slug, title, titleForSlug, choiceStates, language }) {
    const questions = [];

    if (!slug) {
        const suggestion = titleForSlug ? normalizeSlug(titleForSlug) : null;
        questions.push({
            id: 'slug',
            question: localize(SCAFFOLD_QUESTIONS.slug, language),
            suggestion: suggestion || null,
            choices: choiceStates.map((state) => state.slug).filter(Boolean),
        });
    }

    if (!title) {
        questions.push({
            id: 'title',
            question: localize(SCAFFOLD_QUESTIONS.title, language),
        });
    }

    return questions;
}

function buildBriefQuestions(brief, ctx) {
    const questions = [];

    for (const field of BRIEF_FIELDS) {
        if (!briefFieldApplies(field, brief, ctx)) continue;

        if (briefValueMissing(field, brief[field.id])) {
            questions.push({
                id: field.id,
                kind: field.kind,
                question: localize(field.questions, ctx.language),
            });
            break;
        }
    }

    return questions;
}

function briefFieldApplies(field, brief, ctx) {
    if (field.optionalWhen === 'repositoryContext') {
        return field.id in brief || repositoryContextLikely(ctx, brief);
    }

    return true;
}

function repositoryContextLikely(ctx, brief) {
    const text = [
        ctx.title,
        ctx.slug,
        ...(ctx.context ?? []),
        brief.topic,
        brief.goal,
        brief.readerTakeaway,
        brief.constraints,
    ]
        .filter(Boolean)
        .join(' ');

    if (!text) return false;
    if (parseRepositoryLinks(text).length > 0) return true;
    return REPOSITORY_CONTEXT_PATTERNS.some((pattern) => pattern.test(text));
}

function localize(messages, language) {
    return messages[language] ?? messages[DEFAULT_LANGUAGE] ?? messages.en;
}

function normalizeBrief(brief) {
    const normalized = {};
    if (!brief || typeof brief !== 'object') return normalized;

    for (const field of BRIEF_FIELDS) {
        if (!(field.id in brief)) continue;
        const value = brief[field.id];
        if (field.kind === 'list') {
            normalized[field.id] = Array.isArray(value)
                ? value.map((item) => String(item).trim()).filter(Boolean)
                : parseListValue(value);
        } else if (field.kind === 'repository') {
            const repository = normalizeRepositoryValue(value, { strict: false });
            if (repository) normalized[field.id] = repository;
        } else {
            const text = String(value ?? '').trim();
            if (text) normalized[field.id] = text;
        }
    }

    return normalized;
}

function briefValueMissing(field, value) {
    if (field.kind === 'list') return !Array.isArray(value) || value.length === 0;
    if (field.kind === 'repository') return !isRepositoryAnswer(value);
    return typeof value !== 'string' || value.trim().length === 0;
}

function findBriefField(id) {
    const field = BRIEF_FIELDS.find((candidate) => candidate.id === id);
    if (!field) {
        throw new Error(`Unknown brief field: ${id}. Supported: ${BRIEF_FIELDS.map((f) => f.id).join(', ')}`);
    }
    return field;
}

function parseBriefValue(field, raw) {
    if (field.kind === 'list') return parseListValue(raw);
    if (field.kind === 'repository') return normalizeRepositoryValue(raw, { strict: true });

    const value = String(raw ?? '').trim();
    if (!value) throw new Error(`Brief field ${field.id} cannot be empty`);
    return value;
}

function parseListValue(raw) {
    const items = Array.isArray(raw)
        ? raw
        : String(raw ?? '')
              .split(/[,;\n]/)
              .map((item) => item.trim());
    const cleaned = items.map((item) => String(item).trim()).filter(Boolean);
    if (cleaned.length === 0) throw new Error('List value cannot be empty');
    return cleaned;
}

function isRepositoryAnswer(value) {
    if (!value || typeof value !== 'object') return false;
    if (value.status === 'none') return true;
    return value.status === 'provided' && repositoryItems(value).length > 0;
}

function normalizeRepositoryValue(raw, options = {}) {
    if (Array.isArray(raw)) {
        const items = raw
            .flatMap((item) => parseRepositoryLinks(repositoryRawValue(item)))
            .filter(Boolean);
        if (items.length > 0) return buildRepositoryValue(items);
        if (options.strict) throw new Error(repositoryValueError());
        return null;
    }

    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
        if (raw.status === 'none') return { status: 'none' };
        if (raw.status === 'provided') {
            const items = repositoryItems(raw);
            if (items.length > 0) return buildRepositoryValue(items);
        }
        if (options.strict) throw new Error(repositoryValueError());
        return null;
    }

    const value = String(raw ?? '').trim();
    if (!value) {
        if (options.strict) throw new Error(repositoryValueError());
        return null;
    }

    if (NO_REPOSITORY_ANSWERS.has(value.toLowerCase())) {
        return { status: 'none' };
    }

    const parsed = parseRepositoryLinks(value);
    if (parsed.length > 0) return buildRepositoryValue(parsed);

    if (options.strict) throw new Error(repositoryValueError());
    return null;
}

function repositoryRawValue(value) {
    if (value && typeof value === 'object' && !Array.isArray(value)) return value.url ?? '';
    return value;
}

function repositoryItems(value) {
    if (!value || typeof value !== 'object' || value.status !== 'provided') return [];

    if (!Array.isArray(value.items)) return [];
    return dedupeRepositories(value.items.map((item) => parseRepositoryLink(item?.url ?? item)).filter(Boolean));
}

function buildRepositoryValue(items) {
    const unique = dedupeRepositories(items);
    return {
        status: 'provided',
        items: unique,
    };
}

function dedupeRepositories(items) {
    const seen = new Set();
    const unique = [];

    for (const item of items) {
        if (!item?.url) continue;
        const key = `${item.host}/${item.path}`.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        unique.push(item);
    }

    return unique;
}

function parseRepositoryLinks(value) {
    return dedupeRepositories(extractRepositoryCandidates(value).map(parseRepositoryLink).filter(Boolean));
}

function parseRepositoryLink(value) {
    const raw = stripRepositoryWrapper(String(value ?? '').trim());
    if (!raw) return null;

    const scpLike = raw.match(/^git@([^:\s]+):(.+)$/);
    if (scpLike) {
        const [, host, rawPath] = scpLike;
        const path = normalizeRepositoryPath(rawPath);
        if (path) {
            return {
                format: 'ssh',
                url: raw,
                host,
                path,
                name: path.split('/').at(-1),
            };
        }
    }

    try {
        const url = new URL(raw);
        if (url.protocol === 'https:') {
            const path = normalizeRepositoryPath(url.pathname);
            if (path) {
                return {
                    format: 'https',
                    url: raw,
                    host: url.host,
                    path,
                    name: path.split('/').at(-1),
                };
            }
        }

        if (url.protocol === 'ssh:') {
            const path = normalizeRepositoryPath(url.pathname);
            if (path) {
                return {
                    format: 'ssh',
                    url: raw,
                    host: url.host,
                    path,
                    name: path.split('/').at(-1),
                };
            }
        }
    } catch {
        // Fall through to strict error handling below.
    }

    return null;
}

function extractRepositoryCandidates(value) {
    const raw = String(value ?? '')
        .trim()
        .replace(/^<|>$/g, '');
    if (!raw) return [];

    const candidates = [];
    collectRepositoryMatches(candidates, raw, /\((https?:\/\/[^)\s]+|ssh:\/\/[^)\s]+)\)/gi, 1);
    collectRepositoryMatches(candidates, raw, /git@[^:\s]+:[^\s),;]+/gi, 0);
    collectRepositoryMatches(candidates, raw, /(?:https?:\/\/|ssh:\/\/)[^\s),;]+/gi, 0);

    if (candidates.length === 0) return [stripRepositoryWrapper(raw)];

    return candidates
        .sort((a, b) => a.index - b.index)
        .map((candidate) => candidate.value)
        .filter((candidate, index, list) => list.indexOf(candidate) === index);
}

function collectRepositoryMatches(candidates, raw, pattern, groupIndex) {
    for (const match of raw.matchAll(pattern)) {
        const value = match[groupIndex] ?? match[0];
        const offset = groupIndex > 0 ? match[0].indexOf(value) : 0;
        candidates.push({
            value: stripLinkPunctuation(value),
            index: match.index + offset,
        });
    }
}

function stripRepositoryWrapper(value) {
    return stripLinkPunctuation(
        String(value ?? '')
            .trim()
            .replace(/^<|>$/g, '')
            .replace(/^`|`$/g, ''),
    );
}

function stripLinkPunctuation(value) {
    return String(value ?? '').replace(/[),.;]+$/g, '');
}

function normalizeRepositoryPath(rawPath) {
    const segments = String(rawPath ?? '')
        .trim()
        .replace(/^\/+|\/+$/g, '')
        .split('/')
        .map((segment) => segment.trim())
        .filter(Boolean);

    if (segments.length < 2) return null;

    const last = segments.at(-1).replace(/\.git$/i, '');
    if (!last) return null;
    segments[segments.length - 1] = last;
    return segments.join('/');
}

function repositoryValueError() {
    return 'Repository answer must be "no" or one or more HTTPS/SSH repository URLs, for example https://github.com/org/repo or git@github.com:org/repo.git';
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
        $schema: STATE_SCHEMA_URL,
        schemaVersion: STATE_SCHEMA_VERSION,
        version: STATE_VERSION,
        createdAt: previous.createdAt ?? now,
        updatedAt: now,
        status,
        slug: ctx.slug,
        title: ctx.title ?? previous.title ?? null,
        language: ctx.language ?? previous.language ?? DEFAULT_LANGUAGE,
        articleDir: ctx.slug,
        files: ARTICLE_FILES.map((file) => file.dest),
        brief: normalizeBrief(previous.brief),
        briefUpdatedAt: previous.briefUpdatedAt ?? null,
    };

    const dir = stateDir(ctx.target);
    mkdirSync(dir, { recursive: true });
    writeFileSync(statePath(ctx.target, ctx.slug), `${JSON.stringify(next, null, 2)}\n`);
}

function writeBriefAnswer(ctx, field, value) {
    const now = new Date().toISOString();
    const previous = ctx.state ?? {};
    const brief = normalizeBrief(previous.brief);
    brief[field.id] = value;

    const next = {
        $schema: STATE_SCHEMA_URL,
        schemaVersion: STATE_SCHEMA_VERSION,
        version: STATE_VERSION,
        createdAt: previous.createdAt ?? now,
        updatedAt: now,
        status: previous.status ?? (ctx.complete ? 'applied' : 'started'),
        slug: ctx.slug,
        title: ctx.title ?? previous.title ?? null,
        language: ctx.language ?? previous.language ?? DEFAULT_LANGUAGE,
        articleDir: ctx.slug,
        files: ARTICLE_FILES.map((file) => file.dest),
        brief,
        briefUpdatedAt: now,
    };

    const dir = stateDir(ctx.target);
    mkdirSync(dir, { recursive: true });
    writeFileSync(statePath(ctx.target, ctx.slug), `${JSON.stringify(next, null, 2)}\n`);
}

function syncBriefToOutline(ctx, opts) {
    const brief = normalizeBrief(ctx.state?.brief);
    const outlinePath = join(ctx.articleDir, 'three-act-outline.md');
    const relPath = relative(ctx.target, outlinePath);

    if (!existsSync(outlinePath)) {
        return {
            path: relPath,
            action: 'missing',
        };
    }

    const current = readFileSync(outlinePath, 'utf8');
    const block = renderBriefBlock(brief, ctx.language);
    const next = upsertBriefBlock(current, block);

    if (current === next) {
        return {
            path: relPath,
            action: 'unchanged',
        };
    }

    if (!opts.dryRun) {
        writeFileSync(outlinePath, next);
    }

    return {
        path: relPath,
        action: opts.dryRun ? 'would-update' : 'updated',
    };
}

function renderBriefBlock(brief, language) {
    const title = localize(
        {
            en: '## Article Brief',
            ru: '## Бриф статьи',
        },
        language,
    );

    const lines = [title, ''];

    for (const field of BRIEF_FIELDS) {
        const value = brief[field.id];
        if (briefValueMissing(field, value)) continue;

        const label = localize(field.labels, language);
        lines.push(`- **${label}:** ${renderBriefValueMarkdown(field, value, language)}`);
    }

    if (lines.length === 2) {
        lines.push(
            localize(
                {
                    en: '_No brief answers saved yet._',
                    ru: '_Пока нет сохраненных ответов брифа._',
                },
                language,
            ),
        );
    }

    return `${BRIEF_BLOCK_START}\n${lines.join('\n')}\n${BRIEF_BLOCK_END}\n`;
}

function formatMarkdownInline(value) {
    return String(value)
        .trim()
        .replace(/\r?\n/g, '<br>');
}

function renderBriefValueMarkdown(field, value, language) {
    if (field.kind === 'repository') return formatRepositoryMarkdown(value, language);
    if (Array.isArray(value)) return value.join(', ');
    return formatMarkdownInline(value);
}

function renderBriefValueHuman(field, value, language = DEFAULT_LANGUAGE) {
    if (field.kind === 'repository') return formatRepositoryHuman(value, language);
    if (Array.isArray(value)) return value.join(', ');
    return String(value);
}

function formatRepositoryMarkdown(value, language) {
    if (value?.status === 'none') {
        return localize({ en: 'no repository', ru: 'нет' }, language);
    }

    const items = repositoryItems(value);
    if (items.length > 0) return items.map(formatRepositoryItemMarkdown).join('<br>');

    return '';
}

function formatRepositoryItemMarkdown(item) {
    if (item.format === 'https') {
        const label = item.path ? `${item.host}/${item.path}` : item.url;
        return `[${formatMarkdownInline(label)}](${item.url})`;
    }

    return `\`${String(item.url ?? '').replace(/`/g, '\\`')}\``;
}

function formatRepositoryHuman(value, language) {
    if (value?.status === 'none') return localize({ en: 'no repository', ru: 'нет' }, language);
    const items = repositoryItems(value);
    if (items.length > 0) return items.map((item) => item.url).join(', ');
    return '';
}

function upsertBriefBlock(content, block) {
    const start = content.indexOf(BRIEF_BLOCK_START);
    const end = content.indexOf(BRIEF_BLOCK_END);

    if (start !== -1 && end !== -1 && end > start) {
        const afterEnd = end + BRIEF_BLOCK_END.length;
        const before = content.slice(0, start).replace(/\s*$/, '\n\n');
        const after = content.slice(afterEnd).replace(/^\s*/, '\n');
        return `${before}${block}${after}`;
    }

    const titleMatch = content.match(/^# .*(?:\r?\n){1,2}/);
    if (!titleMatch) return `${block}\n${content}`;

    const insertAt = titleMatch[0].length;
    const before = content.slice(0, insertAt).replace(/\s*$/, '\n\n');
    const after = content.slice(insertAt).replace(/^\s*/, '');
    return `${before}${block}\n${after}`;
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
  node <SKILL_DIR>/scripts/${scriptName} [--target <path>] [--slug <slug>] [--title <title>] [--thread-title <title>] [--context <text>] [--language ru|en] [--dry-run] [--force] [--new] [--json]

Flags:
  --target <path>    Article workspace root; default is current working directory
  --slug <slug>      Article folder name; unsafe characters are normalized
  --title <title>    Article title for index.md and three-act-outline.md
  --thread-title <t> Current IDE thread/chat title; used to recover an existing article slug
  --chat-title <t>   Alias for --thread-title
  --context <text>   Extra article/chat context for conditional brief questions; may be repeated
  --language ru|en   Template language; default is ru
  --dry-run          Show intended changes without writing article files
  --force            Overwrite conflicting article files instead of writing *.new suggestions
  --new              Ignore saved state; still recover slug from --thread-title when folder exists
  --json             Print machine-readable JSON
  --help             Show this help${extra ? `\n\n${extra}` : ''}
`);
}

export function printBriefUsage(scriptName, extra = '') {
    console.log(`Usage:
  node <SKILL_DIR>/scripts/${scriptName} [--target <path>] [--slug <slug>] [--thread-title <title>] [--context <text>] [--field <id>] [--value <answer>] [--json]

Flags:
  --target <path>    Article workspace root; default is current working directory
  --slug <slug>      Article folder name; unsafe characters are normalized
  --thread-title <t> Current IDE thread/chat title; used to recover an existing article slug
  --chat-title <t>   Alias for --thread-title
  --context <text>   Extra article/chat context for conditional brief questions; may be repeated
  --field <id>       Brief field to save (brief-answer.mjs only)
  --value <answer>   Answer value to save (brief-answer.mjs only)
  --json             Print machine-readable JSON
  --help             Show this help${extra ? `\n\n${extra}` : ''}

Brief fields:
${BRIEF_FIELDS.map((field) => `  - ${field.id}${briefFieldUsageSuffix(field)}`).join('\n')}
`);
}

function briefFieldUsageSuffix(field) {
    if (field.kind === 'list') return ' (comma-separated list)';
    if (field.kind === 'repository') return ' (one or more HTTPS/SSH URLs, or no)';
    return '';
}

export function finish(report, opts, humanPrinter) {
    if (opts.json) {
        console.log(JSON.stringify(report, null, 2));
    } else {
        humanPrinter(report);
    }
}

export function printBriefReport(report) {
    console.log(`Article brief: ${report.action}`);
    console.log(`Target: ${report.target}`);
    if (report.slug) console.log(`Slug: ${report.slug}`);
    if (report.title) console.log(`Title: ${report.title}`);

    if (Object.keys(report.brief ?? {}).length > 0) {
        console.log('');
        console.log('Brief:');
        for (const field of BRIEF_FIELDS) {
            const value = report.brief[field.id];
            if (value === undefined) continue;
            const rendered = renderBriefValueHuman(field, value, report.language);
            console.log(`- ${field.id}: ${rendered}`);
        }
    }

    if (report.markdown) {
        console.log('');
        console.log(`Markdown: ${report.markdown.action}: ${report.markdown.path}`);
    }

    if (report.currentQuestion) {
        console.log('');
        console.log('Question:');
        console.log(`- ${report.currentQuestion.id}: ${report.currentQuestion.question}`);
    }

    if (report.next?.recommendation) {
        console.log('');
        console.log(`Next: ${report.next.recommendation}`);
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
