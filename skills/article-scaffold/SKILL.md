---
name: article-scaffold
description: >-
  Creates or resumes an Obsidian-friendly article folder scaffold using a
  script-driven wizard. Creates index.md, lead.md, three act files,
  three-act-outline.md, images/, and recoverable wizard state through
  scripts/scaffold-*.mjs. Use when starting a new article, continuing an
  interrupted article setup, or checking/fixing a partially created article
  structure.
scope: any
---

# Article scaffold

Create a new article folder from templates, resume a partially completed setup,
and optionally collect a short article brief for downstream agents. The LLM asks
the human-facing questions; scripts own state recovery, slug normalization, file
creation, brief storage, and conflict handling.

## Skill layout

```
<SKILL_DIR>/
├── SKILL.md
├── scripts/
│   ├── scaffold-start.mjs
│   ├── scaffold-status.mjs
│   ├── scaffold-resume.mjs
│   ├── scaffold-apply.mjs
│   ├── brief-resume.mjs
│   ├── brief-answer.mjs
│   ├── brief-status.mjs
│   ├── brief-sync.mjs
│   └── scaffold-lib.mjs
└── assets/
    ├── schemas/
    │   └── scaffold-state.schema.json
    └── templates/
        ├── ru/
        └── en/
```

`<SKILL_DIR>` is the directory that contains this file, for example
`.cursor/skills/article-scaffold/` when installed as Project through ide-agents.

## Wizard flow

Start or update known answers:

```bash
node <SKILL_DIR>/scripts/scaffold-start.mjs --target . --slug my-article --title "My Article" --json
```

Resume after an interrupted session:

```bash
node <SKILL_DIR>/scripts/scaffold-resume.mjs --target . --json
```

Start a clearly new article, ignoring completed scaffold states:

```bash
node <SKILL_DIR>/scripts/scaffold-resume.mjs --target . --new --json
```

Check current structure:

```bash
node <SKILL_DIR>/scripts/scaffold-status.mjs --target . --slug my-article --json
```

Create or complete the article folder:

```bash
node <SKILL_DIR>/scripts/scaffold-apply.mjs --target . --slug my-article --title "My Article"
```

## Brief flow

After the folder exists, collect one piece of metadata at a time:

```bash
node <SKILL_DIR>/scripts/brief-resume.mjs --target . --slug my-article --json
```

Save the answer returned by the user:

```bash
node <SKILL_DIR>/scripts/brief-answer.mjs --target . --slug my-article --field topic --value "Article topic" --json
```

Check saved brief state:

```bash
node <SKILL_DIR>/scripts/brief-status.mjs --target . --slug my-article --json
```

Synchronize an existing saved brief into `three-act-outline.md`:

```bash
node <SKILL_DIR>/scripts/brief-sync.mjs --target . --slug my-article --json
```

## Flags

| Flag | Effect |
|------|--------|
| `--target <path>` | Article workspace root; default is current working directory |
| `--slug <slug>` | Article folder name; unsafe characters are normalized |
| `--title <title>` | Article title for `index.md` and `three-act-outline.md` |
| `--thread-title <title>` | Current IDE thread/chat title; normalized to recover an existing article slug |
| `--chat-title <title>` | Alias for `--thread-title` |
| `--context <text>` | Extra article/chat context for conditional brief questions; may be repeated |
| `--language ru\|en` | Template language; default is `ru` |
| `--dry-run` | Show intended changes without writing article files |
| `--force` | Overwrite conflicting article files instead of writing `*.new` suggestions |
| `--new` | Ignore saved state; still recover slug from `--thread-title` when that folder exists |
| `--json` | Print machine-readable JSON |

Brief answer flags:

| Flag | Effect |
|------|--------|
| `--field <id>` | Brief field to save |
| `--value <answer>` | Answer value to save |

Brief fields:

| Field | Meaning |
|-------|---------|
| `topic` | What the article is about |
| `goal` | Why the author is writing it |
| `repository` | Optional repositories relevant to the article; asked only when context suggests a tool/repo article |
| `audience` | Who the article is for |
| `publicationTargets` | Planned publishing platforms; comma-separated in `--value` |
| `readerTakeaway` | What the reader should take away |
| `constraints` | Must-keep details or constraints for future agents |

