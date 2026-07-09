// article-ai-signs: dictionary/phrase checks (ru + en).
//
// - AI vocabulary density (word-boundary matches, with co-occurrence bonus)
// - Copulative avoidance, collaborative communication, knowledge-cutoff
//   disclaimers, placeholder templates (literal phrase matches)

import { newMarker, addMatch, finalize } from './check-util.mjs';

export function runDictionaryChecks(files, assets, helpers, scannedLanguages) {
    const markers = [];

    const vocab = assets.vocabulary;
    if (vocab) markers.push(scanVocabulary(files, vocab, helpers, scannedLanguages));

    for (const group of assets.phrases?.groups || []) {
        markers.push(scanPhraseGroup(files, group, helpers, scannedLanguages));
    }

    return finalize(markers);
}

function scanVocabulary(files, def, helpers, scannedLanguages) {
    const marker = newMarker(def);
    const distinct = new Set();

    for (const lang of scannedLanguages) {
        const words = def.languages?.[lang]?.words || [];
        if (words.length === 0) continue;
        const regex = boundedRegex(words);
        if (!regex) continue;

        for (const file of files) {
            for (let i = 0; i < file.lines.length; i += 1) {
                const line = file.lines[i];
                if (!line) continue;
                regex.lastIndex = 0;
                for (const m of line.matchAll(regex)) {
                    distinct.add(m[0].toLowerCase());
                    addMatch(marker, helpers, file, i, m[0], line, m.index);
                }
            }
        }
    }

    marker.distinctWords = distinct.size;
    const threshold = def.cooccurrenceThreshold || 0;
    if (threshold && distinct.size >= threshold) {
        marker.weight += def.cooccurrenceBonusWeight || 0;
        marker.severity = 'high';
        marker.note = `${def.note} Co-occurrence: ${distinct.size} distinct AI-vocabulary words found together.`;
    }

    return marker;
}

function scanPhraseGroup(files, group, helpers, scannedLanguages) {
    const marker = newMarker(group);
    for (const lang of scannedLanguages) {
        const phrases = group.languages?.[lang] || [];
        if (phrases.length === 0) continue;
        const regex = literalRegex(phrases);
        if (!regex) continue;

        for (const file of files) {
            for (let i = 0; i < file.lines.length; i += 1) {
                const line = file.lines[i];
                if (!line) continue;
                regex.lastIndex = 0;
                for (const m of line.matchAll(regex)) {
                    addMatch(marker, helpers, file, i, m[0], line, m.index);
                }
            }
        }
    }
    return marker;
}

function boundedRegex(words) {
    const parts = [...words]
        .sort((a, b) => b.length - a.length)
        .map(escapeRegExp);
    if (parts.length === 0) return null;
    try {
        return new RegExp(`(?<![\\p{L}\\p{N}])(?:${parts.join('|')})(?![\\p{L}\\p{N}])`, 'giu');
    } catch {
        return null;
    }
}

function literalRegex(phrases) {
    const parts = [...phrases]
        .sort((a, b) => b.length - a.length)
        .map(escapeRegExp);
    if (parts.length === 0) return null;
    try {
        return new RegExp(`(?:${parts.join('|')})`, 'giu');
    } catch {
        return null;
    }
}

function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
