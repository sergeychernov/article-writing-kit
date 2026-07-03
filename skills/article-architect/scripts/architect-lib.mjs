import {
    existsSync,
    mkdirSync,
    readdirSync,
    readFileSync,
    writeFileSync,
} from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';

export const SKILL_NAME = 'article-architect';
export const STATE_SCHEMA_VERSION = 1;
export const STATE_VERSION = 1;
export const STATE_SCHEMA_URL =
    'https://raw.githubusercontent.com/sergeychernov/article-writing-kit/main/skills/article-architect/assets/schemas/architect-state.schema.json';

const ACT_FILES = {
    act1: 'act-1-setup.md',
    act2: 'act-2-investigation.md',
    act3: 'act-3-resolution.md',
};

const BRIEF_MARKER_START = '<!-- article-kit:brief:start -->';
const BRIEF_MARKER_END = '<!-- article-kit:brief:end -->';

const TEXT = {
    ru: {
        slugQuestion: 'Какой slug статьи использовать для архитектуры?',
        missingBrief: 'Сначала заверши бриф статьи через article-scaffold.',
        planTitle: 'План статьи',
        formula: 'Короткая формула статьи',
        actStructure: 'Краткая структура по актам',
        recommendedOrder: 'Рекомендуемый порядок блоков',
        act1: 'Акт 1',
        act2: 'Акт 2',
        act3: 'Акт 3',
        file: 'Файл',
        workingPurpose: 'Рабочее назначение',
        mustKeep: 'Что должно остаться',
        keyQuestion: 'Ключевой вопрос акта',
        ending: 'Подходящий финал акта',
        climax: 'Кульминация',
        resolution: 'Развязка',
        pain: 'Боль',
        investigation: 'Расследование / осложнение',
        final: 'Развязка',
        briefTitle: 'Бриф статьи',
        topic: 'Тема',
        goal: 'Цель',
        repository: 'Релевантные репозитории',
        audience: 'Аудитория',
        publicationTargets: 'Площадки публикации',
        readerTakeaway: 'Что унесет читатель',
        constraints: 'Ограничения и важные детали',
        noRepository: 'нет',
    },
    en: {
        slugQuestion: 'Which article slug should I use for architecture?',
        missingBrief: 'Complete the article brief with article-scaffold first.',
        planTitle: 'Article Plan',
        formula: 'Short Article Formula',
        actStructure: 'Brief Three-Act Structure',
        recommendedOrder: 'Recommended Block Order',
        act1: 'Act 1',
        act2: 'Act 2',
        act3: 'Act 3',
        file: 'File',
        workingPurpose: 'Working Purpose',
        mustKeep: 'Must Keep',
        keyQuestion: 'Act Key Question',
        ending: 'Suitable Act Ending',
        climax: 'Climax',
        resolution: 'Resolution',
        pain: 'Pain',
        investigation: 'Investigation / Complication',
        final: 'Resolution',
        briefTitle: 'Article Brief',
        topic: 'Topic',
        goal: 'Goal',
        repository: 'Relevant Repositories',
        audience: 'Audience',
        publicationTargets: 'Publication Targets',
        readerTakeaway: 'Reader Takeaway',
        constraints: 'Constraints and Important Details',
        noRepository: 'no',
    },
};

export function parseArgs(argv = process.argv.slice(2)) {
    const opts = {
        target: '.',
        slug: null,
        threadTitle: null,
        language: null,
        input: null,
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
        } else if (arg === '--input') {
            opts.input = requireValue(argv, (i += 1), arg);
        } else if (arg.startsWith('--')) {
            throw new Error(`Unknown flag: ${arg}`);
        } else {
            throw new Error(`Unexpected argument: ${arg}`);
        }
    }

    return opts;
}

export function printUsage(command) {
    const inputLine =
        command === 'architect-apply.mjs'
            ? ' [--input <path|-] [--force] [--dry-run]'
            : '';
    console.log(`Usage:
  node <SKILL_DIR>/scripts/${command} [--target <path>] [--slug <slug>] [--thread-title <title>]${inputLine} [--json]

Flags:
  --target <path>    Article workspace root; default is current working directory
  --slug <slug>      Article folder name; unsafe characters are normalized
  --thread-title <t> Current IDE thread/chat title; used to recover an article slug
  --chat-title <t>   Alias for --thread-title
  --language ru|en   Output language when scaffold state cannot provide it
  --input <path|->   Architecture JSON input for architect-apply.mjs
  --dry-run          Show intended changes without writing files
  --force            Overwrite an outline that already contains manual content
  --json             Print machine-readable JSON
  --help             Show this help
`);
}