Questions are localized by `--language` or saved state language. Agents should
ask the exact `currentQuestion.question` returned by scripts and should not
translate or rewrite it.

When `currentQuestion.id` is `repository`, accept either:

- one or more HTTPS repository URLs, for example `https://github.com/org/repo`
- one or more SSH repository URLs, for example `git@github.com:org/repo.git`
- Markdown links containing HTTPS/SSH URLs
- several repository URLs separated by spaces, commas, new lines, or surrounding text
- a negative answer such as `no` or `нет`

The answer is stored as `repository.items[]` in JSON and synchronized into the
brief block in `three-act-outline.md`.

## JSON schema

State files written to `.article-kit/scaffold/<slug>.json` include:

- `$schema` pointing to
  `assets/schemas/scaffold-state.schema.json` in this repository
- `schemaVersion: 1`
- `version: 1` for the scaffold state format

Downstream skills and agents should use the schema when reading the state file
instead of inferring the brief shape from examples. The schema defines
`brief.repository` as either `{ "status": "none" }` or
`{ "status": "provided", "items": [...] }`.

JSON responses from scaffold scripts also include `stateSchema` and
`stateSchemaVersion` so agents can discover the state schema from stdout.

## Thread title

Scripts return `suggestedThreadTitle` once the article slug is known. The value
is the slug, not the human title. Scripts do not rename IDE chats directly
because that is host-specific.

When the host can read the current thread/chat title, pass it as
`--thread-title`. Before asking the user for a slug, scripts normalize that title
and reuse it only if a matching article folder already exists in the target
workspace. This lets article-specific chats resume without repeating the slug
question.

If the current IDE exposes a thread/chat title tool, rename the current thread to
`suggestedThreadTitle` after the slug step succeeds. In Codex, use the thread
title tool when available. Do not ask the user for permission to rename when the
slug came from the user or was recovered during this scaffold flow.

## Output

The scaffold creates:

```
<slug>/
├── index.md
├── lead.md
├── act-1-setup.md
├── act-2-investigation.md
├── act-3-resolution.md
├── three-act-outline.md
└── images/
```

Wizard state and brief answers are stored in
`.article-kit/scaffold/<slug>.json`. Brief answers are also synchronized into a
marked Markdown block in `<slug>/three-act-outline.md` so the author and
Obsidian can read them directly. If the state file is missing,
`scaffold-status.mjs` and `scaffold-resume.mjs` still recover from the article
folder structure and `index.md` title when possible.

Existing article files are preserved by default. Conflicts create `*.new`
suggestions; `--force` is required to overwrite.

## Agent instructions

When the user wants to create a new article:

1. If the host exposes the current thread/chat title, include it as
   `--thread-title "<current title>"` on scaffold and brief scripts.
2. If the conversation contains article context that is not yet in saved state,
   pass a short summary with `--context`, especially tool/repository cues and
   known repository URLs.
3. If the user asks for a new article, run `scaffold-resume.mjs --new --json`.
4. If the user asks to continue or resume an article setup, run
   `scaffold-resume.mjs --json`.
5. If the script returns `needs_input`, ask only the exact
   `currentQuestion.question`; do not translate it, mention other missing fields,
   or present a numbered multi-question list.
6. Save known answers with `scaffold-start.mjs --json` when a slug is known.
7. After a script response includes `suggestedThreadTitle`, rename the current
   thread/chat to that slug if the host provides a title tool.
8. Run `scaffold-apply.mjs` only after `slug` and `title` are known.
9. Summarize created, unchanged, overwritten, and suggestion files.
10. Run `brief-resume.mjs --json` and collect one returned `currentQuestion` at a
   time.
11. Save each brief answer with `brief-answer.mjs --field <id> --value <answer>
   --json`; this also synchronizes the marked brief block in
   `three-act-outline.md`.
12. If `currentQuestion.id` is `repository`, pass through HTTPS URLs, SSH URLs,
    or negative answers like `no` / `нет`; the script validates and normalizes
    them.
13. If a brief already exists only in JSON, run `brief-sync.mjs --json`.
14. Mention that brief answers were synchronized into `three-act-outline.md`.
15. When `briefComplete` is true, recommend `article-architect` to use the brief
    block in `three-act-outline.md` while filling the article structure.
