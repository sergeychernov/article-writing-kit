---
name: article-ai-signs
description: >-
  Scans an article's Markdown files for signs of AI writing based on
  Wikipedia:Signs of AI writing and prints a JSON report of found markers.
  Runs deterministic checks (AI vocabulary in ru+en, markup/citation artifacts
  like turn0search/oaicite/utm_source, spaced em dashes, curly quotes, emoji
  formatting, inline-header lists, title case, invalid ISBN, unused named refs)
  in scripts/*.mjs, and lists semantic/network-dependent signs as manualChecks.
  Use to sanity-check a draft or finished article for AI tells before publishing.
scope: any
---

# Article AI signs

Detect deterministic markers of AI-generated writing in an article and emit a
single JSON report. The scripts own file discovery, scanning, scoring, and JSON
assembly; marker dictionaries, regex signatures, and thresholds live in
`assets/`. The LLM/author reviews the semantic and network-dependent signs the
scripts cannot check (`manualChecks`).

Marker sources: [Wikipedia:Signs of AI writing](https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing)
(English) and its Russian counterpart
[Википедия:Признаки сгенерированности текста](https://ru.wikipedia.org/wiki/Википедия:Признаки_сгенерированности_текста)
(source of the `ru` dictionaries). Per-file `sources` fields in
`assets/markers/*.json` point back to these essays.

> Caveat: these markers are **indicators, not proof**. No single marker (and no
> `heuristicScore`) confirms AI authorship. Curly quotes, em dashes, and
> Markdown are common in legitimate human writing and tools. Treat a high score
> as a prompt to review, not a verdict.

## Skill layout

```
<SKILL_DIR>/
├── SKILL.md
├── scripts/
│   ├── detect-ai-signs.mjs      # entry point
│   ├── detect-lib.mjs           # args, discovery, orchestration, scoring, JSON
│   └── checks/
│       ├── check-util.mjs
│       ├── dictionary-checks.mjs # AI vocabulary + phrase groups (ru+en)
│       ├── regex-checks.mjs      # markup/citation regex signatures
│       ├── structure-checks.mjs  # style/structure heuristics
│       └── citation-checks.mjs   # ISBN checksum, book-no-page, unused refs
└── assets/
    ├── markers/
    │   ├── ai-vocabulary.json
    │   ├── phrases.json
    │   ├── signatures.json
    │   ├── fix-hints.json          # fixStrategy + fixHint per marker id
    │   └── manual-checks.json
    ├── config.json
    └── schemas/
        └── ai-signs-report.schema.json
```

`<SKILL_DIR>` is the directory that contains this file, for example
`.cursor/skills/article-ai-signs/` when installed as Project through ide-agents.

## Quick start

Scan an article folder by slug:

```bash
node <SKILL_DIR>/scripts/detect-ai-signs.mjs --target . --slug my-article --json
```

Scan a specific file or directory:

```bash
node <SKILL_DIR>/scripts/detect-ai-signs.mjs --path my-article/draft.md --json
```

Save the report alongside other article-kit state:

```bash
node <SKILL_DIR>/scripts/detect-ai-signs.mjs --slug my-article \
  --out .article-kit/ai-signs/my-article.json --json
```

## Flags

| Flag | Effect |
|------|--------|
| `--target <path>` | Article workspace root; default is the current directory |
| `--slug <slug>` | Article folder name; unsafe characters are normalized |
| `--thread-title <title>` | Current IDE thread/chat title; used to recover an article slug |
| `--chat-title <title>` | Alias for `--thread-title` |
| `--path <file\|dir>` | Scan a specific Markdown file or directory instead of a slug folder |
| `--language ru\|en` | Primary article language for reporting; scans **both** ru+en dictionaries regardless |
| `--out <path>` | Also write the JSON report to this path |
| `--dry-run` | Do not write the `--out` file |
| `--json` | Print the machine-readable JSON report |
| `--help` | Show help |

## Input discovery

When `--path` is not given, the slug is resolved from `--slug`, then
`--thread-title`, then the current directory name, then the single scaffold
state under `.article-kit/scaffold/` (same convention as other `article-*`
skills). Only the article **prose** is scanned: `lead.md` and `act-*.md`.
Service files (`index.md`, `three-act-outline.md`, `draft.md`, and any other
`*.md`) are skipped, because AI-writing markers should be checked against the
narrative, not metadata/outline blocks. The same filter applies when `--path`
points at a directory; an explicit single-file `--path` is scanned as-is. If no
slug can be resolved, the script returns `action: "needs_input"` with a
`currentQuestion` asking for the slug.

## Output

The report validates against
[`assets/schemas/ai-signs-report.schema.json`](assets/schemas/ai-signs-report.schema.json):

```json
{
  "skill": "article-ai-signs",
  "version": 1,
  "generatedAt": "...",
  "target": "...", "slug": "my-article", "language": "ru",
  "scannedLanguages": ["ru", "en"],
  "files": [{ "path": "act-1-setup.md", "lines": 120, "bytes": 5400 }],
  "summary": {
    "totalMarkers": 3,
    "totalMatches": 9,
    "byCategory": { "markup": 1, "citations": 1, "style": 1 },
    "bySeverity": { "high": 2, "medium": 0, "low": 1 },
    "heuristicScore": 62
  },
  "markers": [
    {
      "id": "markup.turn0search",
      "category": "markup",
      "title": "ChatGPT turn0search/turn0image citation placeholders",
      "wpShortcut": "WP:TURN0",
      "severity": "high",
      "weight": 6,
      "count": 2,
      "note": "...caveat from Wikipedia...",
      "fixStrategy": "delete",
      "fixHint": "Удалите turn0searchN; вставьте нормальную ссылку, если источник нужен.",
      "matches": [{ "file": "act-1-setup.md", "line": 42, "column": 10, "match": "turn0search1", "snippet": "..." }]
    }
  ],
  "fixStrategies": {
    "delete": "...",
    "mechanical": "...",
    "rephrase": "...",
    "review": "..."
  },
  "manualChecks": [
    { "id": "content.superficial-analysis", "title": "Superficial analyses", "wpShortcut": "WP:AISUPERFICIAL", "why": "...", "hint": "..." }
  ]
}
```

`heuristicScore` (0-100) is a weighted, capped aggregate of found markers, meant
only to prioritize review. It is not a probability and not a verdict.

Each marker in `markers[]` includes `fixStrategy` and `fixHint` from
[`assets/markers/fix-hints.json`](assets/markers/fix-hints.json):

| fixStrategy | Meaning |
|-------------|---------|
| `delete` | Remove the match or sentence — chatbot artifact, not article prose |
| `mechanical` | Deterministic edit (strip URL param, fix heading case, etc.) |
| `rephrase` | Rewrite in the author's voice; keep facts, drop the stamp |
| `review` | Weak signal — read in context; edit optional |

The report also includes `fixStrategies` — a short legend for these values.
Scripts do **not** apply fixes; the agent proposes edits using `fixHint`.

## Detected markers (deterministic)

| Category | Markers |
|----------|---------|
| language | AI vocabulary density with co-occurrence bonus (`WP:AIVOCAB`), copulative avoidance (`WP:AICOPULA`), promotional language (`WP:AIPROMO`), didactic hedges (`WP:AIDISCLAIMER`), summary/conclusion openers and challenges-future closers (`WP:AICONCLUSION`), vague attributions (`WP:AIVAGUE`), rule of three (`WP:RO3`, low) |
| communication | Collaborative communication (`WP:COLLABCOMM`), knowledge-cutoff disclaimers (`WP:AICUTOFF`), placeholder templates (`WP:AIPLACEHOLDER`) |
| markup | `turn0search`/`turn0image` (`WP:TURN0`), `contentReference`/`oaicite`/`oai_citation` (`WP:OAICITE`), `attributableIndex`, `grok-card`, `[attached_file:N]`/`[web:N]`, `[cite: N]`, DeepSeek lenticular brackets, `:::writing{variant}`, ```` ```wikitext ```` fences, footnote `↩`, skipped heading levels |
| style | Spaced em dashes (`WP:AIDASH`), curly quotes (`WP:AICURLY`), title case headings (`WP:AITITLECASE`), boldface overuse (`WP:AIBOLD`), inline-header lists (`WP:AILIST`), emoji formatting (`WP:AIEMOJI`), thematic breaks before headings, small tables (`WP:AITABLE`) |
| citations | `utm_source=chatgpt.com`/`openai`/`copilot.com`, `referrer=grok.com` (`WP:AIUTM`), placeholder dates `2025-XX-XX` and URL tokens (`WP:AIPLACEHOLDER`), invalid ISBN checksums, book citations without page/URL, named refs declared-but-unused (`WP:AIFICTREF`) |

Language-dependent dictionaries (`ai-vocabulary.json`, `phrases.json`) carry both
`ru` and `en` entries and are always scanned together. Edit markers and
thresholds in `assets/`, not in the scripts.

## Manual checks (not automated)

Listed in every report under `manualChecks` because they need semantic judgement,
edit history, or network access: undue emphasis on significance, superficial
analyses, residual promotional tone and unsupported attributions (beyond the
phrases already auto-flagged), negative parallelisms, elegant variation,
pronounced style shifts, broken external links, unresolvable/unrelated DOIs,
unverifiable book citations, and non-existent categories/templates. The agent
should review these against the prose after reading the script output.

## Agent instructions

When the user asks to check an article for AI-writing signs:

1. Resolve `<SKILL_DIR>` to this skill directory.
2. If the host exposes the current thread/chat title, pass it as
   `--thread-title "<current title>"`.
3. Run `detect-ai-signs.mjs --target . --json`, adding `--slug <slug>` when
   known or `--path <file>` for an ad-hoc file.
4. If the response is `action: "needs_input"`, ask only
   `currentQuestion.question` (do not translate it) and re-run with the slug.
5. If the response is `action: "no_files"`, tell the user to draft the article
   first or pass `--path`.
6. Summarize `markers` grouped by `severity`, quoting each marker's `title`,
   `wpShortcut`, `count`, `fixStrategy`, `fixHint`, and the first
   `matches[].file:line` + `snippet`. Include each marker's `note` (the Wikipedia
   caveat) so the user understands how strong the signal is.
7. For each `high` and `medium` marker, **propose a concrete edit** for every
   listed `match` (or the whole sentence when `fixStrategy` is `delete`):
   - `delete` — show the sentence without the artifact;
   - `mechanical` — show the line after the deterministic change;
   - `rephrase` — one alternative phrasing in the article's language;
   - `review` — say whether you would change it and why.
   Do not edit `act-*.md` / `lead.md` unless the user explicitly asks to apply
   fixes.
8. State the `heuristicScore` explicitly as an indicator, not a verdict.
9. Go through `manualChecks` and review the prose for each; report which apply,
   with evidence and suggestions using each item's `hint`.
10. Only write the JSON report to disk when the user asks (`--out`).
