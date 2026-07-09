---
name: article-notes
description: >-
  Optional pre-scaffold brainstorming notes: ideas, theses, cases, open
  questions, and climax candidates. Interactive resumable dialogue that saves
  choices to .article-kit/notes/<slug>.json and syncs them into
  <slug>/article-notes.md. Use before article-scaffold when the topic,
  structure, or climax is still unclear.
scope: any
---

# Article notes

Collect **ideas, theses, cases, open questions, and climax candidates** in a
resumable interactive dialogue **before** the article folder and brief exist.
The LLM asks the human-facing questions; scripts own state persistence, slug
normalization, markdown sync, and conflict handling.

This skill is the **optional** pre-scaffold counterpart to `article-architect`:
the architect turns a completed brief into a three-act outline; this skill
captures raw material when the topic or climax is still unclear. It never
blocks the pipeline — the user can skip notes and go straight to
`article-scaffold`.

## Skill layout

```
<SKILL_DIR>/
├── SKILL.md
├── scripts/
│   ├── notes-status.mjs
│   ├── notes-resume.mjs
│   ├── notes-answer.mjs
│   ├── notes-sync.mjs
│   └── notes-lib.mjs
└── assets/
    └── schemas/
        └── notes-state.schema.json
```

`<SKILL_DIR>` is the directory that contains this file, for example
`.cursor/skills/article-notes/` when installed as Project through ide-agents.

## Quick start

Check whether notes already exist for an article:

```bash
node <SKILL_DIR>/scripts/notes-status.mjs --target . --slug my-article --json
```

Find the next interactive step (the menu of actions):

```bash
node <SKILL_DIR>/scripts/notes-resume.mjs --target . --slug my-article --json
```

Add a record:

```bash
node <SKILL_DIR>/scripts/notes-answer.mjs --target . --slug my-article \
  --action add --kind idea --text "Связка VPN + Node.js для обхода блокировок" --json
```

Mark a climax record as the leading climax:

```bash
node <SKILL_DIR>/scripts/notes-answer.mjs --target . --slug my-article \
  --action leading --id n2 --json
```

Finish or skip notes:

```bash
node <SKILL_DIR>/scripts/notes-answer.mjs --target . --slug my-article --action complete --json
node <SKILL_DIR>/scripts/notes-answer.mjs --target . --slug my-article --action skip --json
```

Sync notes into the article folder:

```bash
node <SKILL_DIR>/scripts/notes-sync.mjs --target . --slug my-article --json
```

## Flags

| Flag | Effect |
|------|--------|
| `--target <path>` | Article workspace root; default is current working directory |
| `--slug <slug>` | Article folder name; unsafe characters are normalized |
| `--thread-title <title>` | Current IDE thread/chat title; normalized to recover or seed a slug |
| `--chat-title <title>` | Alias for `--thread-title` |
| `--language ru\|en` | Output language when no notes state exists yet |
| `--new` | (`notes-resume`) ignore saved notes state and start over |
| `--action <a>` | (`notes-answer`) `add` \| `update` \| `delete` \| `leading` \| `complete` \| `skip` \| `reopen` |
| `--kind <kind>` | (`notes-answer`, `add`/`update`) `idea` \| `thesis` \| `case` \| `question` \| `climax` |
| `--id <id>` | (`notes-answer`, `update`/`delete`/`leading`) record id, for example `n3` |
| `--text <text>` | (`notes-answer`, `add`/`update`) record text |
| `--tags <a,b>` | (`notes-answer`, `add`/`update`) optional comma-separated tags |
| `--leading` | (`notes-answer`, `add`/`leading`) mark a climax record as the leading climax |
| `--force` | (`notes-sync`) reserved for future overwrite behaviour |
| `--dry-run` | Validate and show intended writes without changing files |
| `--json` | Print machine-readable JSON |

## Output

`notes-sync.mjs` writes:

- a managed block in `<slug>/article-notes.md`:

  ```
  <!-- article-kit:notes:start -->
  ## Авторские заметки

  - **idea** (n1): ...
  - **climax ★** (n2): ...   (★ = leading climax)
  <!-- article-kit:notes:end -->
  ```

  The block is replaced in place; any text outside the markers is preserved;
- the notes state at `.article-kit/notes/<slug>.json`.

## State contract

State files at `.article-kit/notes/<slug>.json` include:

- `$schema` pointing to `assets/schemas/notes-state.schema.json`
- `schemaVersion: 1`, `version: 1`, `generatedBy: "article-notes"`
- `slug`, `title`, `language`
- `status`: `"started"` | `"complete"` | `"skipped"`
- `records[]`: each `{ id, kind, text, tags[], createdAt, updatedAt }`
- `leadingClimaxId`: id of the climax record marked as the leading candidate, or null
- `syncedAt`: ISO timestamp of the last sync, or null

The schema is the source of truth for downstream readers; do not infer the
shape from examples.

## Record kinds

| Kind | Purpose |
|------|---------|
| `idea` | A raw thought worth keeping |
| `thesis` | A working claim the article might defend |
| `case` | A concrete example, story, or data point |
| `question` | An open question the article might answer |
| `climax` | A candidate for the article's culmination; one can be `leading` |

## Agent instructions

When the user asks to brainstorm, jot down ideas, or explore a topic before
structuring:

1. Resolve `<SKILL_DIR>` to this skill directory.
2. If the host exposes the current thread/chat title, pass it as
   `--thread-title "<current title>"`.
3. Run `notes-status.mjs --target . --json` with `--slug` when known.
4. If the script returns `needs_input`, ask only `currentQuestion.question`
   (the slug).
5. Run `notes-resume.mjs --target . --slug <slug> --json` to get the menu.
6. Present the menu `currentQuestion.options` to the user in plain language
   (one question). When the user picks an `add` option, collect a single text
   message and pass it verbatim as `--text`. **Never invent record text
   without explicit user input.**
7. Save each step with `notes-answer.mjs`:
   - `--action add --kind <kind> --text "<user text>" [--tags a,b] [--leading]`
   - `--action update --id <id> [--kind <kind>] [--text "<text>"] [--tags a,b]`
   - `--action delete --id <id>`
   - `--action leading --id <id>` (only for `climax` records)
   - `--action complete` when the user is done
   - `--action skip` when the user wants to abandon notes
   - `--action reopen` to resume completed/skipped notes
8. After `complete` or `skip`, run `notes-sync.mjs --target . --slug <slug> --json`
   to write `article-notes.md` (sync on `skip` is optional — only when records
   were added before skipping).
9. Tell the user the notes stage is done and the next step is `article-scaffold`
   (folder + brief) or `article-architect` (if the brief already exists).

## Writing guidance

- Capture the user's wording verbatim; do not paraphrase or polish.
- One record per `--action add`; do not batch multiple ideas into one record.
- Use `climax` sparingly — only for genuine culmination candidates. Mark the
  strongest one with `--leading` (or `--action leading`); there is at most one
  leading climax.
- Notes are input for `article-scaffold`/`article-architect`, not a draft. Do
  not try to structure them into acts here.
- If the user is unsure whether they need notes, recommend skipping: the
  pipeline works without notes, and they can reopen them later.

## Do not

- Do not edit `article-notes.md` directly; let `notes-sync.mjs` write it.
- Do not create `act-*.md`, `lead.md`, `index.md`, or `three-act-outline.md`;
  those belong to `article-scaffold` / `article-architect`.
- Do not block the pipeline on notes: `article-assistant` should route to
  `article-scaffold` when notes are `skipped` or absent.
