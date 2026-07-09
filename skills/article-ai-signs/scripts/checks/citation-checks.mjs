// article-ai-signs: citation checks that need parsing/validation.
//
// - Invalid ISBN checksums (hallucinated references)
// - Book citations without page numbers or URLs (heuristic)
// - Named references declared in <references> but unused in the body

import { newMarker, addMatch, finalize } from './check-util.mjs';

const ISBN_RE = /ISBN(?:-1[03])?:?\s*([0-9Xx][0-9Xx\s-]{7,16}[0-9Xx])/g;
const REF_NAME_RE = /<ref\s+name\s*=\s*"?([^"\s/>]+)"?/gi;
const REFERENCES_BLOCK_RE = /<references[\s\S]*?<\/references>/gi;

export function runCitationChecks(files, assets, helpers) {
    return finalize([
        checkIsbn(files, helpers),
        checkBookNoPage(files, helpers),
        checkUnusedNamedRefs(files, helpers),
    ]);
}

function checkIsbn(files, helpers) {
    const marker = newMarker({
        id: 'citations.invalid-isbn',
        category: 'citations',
        title: 'Invalid ISBN checksum',
        wpShortcut: 'WP:AIFICTREF',
        severity: 'high',
        weight: 4,
        note: 'An invalid ISBN checksum is a likely sign of a hallucinated reference.',
    });

    for (const file of files) {
        for (let i = 0; i < file.lines.length; i += 1) {
            const line = file.lines[i];
            if (!line || !/ISBN/i.test(line)) continue;
            ISBN_RE.lastIndex = 0;
            for (const m of line.matchAll(ISBN_RE)) {
                const raw = m[1].replace(/[\s-]/g, '');
                if (!isValidIsbn(raw)) addMatch(marker, helpers, file, i, `ISBN ${raw}`, line, m.index);
            }
        }
    }
    return marker;
}

function checkBookNoPage(files, helpers) {
    const marker = newMarker({
        id: 'citations.book-no-page',
        category: 'citations',
        title: 'Book citation without page number or URL',
        wpShortcut: 'WP:AIFICTREF',
        severity: 'low',
        weight: 2,
        note: 'LLM book citations often omit page numbers, making them unverifiable. Heuristic.',
    });

    const hasPage = /\bpp?\.\s*\d|\bpages?\s*\d|\bстр\.?\s*\d|\bс\.\s*\d|\|\s*pages?\s*=/i;
    const hasUrl = /https?:\/\//i;

    for (const file of files) {
        for (let i = 0; i < file.lines.length; i += 1) {
            const line = file.lines[i];
            if (!line || !/ISBN/i.test(line)) continue;
            if (hasPage.test(line) || hasUrl.test(line)) continue;
            addMatch(marker, helpers, file, i, null, line);
        }
    }
    return marker;
}

function checkUnusedNamedRefs(files, helpers) {
    const marker = newMarker({
        id: 'citations.unused-named-ref',
        category: 'citations',
        title: 'Named references declared but unused in the body',
        wpShortcut: 'WP:AIFICTREF',
        severity: 'medium',
        weight: 3,
        note: 'Sources defined inside <references> but never cited inline; a common LLM referencing error.',
    });

    const fullText = files.map((f) => f.text).join('\n');
    const blockText = (fullText.match(REFERENCES_BLOCK_RE) || []).join('\n');
    if (!blockText) return marker;

    const usageCount = countRefNames(fullText);
    const blockCount = countRefNames(blockText);

    for (const file of files) {
        let insideBlock = false;
        for (let i = 0; i < file.lines.length; i += 1) {
            const line = file.lines[i];
            if (/<references/i.test(line)) insideBlock = true;
            if (!insideBlock) {
                if (/<\/references>/i.test(line)) insideBlock = false;
                continue;
            }
            REF_NAME_RE.lastIndex = 0;
            for (const m of line.matchAll(REF_NAME_RE)) {
                const name = m[1];
                const total = usageCount.get(name) || 0;
                const inBlock = blockCount.get(name) || 0;
                if (total > 0 && total <= inBlock) {
                    addMatch(marker, helpers, file, i, `ref name="${name}"`, line, m.index);
                }
            }
            if (/<\/references>/i.test(line)) insideBlock = false;
        }
    }
    return marker;
}

function countRefNames(text) {
    const counts = new Map();
    REF_NAME_RE.lastIndex = 0;
    for (const m of text.matchAll(REF_NAME_RE)) {
        counts.set(m[1], (counts.get(m[1]) || 0) + 1);
    }
    return counts;
}

function isValidIsbn(raw) {
    const value = raw.toUpperCase();
    if (value.length === 10) return isValidIsbn10(value);
    if (value.length === 13) return isValidIsbn13(value);
    return true; // unknown length: do not flag
}

function isValidIsbn10(value) {
    if (!/^[0-9]{9}[0-9X]$/.test(value)) return false;
    let sum = 0;
    for (let i = 0; i < 10; i += 1) {
        const ch = value[i];
        const digit = ch === 'X' ? 10 : Number(ch);
        sum += (10 - i) * digit;
    }
    return sum % 11 === 0;
}

function isValidIsbn13(value) {
    if (!/^[0-9]{13}$/.test(value)) return false;
    let sum = 0;
    for (let i = 0; i < 13; i += 1) {
        const digit = Number(value[i]);
        sum += (i % 2 === 0 ? 1 : 3) * digit;
    }
    return sum % 10 === 0;
}
