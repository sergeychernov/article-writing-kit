// article-ai-signs: regex signature checks (markup/citation/style artifacts).
//
// Scans each file line by line against assets/markers/signatures.json.
// Language-independent.

import { newMarker, addMatch, finalize } from './check-util.mjs';

const MIN_COUNT_BY_ID = {
    'style.em-dash-spaced': (config) => config?.emDashSpaced?.minCount || 1,
    'style.curly-quotes': (config) => config?.curlyQuotes?.minCount || 1,
};

export function runRegexChecks(files, assets, helpers) {
    const signatures = assets.signatures?.signatures || [];
    const markers = [];

    for (const sig of signatures) {
        let regex;
        try {
            const flags = sig.flags && sig.flags.includes('g') ? sig.flags : `${sig.flags || ''}g`;
            regex = new RegExp(sig.pattern, flags);
        } catch {
            continue;
        }

        const marker = newMarker(sig);
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

        const minCountFn = MIN_COUNT_BY_ID[sig.id];
        const minCount = minCountFn ? minCountFn(helpers.config) : 1;
        if (marker.count >= minCount) markers.push(marker);
    }

    return finalize(markers);
}
