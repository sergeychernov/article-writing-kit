// article-ai-signs: shared helpers for check modules.

export function newMarker(def) {
    return {
        id: def.id,
        category: def.category,
        title: def.title,
        wpShortcut: def.wpShortcut || null,
        severity: def.severity || 'low',
        weight: typeof def.weight === 'number' ? def.weight : 1,
        note: def.note || null,
        fixStrategy: def.fixStrategy || null,
        fixHint: def.fixHint || null,
        count: 0,
        matches: [],
    };
}

export function addMatch(marker, helpers, file, lineIndex, matchText, lineText, column) {
    marker.count += 1;
    if (marker.matches.length < helpers.maxMatches) {
        marker.matches.push({
            file: file.path,
            line: lineIndex + 1,
            column: typeof column === 'number' ? column : null,
            match: matchText != null ? String(matchText).slice(0, 120) : null,
            snippet: helpers.snippet(lineText),
        });
    }
}

export function finalize(markers) {
    return markers.filter((m) => m && m.count > 0);
}
