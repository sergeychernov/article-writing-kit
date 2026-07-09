---
name: article-habr
description: >-
  Adapts a finished article for Habr by selecting the publication format (from a
  bundled registry of 12 Habr formats), thematic hubs (from a bundled registry
  of 431 Habr hubs), and tags through a resumable interactive flow, then applies
  them into the index.md frontmatter (format/tags/hubs fields). Use after
  article-structure, when the drafted article is ready to publish on Habr.
scope: any
---

# Article Habr

Select Habr **format**, **hubs** (from a bundled registry), and **tags** for a
finished article through a resumable interactive dialogue, then write them into
the `format`/`tags`/`hubs` frontmatter of `index.md`. The LLM asks the
human-facing questions and proposes candidates; scripts own registry validation,
state persistence, and frontmatter edits.

This skill is the publish-prep counterpart to `article-structure`: structure
labels the drafted article with headings; this skill labels it with Habr
metadata.

## Skill layout

```
<SKILL_DIR>/
├── SKILL.md
├── scripts/
│   ├── habr-status.mjs
│   ├── habr-resume.mjs
│   ├── habr-answer.mjs
│   ├── habr-apply.mjs
│   └── habr-lib.mjs
└── assets/
    ├── habr-hubs.json
    ├── habr-formats.json
    └── schemas/
        ├── habr-state.schema.json
        ├── habr-hubs.schema.json
        └── habr-formats.schema.json
```

`<SKILL_DIR>` is the directory that contains this file, for example
`.cursor/skills/article-habr/` when installed as Project through ide-agents.

## Format registry

`assets/habr-formats.json` is a static registry of 12 Habr publication formats
from the publication form radio group. Each entry has `{ value, title: { ru, en } }`:

| value | ru | en |
|-------|----|----|
| `common` | Не указан | Not specified |
| `case` | Кейс | Case study |
| `tutorial` | Туториал | Tutorial |
| `roadmap` | Роадмэп | Roadmap |
| `retrospective` | Ретроспектива | Retrospective |
| `review` | Обзор | Review |
| `opinion` | Мнение | Opinion |
| `faq` | FAQ | FAQ |
| `interview` | Интервью | Interview |
| `digest` | Дайджест | Digest |
| `reportage` | Репортаж | Reportage |
| `analytics` | Аналитика | Analytics |

Prefer a specific format over `common` when the article clearly matches one.

## Hub registry

`assets/habr-hubs.json` is a static registry of 431 Habr thematic hubs parsed
from the habr.com chips suggest panel (`fetchedAt` is recorded in the file).
Each entry has `{ alias, title, multiauthor }`:

- `title` — the exact hub name as Habr shows it (e.g. `Linux`, `*nix`, `C#`).
- `alias` — a normalized matching key (lowercase, keeps `# + . $ *` so
  `C` / `C#` / `C++` stay distinct).
- `multiauthor` — `true` when the hub is marked with `*` on Habr, i.e. a
  thematic hub that **accepts posts from a regular author**. Hubs with
  `multiauthor: false` are corporate/single-author and cannot be freely
  selected — prefer `multiauthor: true`.

The registry does not call the Habr API. To refresh it, re-paste the chips
panel HTML into the parser and regenerate the JSON.

## Quick start

Check whether the article is ready and what is already selected:

```bash
node <SKILL_DIR>/scripts/habr-status.mjs --target . --slug my-article --json
```

Start or resume the interactive selection:

```bash
node <SKILL_DIR>/scripts/habr-resume.mjs --target . --slug my-article --json
```

Save the format (value or localized title):

```bash
node <SKILL_DIR>/scripts/habr-answer.mjs --target . --slug my-article \
  --field format --value tutorial --json
```

Save the hubs selection (titles or aliases, comma-separated):

```bash
node <SKILL_DIR>/scripts/habr-answer.mjs --target . --slug my-article \
  --field hubs --value "Linux, Python, *nix, Сетевые технологии, Системное администрирование" --json
```

Save the tags selection (lowercase, comma-separated):

```bash
node <SKILL_DIR>/scripts/habr-answer.mjs --target . --slug my-article \
  --field tags --value "vpn, linux, python, networking, sysadmin" --json
```

Apply the selection into `index.md` frontmatter:

```bash
node <SKILL_DIR>/scripts/habr-apply.mjs --target . --slug my-article --json
```

## Flags

| Flag | Effect |
|------|--------|
| `--target <path>` | Article workspace root; default is current working directory |
| `--slug <slug>` | Article folder name; unsafe characters are normalized |
| `--thread-title <title>` | Current IDE thread/chat title; normalized to recover an existing article slug |
| `--chat-title <title>` | Alias for `--thread-title` |
| `--language ru\|en` | Output language when scaffold state cannot provide it |
| `--new` | (`habr-resume`) ignore saved habr state and start over |
| `--field <format\|hubs\|tags>` | (`habr-answer`) which selection to save |
| `--value <v>` | (`habr-answer`) format value/title, or comma/semicolon/newline-separated hubs/tags |
| `--force` | (`habr-apply`) overwrite non-empty `format`/`tags`/`hubs` in `index.md` instead of writing `index.md.new` |
| `--dry-run` | Validate and show intended writes without changing files |
| `--json` | Print machine-readable JSON |

## Limits

- **Format**: exactly one value from `assets/habr-formats.json`.
- **Hubs**: up to 5 (from `registry.limits.maxHubs`).
- **Tags**: up to 10 (from `registry.limits.maxTags`).
- Hubs are validated against the registry — unknown titles/aliases are rejected.
- Tags are lowercase, max 64 chars, unique; a leading `#` is stripped.

