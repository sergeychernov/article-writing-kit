// article-ai-signs: structural / style heuristics on Markdown.
//
// Title case headings (EN), boldface overuse, inline-header vertical lists,
// emoji-as-formatting, thematic breaks before headings, skipped heading
// levels, unusually small tables, and rule-of-three (low confidence).

import { newMarker, addMatch, finalize } from './check-util.mjs';

const HEADING_RE = /^(#{1,6})\s+(\S.*)$/;
const BOLD_RE = /\*\*[^*\n]+\*\*/g;
const THEMATIC_RE = /^\s*(-{3,}|\*{3,}|_{3,}|----)\s*$/;
const TABLE_SEP_RE = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?\s*$/;
const CYRILLIC_RE = /[\u0400-\u04FF]/;
const EN_STOPWORDS = new Set([
    'a', 'an', 'the', 'and', 'or', 'nor', 'but', 'of', 'to', 'in', 'on', 'for',
    'with', 'as', 'at', 'by', 'vs', 'via', 'per', 'from', 'into', 'over', 'up',
    'is', 'are',
]);

export function runStructureChecks(files, assets, helpers) {
    const config = helpers.config || {};
    const markers = [
        checkTitleCase(files, helpers, config),
        checkBoldOveruse(files, helpers, config),
        checkInlineHeaderList(files, helpers, config),
        checkEmojiFormatting(files, helpers, config),
        checkThematicBreakBeforeHeading(files, helpers, config),
        checkSkipHeadingLevel(files, helpers),
        checkSmallTables(files, helpers, config),
        checkRuleOfThree(files, helpers, config),
    ];
    return finalize(markers);
}

function checkTitleCase(files, helpers, config) {
    const cfg = config.titleCaseHeading || {};
    const minMainWords = cfg.minMainWords || 3;
    const marker = newMarker({
        id: 'style.title-case-heading',
        category: 'style',
        title: 'Title Case headings (English)',
        wpShortcut: 'WP:AITITLECASE',
        severity: 'medium',
        weight: 2,
        note: 'AI chatbots tend to capitalize all main words in section headings. English-only heuristic.',
    });

    for (const file of files) {
        for (let i = 0; i < file.lines.length; i += 1) {
            const m = file.lines[i].match(HEADING_RE);
            if (!m) continue;
            const text = m[2].trim();
            if (CYRILLIC_RE.test(text)) continue;
            const words = text.split(/\s+/).filter((w) => /[A-Za-z]/.test(w));
            const mainWords = words.filter((w) => !EN_STOPWORDS.has(w.toLowerCase()));
            if (mainWords.length < minMainWords) continue;
            const allCapitalized = mainWords.every((w) => /^[^A-Za-z]*[A-Z]/.test(w));
            if (allCapitalized) addMatch(marker, helpers, file, i, text, file.lines[i]);
        }
    }
    return marker;
}

function checkBoldOveruse(files, helpers, config) {
    const cfg = config.boldOveruse || {};
    const fileThreshold = cfg.minBoldSpansPerFile || 8;
    const paraThreshold = cfg.minBoldSpansPerParagraph || 3;
    const marker = newMarker({
        id: 'style.bold-overuse',
        category: 'style',
        title: 'Overuse of boldface',
        wpShortcut: 'WP:AIBOLD',
        severity: 'low',
        weight: 2,
        note: 'Mechanical emphasis of many phrases in bold, key-takeaways style.',
    });

    for (const file of files) {
        let fileTotal = 0;
        const lineCounts = [];
        for (let i = 0; i < file.lines.length; i += 1) {
            const matches = file.lines[i].match(BOLD_RE);
            const count = matches ? matches.length : 0;
            if (count > 0) lineCounts.push({ i, count });
            fileTotal += count;
        }
        if (fileTotal < fileThreshold && !lineCounts.some((l) => l.count >= paraThreshold)) continue;
        for (const { i, count } of lineCounts) {
            addMatch(marker, helpers, file, i, `${count} bold spans`, file.lines[i]);
        }
    }
    return marker;
}

function checkInlineHeaderList(files, helpers, config) {
    const cfg = config.inlineHeaderList || {};
    const minItems = cfg.minItems || 3;
    // Bold inline header followed by a colon, either "**Header**:" or "**Header:**".
    const colonAfter = /^\s*(?:[-*•–]|#|\d+[.)])\s+\*\*[^*\n]+\*\*\s*:/;
    const colonInside = /^\s*(?:[-*•–]|#|\d+[.)])\s+\*\*[^*\n]*:\s*\*\*/;
    const marker = newMarker({
        id: 'style.inline-header-list',
        category: 'style',
        title: 'Inline-header vertical lists',
        wpShortcut: 'WP:AILIST',
        severity: 'medium',
        weight: 3,
        note: 'List items with a bold inline header followed by a colon and descriptive text.',
    });

    for (const file of files) {
        const hits = [];
        for (let i = 0; i < file.lines.length; i += 1) {
            if (colonAfter.test(file.lines[i]) || colonInside.test(file.lines[i])) hits.push(i);
        }
        if (hits.length < minItems) continue;
        for (const i of hits) addMatch(marker, helpers, file, i, null, file.lines[i]);
    }
    return marker;
}

function checkEmojiFormatting(files, helpers, config) {
    const cfg = config.emojiFormatting || {};
    const minCount = cfg.minCount || 1;
    let emojiAtStart;
    try {
        emojiAtStart = new RegExp('^\\s*(?:[-*•]\\s*|#{1,6}\\s*)?\\p{Extended_Pictographic}', 'u');
    } catch {
        emojiAtStart = /^\s*(?:[-*•]\s*|#{1,6}\s*)?[\u2190-\u2BFF\u{1F000}-\u{1FAFF}]/u;
    }
    const marker = newMarker({
        id: 'style.emoji-formatting',
        category: 'style',
        title: 'Emoji as formatting',
        wpShortcut: 'WP:AIEMOJI',
        severity: 'medium',
        weight: 3,
        note: 'Emoji decorating section headings or bullet points.',
    });

    for (const file of files) {
        for (let i = 0; i < file.lines.length; i += 1) {
            if (emojiAtStart.test(file.lines[i])) addMatch(marker, helpers, file, i, null, file.lines[i]);
        }
    }
    return marker.count >= minCount ? marker : { ...marker, count: 0, matches: [] };
}

function checkThematicBreakBeforeHeading(files, helpers, config) {
    const cfg = config.thematicBreakBeforeHeading || {};
    const minCount = cfg.minCount || 1;
    const marker = newMarker({
        id: 'style.thematic-break-before-heading',
        category: 'style',
        title: 'Thematic breaks before headings',
        wpShortcut: null,
        severity: 'medium',
        weight: 2,
        note: 'A thematic break (---) inserted right before each heading, common in Markdown output.',
    });

    for (const file of files) {
        for (let i = 0; i < file.lines.length; i += 1) {
            if (!THEMATIC_RE.test(file.lines[i])) continue;
            for (let j = i + 1; j < file.lines.length && j <= i + 2; j += 1) {
                if (file.lines[j].trim() === '') continue;
                if (HEADING_RE.test(file.lines[j])) {
                    addMatch(marker, helpers, file, i, null, file.lines[i]);
                }
                break;
            }
        }
    }
    return marker.count >= minCount ? marker : { ...marker, count: 0, matches: [] };
}

function checkSkipHeadingLevel(files, helpers) {
    const marker = newMarker({
        id: 'markup.skip-heading-level',
        category: 'markup',
        title: 'Skipped heading levels',
        wpShortcut: null,
        severity: 'medium',
        weight: 2,
        note: 'A heading jumps more than one level (e.g. H2 to H4), against accessibility conventions.',
    });

    for (const file of files) {
        let prevLevel = 0;
        for (let i = 0; i < file.lines.length; i += 1) {
            const m = file.lines[i].match(HEADING_RE);
            if (!m) continue;
            const level = m[1].length;
            if (prevLevel > 0 && level > prevLevel + 1) {
                addMatch(marker, helpers, file, i, `H${prevLevel} -> H${level}`, file.lines[i]);
            }
            prevLevel = level;
        }
    }
    return marker;
}

function checkSmallTables(files, helpers, config) {
    const cfg = config.smallTable || {};
    const maxRows = cfg.maxDataRows || 4;
    const maxCols = cfg.maxColumns || 2;
    const marker = newMarker({
        id: 'style.small-table',
        category: 'style',
        title: 'Unusually small tables',
        wpShortcut: 'WP:AITABLE',
        severity: 'low',
        weight: 1,
        note: 'Small tables that could be prose or an infobox. Heuristic, low confidence.',
    });

    for (const file of files) {
        for (let i = 1; i < file.lines.length; i += 1) {
            if (!TABLE_SEP_RE.test(file.lines[i])) continue;
            const header = file.lines[i - 1];
            if (!header.includes('|')) continue;
            const columns = header.split('|').filter((c) => c.trim() !== '').length;
            let dataRows = 0;
            let j = i + 1;
            while (j < file.lines.length && file.lines[j].includes('|') && file.lines[j].trim() !== '') {
                dataRows += 1;
                j += 1;
            }
            if (columns <= maxCols && dataRows <= maxRows && dataRows > 0) {
                addMatch(marker, helpers, file, i - 1, `${columns} cols x ${dataRows} rows`, header);
            }
            i = j;
        }
    }
    return marker;
}

function checkRuleOfThree(files, helpers, config) {
    const cfg = config.ruleOfThree || {};
    const minCount = cfg.minCount || 3;
    const re = /[\p{L}][\p{L}’'-]+,\s+[\p{L}][\p{L}’'-]+,?\s+(?:and|или|or|и)\s+[\p{L}][\p{L}’'-]+/giu;
    const marker = newMarker({
        id: 'language.rule-of-three',
        category: 'language',
        title: 'Rule of three (triads)',
        wpShortcut: 'WP:RO3',
        severity: 'low',
        weight: 1,
        note: 'Triads like "X, Y, and Z" / "X, Y и Z". Common in human writing too; low confidence.',
    });

    for (const file of files) {
        for (let i = 0; i < file.lines.length; i += 1) {
            const line = file.lines[i];
            if (!line) continue;
            re.lastIndex = 0;
            for (const m of line.matchAll(re)) {
                addMatch(marker, helpers, file, i, m[0], line, m.index);
            }
        }
    }
    return marker.count >= minCount ? marker : { ...marker, count: 0, matches: [] };
}