export function buildContext(opts = {}) {
    const target = resolve(process.cwd(), opts.target || '.');
    const scaffoldDir = join(target, '.article-kit', 'scaffold');
    const architectDir = join(target, '.article-kit', 'architect');
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
    const existingArchitectStatePath = slug ? join(architectDir, `${slug}.json`) : null;
    const existingArchitectState = existingArchitectStatePath
        ? readJson(existingArchitectStatePath)
        : null;
    const title =
        stringOrNull(scaffoldState?.title) ||
        (articleDir ? readTitleFromIndex(join(articleDir, 'index.md')) : null) ||
        slug;
    const language = normalizeLanguage(opts.language || scaffoldState?.language || 'ru');
    const brief = scaffoldState?.brief && typeof scaffoldState.brief === 'object'
        ? scaffoldState.brief
        : {};
    const briefBlock = extractBriefBlock(outline);
    const outlineAnalysis = analyzeOutline(outline);

    return {
        skill: SKILL_NAME,
        stateSchema: STATE_SCHEMA_URL,
        stateSchemaVersion: STATE_SCHEMA_VERSION,
        target,
        scaffoldDir,
        architectDir,
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
        outlineAnalysis,
        scaffoldStatePath,
        scaffoldState,
        scaffoldStatus: scaffoldState ? scaffoldState.status : null,
        brief,
        briefBlock,
        briefComplete: isBriefComplete(brief),
        existingArchitectStatePath,
        existingArchitectState,
        architectureComplete: Boolean(existingArchitectState?.architecture),
        suggestedInputPath: slug ? join(architectDir, `${slug}.draft.json`) : null,
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

    return publicContext(ctx, {
        phase: 'architect',
        action: ctx.slug ? 'status' : 'needs_input',
        currentQuestion,
        ready: Boolean(ctx.slug && ctx.articleExists && ctx.briefComplete),
        complete: ctx.architectureComplete,
        files: fileStatus(ctx),
        next: nextStep(ctx),
    });
}

export function createPrepareResponse(ctx) {
    if (!ctx.slug) {
        return publicContext(ctx, {
            phase: 'architect',
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

    if (!ctx.briefComplete) {
        return publicContext(ctx, {
            phase: 'architect',
            action: 'needs_brief',
            currentQuestion: null,
            ready: false,
            complete: false,
            files: fileStatus(ctx),
            message: labels(ctx.language).missingBrief,
            missingBriefFields: missingBriefFields(ctx.brief),
            next: {
                recommendation: 'Run article-scaffold brief-resume and complete the brief first.',
            },
        });
    }

    return publicContext(ctx, {
        phase: 'architect',
        action: ctx.architectureComplete ? 'architecture_exists' : 'prepare_architecture',
        ready: true,
        complete: ctx.architectureComplete,
        files: fileStatus(ctx),
        brief: ctx.brief,
        briefMarkdown: ctx.briefBlock,
        existingArchitecture: ctx.existingArchitectState?.architecture || null,
        outputContract: architectureOutputContract(ctx.language),
        suggestedInputPath: rel(ctx.target, ctx.suggestedInputPath),
        instructions: [
            'Create an architecture JSON object that matches outputContract.architecture.',
            'Write it to suggestedInputPath, then run architect-apply.mjs --input <that file> --json.',
            'Do not write prose into article files directly; let architect-apply.mjs validate and synchronize.',
        ],
    });
}

export function applyArchitecture(ctx, opts) {
    if (!ctx.slug) {
        return publicContext(ctx, {
            phase: 'architect',
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

    if (!ctx.briefComplete) {
        return publicContext(ctx, {
            phase: 'architect',
            action: 'needs_brief',
            ready: false,
            complete: false,
            files: fileStatus(ctx),
            message: labels(ctx.language).missingBrief,
            missingBriefFields: missingBriefFields(ctx.brief),
        });
    }

    const input = readArchitectureInput(opts, ctx);
    const architecture = normalizeArchitecture(input);
    const now = new Date().toISOString();
    const statePath = join(ctx.architectDir, `${ctx.slug}.json`);
    const newState = {
        $schema: STATE_SCHEMA_URL,
        schemaVersion: STATE_SCHEMA_VERSION,
        version: STATE_VERSION,
        generatedBy: SKILL_NAME,
        createdAt: ctx.existingArchitectState?.createdAt || now,
        updatedAt: now,
        slug: ctx.slug,
        title: ctx.title,
        language: ctx.language,
        articleDir: ctx.slug,
        outline: 'three-act-outline.md',
        source: {
            scaffoldState: ctx.scaffoldStatePath ? rel(ctx.target, ctx.scaffoldStatePath) : null,
            scaffoldUpdatedAt: ctx.scaffoldState?.updatedAt || null,
            briefUpdatedAt: ctx.scaffoldState?.briefUpdatedAt || null,
        },
        brief: ctx.brief,
        architecture,
    };
    const outlineText = renderOutline(ctx, architecture);
    const outlineHasManualContent = ctx.outlineAnalysis.manualContent;
    const shouldWriteOutline = !outlineHasManualContent || opts.force;
    const suggestionPath = ctx.outlinePath ? `${ctx.outlinePath}.new` : null;
    const targetOutlinePath = shouldWriteOutline ? ctx.outlinePath : suggestionPath;

    const actions = [];
    if (opts.dryRun) {
        actions.push({ path: rel(ctx.target, statePath), status: 'would-write' });
        actions.push({
            path: rel(ctx.target, targetOutlinePath),
            status: shouldWriteOutline ? 'would-write' : 'would-write-suggestion',
        });
    } else {
        mkdirSync(ctx.architectDir, { recursive: true });
        writeJson(statePath, newState);
        actions.push({ path: rel(ctx.target, statePath), status: 'written' });
        if (!ctx.outlinePath) {
            throw new Error('Cannot write outline: article folder was not resolved');
        }
        writeFileSync(targetOutlinePath, outlineText, 'utf8');
        actions.push({
            path: rel(ctx.target, targetOutlinePath),
            status: shouldWriteOutline ? 'written' : 'suggestion-written',
        });
    }

    return publicContext(ctx, {
        phase: 'architect',
        action: opts.dryRun ? 'dry_run' : 'applied',
        ready: true,
        complete: true,
        files: fileStatus(ctx),
        outlineSync: shouldWriteOutline ? 'updated' : 'suggestion',
        outlineManualContent: outlineHasManualContent,
        force: opts.force,
        dryRun: opts.dryRun,
        actions,
        architecture,
        statePath: rel(ctx.target, statePath),
        outlinePath: rel(ctx.target, targetOutlinePath),
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
    const lines = [];
    lines.push(`Article architect: ${result.slug || 'slug required'}`);
    lines.push(`Status: ${result.action}`);
    if (result.currentQuestion) lines.push(`Question: ${result.currentQuestion.question}`);
    if (result.files?.outline) lines.push(`Outline: ${result.files.outline.path} (${result.files.outline.status})`);
    if (result.complete) lines.push('Architecture state exists.');
    if (result.next?.recommendation) lines.push(`Next: ${result.next.recommendation}`);
    return lines.join('\n');
}

export function formatPrepareHuman(result) {
    const lines = [];
    lines.push(`Article architect prepare: ${result.slug || 'slug required'}`);
    lines.push(`Action: ${result.action}`);
    if (result.currentQuestion) lines.push(result.currentQuestion.question);
    if (result.message) lines.push(result.message);
    if (result.suggestedInputPath) lines.push(`Suggested input: ${result.suggestedInputPath}`);
    if (result.outputContract) lines.push('Output contract is available with --json.');
    return lines.join('\n');
}

export function formatApplyHuman(result) {
    const lines = [];
    lines.push(`Article architect apply: ${result.slug || 'slug required'}`);
    lines.push(`Action: ${result.action}`);
    for (const action of result.actions || []) {
        lines.push(`- ${action.status}: ${action.path}`);
    }
    if (result.outlineSync === 'suggestion') {
        lines.push('Outline had manual content; wrote a .new suggestion instead of overwriting.');
    }
    return lines.join('\n');
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

function labels(language) {
    return TEXT[normalizeLanguage(language)];
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
        const hasMatchingState = discoveredStates.some((state) => state.slug === threadSlug);
        const hasMatchingFolder = existsSync(join(target, threadSlug));
        if (hasMatchingState || hasMatchingFolder) {
            return { slug: threadSlug, source: 'thread-title' };
        }
    }

    const cwdSlug = normalizeSlug(basename(process.cwd()));
    if (cwdSlug) {
        const hasMatchingState = discoveredStates.some((state) => state.slug === cwdSlug);
        const hasMatchingFolder = existsSync(join(target, cwdSlug));
        if (hasMatchingState || hasMatchingFolder) {
            return { slug: cwdSlug, source: 'cwd' };
        }
    }

    if (discoveredStates.length === 1) {
        return { slug: discoveredStates[0].slug, source: 'single-state' };
    }

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

function stringOrNull(value) {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
}

function readTitleFromIndex(indexPath) {
    if (!existsSync(indexPath)) return null;
    const text = readFileSync(indexPath, 'utf8');
    const heading = text.match(/^#\s+(.+)$/m);
    if (heading) return heading[1].trim();
    const title = text.match(/^title:\s*["']?(.+?)["']?\s*$/m);
    return title ? title[1].trim() : null;
}

function extractBriefBlock(outline) {
    if (!outline) return '';
    const start = outline.indexOf(BRIEF_MARKER_START);
    const end = outline.indexOf(BRIEF_MARKER_END);
    if (start === -1 || end === -1 || end < start) return '';
    return outline.slice(start, end + BRIEF_MARKER_END.length).trim();
}

function stripBriefBlock(outline) {
    if (!outline) return '';
    const start = outline.indexOf(BRIEF_MARKER_START);
    const end = outline.indexOf(BRIEF_MARKER_END);
    if (start === -1 || end === -1 || end < start) return outline;
    return `${outline.slice(0, start)}${outline.slice(end + BRIEF_MARKER_END.length)}`;
}

function analyzeOutline(outline) {
    if (!outline) {
        return {
            exists: false,
            manualContent: false,
            hasBriefBlock: false,
            hasArchitectureContent: false,
        };
    }

    const body = stripBriefBlock(outline);
    const meaningfulLines = body
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !isPlaceholderLine(line));

    return {
        exists: true,
        manualContent: meaningfulLines.length > 0,
        hasBriefBlock: Boolean(extractBriefBlock(outline)),
        hasArchitectureContent: meaningfulLines.length > 0,
    };
}

function isPlaceholderLine(line) {
    if (/^#{1,6}\s+/.test(line)) return true;
    if (/^<!--.*-->$/.test(line)) return true;
    if (/^(Файл|File):\s*`[^`]+`$/.test(line)) return true;
    if (/^-\s*\[\s*\]\s*$/.test(line)) return true;
    if (/^\d+\.\s*$/.test(line)) return true;
    if (/^\d+\.\s*.+\s*->$/.test(line)) return true;
    return false;
}

function isBriefComplete(brief) {
    for (const field of ['topic', 'goal', 'audience', 'readerTakeaway', 'constraints']) {
        if (!stringOrNull(brief?.[field])) return false;
    }
    return Array.isArray(brief?.publicationTargets) && brief.publicationTargets.length > 0;
}

function missingBriefFields(brief) {
    const missing = [];
    for (const field of ['topic', 'goal', 'audience', 'publicationTargets', 'readerTakeaway', 'constraints']) {
        if (field === 'publicationTargets') {
            if (!Array.isArray(brief?.publicationTargets) || brief.publicationTargets.length === 0) {
                missing.push(field);
            }
        } else if (!stringOrNull(brief?.[field])) {
            missing.push(field);
        }
    }
    return missing;
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
        briefComplete: ctx.briefComplete,
        architectureComplete: ctx.architectureComplete,
        discoveredStates: ctx.discoveredStates.map((state) => ({
            slug: state.slug,
            title: state.title,
            language: state.language,
            status: state.status,
            updatedAt: state.updatedAt,
        })),
        ...extra,
    };
}

function fileStatus(ctx) {
    return {
        articleDir: ctx.articleDir
            ? {
                  path: rel(ctx.target, ctx.articleDir),
                  exists: ctx.articleExists,
              }
            : null,
        outline: ctx.outlinePath
            ? {
                  path: rel(ctx.target, ctx.outlinePath),
                  exists: existsSync(ctx.outlinePath),
                  status: existsSync(ctx.outlinePath) ? 'existing' : 'missing',
                  manualContent: ctx.outlineAnalysis.manualContent,
                  hasBriefBlock: ctx.outlineAnalysis.hasBriefBlock,
              }
            : null,
        architectState: ctx.existingArchitectStatePath
            ? {
                  path: rel(ctx.target, ctx.existingArchitectStatePath),
                  exists: existsSync(ctx.existingArchitectStatePath),
              }
            : null,
    };
}

function nextStep(ctx) {
    if (!ctx.slug) return { recommendation: 'Provide article slug.' };
    if (!ctx.briefComplete) return { recommendation: 'Complete article-scaffold brief first.' };
    if (!ctx.architectureComplete) return { recommendation: 'Run architect-prepare, generate architecture JSON, then run architect-apply.' };
    return { recommendation: 'Use the filled three-act-outline.md as context for drafting lead and acts.' };
}

function architectureOutputContract(language) {
    return {
        schema: STATE_SCHEMA_URL,
        architecture: {
            formula: '1-3 sentences that compress the full article promise and arc.',
            actSummaries: {
                act1: 'One line: pain -> turn -> consequence.',
                act2: 'One line: investigation/complication -> discovery -> consequence.',
                act3: 'One line: resolution -> result -> reader action.',
            },
            recommendedOrder: [
                'Opening block or scene',
                'Next block',
                'Continue until the publishable reading order is clear',
            ],
            acts: {
                act1: {
                    workingPurpose: 'What Act 1 must do to the reader.',
                    mustKeep: ['Facts, scenes, constraints, or examples that must survive edits.'],
                    keyQuestion: 'The single question Act 1 answers.',
                    ending: 'Transition or turn that hands the story to Act 2.',
                },
                act2: {
                    workingPurpose: 'What Act 2 must do to the reader.',
                    mustKeep: ['Facts, scenes, constraints, or examples that must survive edits.'],
                    keyQuestion: 'The single question Act 2 answers.',
                    climax: 'Peak discovery, complication, or proof.',
                },
                act3: {
                    workingPurpose: 'What Act 3 must do to the reader.',
                    mustKeep: ['Facts, scenes, constraints, or examples that must survive edits.'],
                    keyQuestion: 'The single question Act 3 answers.',
                    resolution: 'Final answer, practical outcome, or reader next step.',
                },
            },
            gaps: ['Optional: missing information that future agents should ask or research.'],
            assumptions: ['Optional: assumptions made while designing the structure.'],
        },
        language: normalizeLanguage(language),
    };
}

function readArchitectureInput(opts, ctx) {
    let raw = null;
    if (opts.input) {
        raw = opts.input === '-' ? readFileSync(0, 'utf8') : readFileSync(resolve(ctx.target, opts.input), 'utf8');
    } else if (!process.stdin.isTTY) {
        raw = readFileSync(0, 'utf8');
    } else {
        throw new Error(
            `Missing architecture JSON input. Use --input <path> or write ${rel(ctx.target, ctx.suggestedInputPath)} and pass it to --input.`
        );
    }
    if (!String(raw).trim()) {
        throw new Error(
            `Missing architecture JSON input. Use --input <path> or write ${rel(ctx.target, ctx.suggestedInputPath)} and pass it to --input.`
        );
    }
    try {
        return JSON.parse(raw);
    } catch (error) {
        throw new Error(`Architecture input is not valid JSON: ${error.message}`);
    }
}

function normalizeArchitecture(input) {
    const value = input?.architecture && typeof input.architecture === 'object' ? input.architecture : input;
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error('Architecture input must be an object.');
    }

    const architecture = {
        formula: requireText(value.formula, 'formula'),
        actSummaries: {
            act1: requireText(value.actSummaries?.act1, 'actSummaries.act1'),
            act2: requireText(value.actSummaries?.act2, 'actSummaries.act2'),
            act3: requireText(value.actSummaries?.act3, 'actSummaries.act3'),
        },
        recommendedOrder: requireStringArray(value.recommendedOrder, 'recommendedOrder'),
        acts: {
            act1: normalizeAct(value.acts?.act1, 'acts.act1', 'ending'),
            act2: normalizeAct(value.acts?.act2, 'acts.act2', 'climax'),
            act3: normalizeAct(value.acts?.act3, 'acts.act3', 'resolution'),
        },
        gaps: optionalStringArray(value.gaps, 'gaps'),
        assumptions: optionalStringArray(value.assumptions, 'assumptions'),
    };

    return architecture;
}

function normalizeAct(value, path, terminalField) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error(`${path} must be an object.`);
    }
    return {
        workingPurpose: requireText(value.workingPurpose, `${path}.workingPurpose`),
        mustKeep: requireStringArray(value.mustKeep, `${path}.mustKeep`),
        keyQuestion: requireText(value.keyQuestion, `${path}.keyQuestion`),
        [terminalField]: requireText(value[terminalField], `${path}.${terminalField}`),
    };
}

function requireText(value, path) {
    const text = stringOrNull(value);
    if (!text) throw new Error(`${path} must be a non-empty string.`);
    return text;
}

function requireStringArray(value, path) {
    if (!Array.isArray(value)) throw new Error(`${path} must be an array.`);
    const result = value.map((item) => stringOrNull(item)).filter(Boolean);
    if (result.length === 0) throw new Error(`${path} must contain at least one non-empty string.`);
    return result;
}

function optionalStringArray(value, path) {
    if (value == null) return [];
    if (!Array.isArray(value)) throw new Error(`${path} must be an array when provided.`);
    return value.map((item) => stringOrNull(item)).filter(Boolean);
}

function renderOutline(ctx, architecture) {
    const l = labels(ctx.language);
    const briefBlock = renderBriefBlock(ctx.brief, ctx.language) || ctx.briefBlock;
    const parts = [
        `# ${l.planTitle}: ${ctx.title}`,
        '',
    ];
    if (briefBlock) {
        parts.push(briefBlock.trim(), '');
    }
    parts.push(
        `## ${l.formula}`,
        '',
        architecture.formula,
        '',
        `## ${l.actStructure}`,
        '',
        `1. ${l.pain} -> ${architecture.actSummaries.act1}`,
        `2. ${l.investigation} -> ${architecture.actSummaries.act2}`,
        `3. ${l.final} -> ${architecture.actSummaries.act3}`,
        '',
        `## ${l.recommendedOrder}`,
        '',
        orderedList(architecture.recommendedOrder),
        '',
        renderAct(l.act1, ACT_FILES.act1, architecture.acts.act1, l, 'ending'),
        '',
        renderAct(l.act2, ACT_FILES.act2, architecture.acts.act2, l, 'climax'),
        '',
        renderAct(l.act3, ACT_FILES.act3, architecture.acts.act3, l, 'resolution'),
        ''
    );

    return `${parts.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd()}\n`;
}

function renderAct(title, file, act, l, terminalField) {
    const terminalLabel =
        terminalField === 'ending' ? l.ending : terminalField === 'climax' ? l.climax : l.resolution;
    return [
        `## ${title}`,
        '',
        `${l.file}: \`${file}\``,
        '',
        `### ${l.workingPurpose}`,
        '',
        act.workingPurpose,
        '',
        `### ${l.mustKeep}`,
        '',
        checklist(act.mustKeep),
        '',
        `### ${l.keyQuestion}`,
        '',
        act.keyQuestion,
        '',
        `### ${terminalLabel}`,
        '',
        act[terminalField],
    ].join('\n');
}

function orderedList(items) {
    return items.map((item, index) => `${index + 1}. ${item}`).join('\n');
}

function checklist(items) {
    return items.map((item) => `- [ ] ${item}`).join('\n');
}

function renderBriefBlock(brief, language) {
    if (!brief || Object.keys(brief).length === 0) return '';
    const l = labels(language);
    const rows = [
        ['topic', l.topic, brief.topic],
        ['goal', l.goal, brief.goal],
        ['repository', l.repository, formatRepository(brief.repository, language)],
        ['audience', l.audience, brief.audience],
        ['publicationTargets', l.publicationTargets, Array.isArray(brief.publicationTargets) ? brief.publicationTargets.join(', ') : ''],
        ['readerTakeaway', l.readerTakeaway, brief.readerTakeaway],
        ['constraints', l.constraints, brief.constraints],
    ]
        .map(([, label, value]) => [label, stringOrNull(value)])
        .filter(([, value]) => value)
        .map(([label, value]) => `- **${label}:** ${String(value).replace(/\n/g, '<br>')}`);

    if (rows.length === 0) return '';
    return [
        BRIEF_MARKER_START,
        `## ${l.briefTitle}`,
        '',
        rows.join('\n'),
        BRIEF_MARKER_END,
    ].join('\n');
}

function formatRepository(repository, language) {
    const l = labels(language);
    if (!repository || repository.status === 'none') return l.noRepository;
    if (!Array.isArray(repository.items)) return '';
    return repository.items
        .map((item) => {
            const url = stringOrNull(item.url);
            if (!url) return null;
            const label = stringOrNull(item.path) || url;
            return `[${label}](${url})`;
        })
        .filter(Boolean)
        .join('<br>');
}

function rel(root, path) {
    if (!path) return null;
    const value = relative(root, path);
    return value && !value.startsWith('..') ? value : path;
}