## Output

`habr-apply.mjs` writes the `format`, `tags`, and `hubs` lines of the
`index.md` frontmatter, preserving the rest of the file:

```yaml
---
tags: ["vpn", "linux", "python", "networking", "sysadmin"]
format: tutorial
publication:
hubs: ["Linux", "Python", "*nix", "Сетевые технологии", "Системное администрирование"]
---
```

Hub titles are double-quoted because some start with `*` or `$` (YAML alias
indicators). If `index.md` already has non-empty `tags`/`hubs` (or a non-`common`
`format`) that differ from the new selection, `habr-apply.mjs` writes
`index.md.new` instead of overwriting unless `--force` is passed. If the
frontmatter has no `format`/`tags`/`hubs` lines, they are inserted; if
`index.md` has no frontmatter at all, a new block is prepended.

State is persisted at `.article-kit/habr/<slug>.json`.

## State contract

State files at `.article-kit/habr/<slug>.json` include:

- `$schema` pointing to `assets/schemas/habr-state.schema.json`
- `schemaVersion: 1`, `version: 1`, `generatedBy: "article-habr"`
- `slug`, `title`, `language`, `articleDir`
- `maxHubs`, `maxTags`
- `format`: `{ value, title } | null`
- `hubs[]`: `{ alias, title, multiauthor }`
- `tags[]`: strings
- `cursor`: `{ phase: "format" | "hubs" | "tags" } | null`
- `appliedAt`: ISO timestamp of the last apply, or null

The schema is the source of truth for downstream readers; do not infer the
shape from examples.

## Output contract

`habr-resume.mjs --json` returns the next step:

- `needs_format` — `cursor.phase === "format"`; `formats.items` lists all
  allowed formats. Infer from `articleContext` and ask the user to confirm.
- `needs_hubs` — `cursor.phase === "hubs"`; `articleContext` carries the
  title, a lead excerpt, and the brief so the agent can propose candidates.
  `registry` carries `registryPath` — read the full file to pick candidates.
- `needs_tags` — `cursor.phase === "tags"`; propose lowercase tags.
- `needs_apply` — format, hubs and tags are chosen but not applied; run
  `habr-apply.mjs`.
- `all_done` — format, hubs and tags are already applied to `index.md`.

`habr-status.mjs --json` also returns `indexFrontmatter` with the
format/hubs/tags currently present in `index.md`, so the agent can detect
drift between state and the file.

## Agent instructions

When the user asks to prepare an article for Habr (pick format/hubs/tags):

1. Resolve `<SKILL_DIR>` to this skill directory.
2. If the host exposes the current thread/chat title, pass it as
   `--thread-title "<current title>"`.
3. Run `habr-status.mjs --target . --json` with `--slug` when known.
4. If the script returns `needs_input`, ask only `currentQuestion.question`.
5. Run `habr-resume.mjs --target . --slug <slug> --json`. Use `--new` only when
   the user explicitly wants to start over.
6. For `needs_format`: read `formats.items`. Using `articleContext` (title,
   lead excerpt, brief), propose the best matching format and ask the user to
   confirm (one question). Prefer a specific format over `common` when the
   article clearly matches one. Save with `habr-answer.mjs --field format
   --value "<value-or-title>" --json`.
7. For `needs_hubs`: read the registry at `registry.registryPath`
   (`assets/habr-hubs.json`). Using `articleContext` as the signal, propose up
   to `maxHubs` candidate hubs that match the article topic. **Prefer hubs
   with `multiauthor: true`** (marked `*` on Habr). Show the candidates with a
   note on which ones accept posts, and ask the user to confirm or edit the
   list (one question). Save with `habr-answer.mjs --field hubs --value
   "Title 1, Title 2, …" --json`.
8. For `needs_tags`: propose up to `maxTags` lowercase tags that are
   established on Habr and match the topic. Ask the user to confirm or edit.
   Save with `habr-answer.mjs --field tags --value "tag1, tag2, …" --json`.
9. After all selections are saved, run `habr-apply.mjs --target . --slug
   <slug> --json` to write them into `index.md`.
10. If the apply response lists `conflicts`, tell the user that `index.md`
    already had non-empty metadata and a suggestion was written to
    `index.md.new`; apply `--force` only when the user explicitly asks to
    overwrite.
11. Do not edit `index.md`, `lead.md`, `act-*.md`, or
    `three-act-outline.md` directly; let `habr-apply.mjs` perform all writes.

## Writing guidance

- Format: match the article's genre, not its topic. A step-by-step VPN setup is
  `tutorial`; a post-mortem is `retrospective`; a product walkthrough is
  `review`; a personal take is `opinion`. Use `common` only when nothing fits.
- Hubs: match the article's real subject, not its mood. A VPN-on-Linux article
  fits `Linux`, `Сетевые технологии`, `Системное администрирование`, `Python`
  — not `Киберпанк`. When torn, prefer the broader thematic hub over a niche
  one.
- Tags: lowercase, concrete, established on Habr (e.g. `vpn`, `linux`,
  `python`, `networking`, `sysadmin`). Avoid inventing compound tags; use
  several focused tags instead of one long phrase.
- Respect the user's wording when they give explicit format/hubs/tags; do not
  silently rewrite them. If a user-provided hub/format is not in the registry,
  tell them and suggest the closest match instead of failing silently.
