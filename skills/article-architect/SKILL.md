---
name: article-architect
description: >-
  Builds a three-act article architecture from an article-scaffold brief and
  synchronizes it into Obsidian-friendly three-act-outline.md through
  script-backed prepare/status/apply commands. Use after article-scaffold when
  the article folder and brief already exist, before drafting lead.md and act
  files.
scope: any
---

# Article architect

Turn a completed `article-scaffold` brief into a concrete article architecture:
short formula, three-act summaries, recommended block order, act purposes,
must-keep checklists, key questions, and act endings. Scripts own state reading,
validation, conflict handling, and Markdown synchronization. The LLM only writes
the creative architecture JSON that matches the script contract.

## Skill layout

```
<SKILL_DIR>/
├── SKILL.md
├── scripts/
│   ├── architect-status.mjs
│   ├── architect-prepare.mjs
│   ├── architect-apply.mjs
│   └── architect-lib.mjs
└── assets/
    └── schemas/
        └── architect-state.schema.json
```

## Quick start

Check whether the article is ready for architecture:

```bash
node <SKILL_DIR>/scripts/architect-status.mjs --target . --slug my-article --json
```

Prepare brief context and the required architecture JSON contract:

```bash
node <SKILL_DIR>/scripts/architect-prepare.mjs --target . --slug my-article --json
```

Apply a generated architecture JSON:

```bash
node <SKILL_DIR>/scripts/architect-apply.mjs --target . --slug my-article --input .article-kit/architect/my-article.draft.json --json
```

## Flags

| Flag | Effect |
|------|--------|
| `--target <path>` | Article workspace root; default is current working directory |
| `--slug <slug>` | Article folder name; unsafe characters are normalized |
| `--thread-title <title>` | Current IDE thread/chat title; normalized to recover an existing article slug |
| `--chat-title <title>` | Alias for `--thread-title` |
| `--language ru\|en` | Output language when scaffold state cannot provide it |
| `--input <path\|->` | Architecture JSON input for `architect-apply.mjs`; `-` reads stdin |
| `--dry-run` | Validate and show intended writes without changing files |
| `--force` | Overwrite `three-act-outline.md` even when it already contains manual content |
| `--json` | Print machine-readable JSON |

## Output

`architect-apply.mjs` writes:

```
.article-kit/architect/<slug>.json
<slug>/three-act-outline.md
```

The JSON state includes:

- `$schema` pointing to `assets/schemas/architect-state.schema.json`
- `schemaVersion: 1`
- `version: 1`
- the source scaffold state and brief timestamps
- the normalized `architecture` object

If `three-act-outline.md` already contains manual content, apply writes
`three-act-outline.md.new` instead of overwriting unless `--force` is passed.

## Architecture contract

Use the exact `outputContract.architecture` shape returned by
`architect-prepare.mjs --json`. Required fields:

| Field | Meaning |
|-------|---------|
| `formula` | 1-3 sentences that compress the article promise and narrative arc |
| `actSummaries.act1` | One-line pain/setup arc |
| `actSummaries.act2` | One-line investigation/complication arc |
| `actSummaries.act3` | One-line resolution/result arc |
| `recommendedOrder[]` | Publishable block order for the future draft |
| `acts.act1.workingPurpose` | What Act 1 should do to the reader |
| `acts.act1.mustKeep[]` | Facts/details that must survive edits |
| `acts.act1.keyQuestion` | The single question Act 1 answers |
| `acts.act1.ending` | The turn that hands the story to Act 2 |
| `acts.act2.*` | Same shape, ending field is `climax` |
| `acts.act3.*` | Same shape, ending field is `resolution` |
| `gaps[]` | Optional missing information for later agents |
| `assumptions[]` | Optional assumptions made by the architect |

## Agent instructions

When the user asks to architect or structure an article:

1. Resolve `<SKILL_DIR>` to this skill directory.
2. If the host exposes the current thread/chat title, pass it as
   `--thread-title "<current title>"`.
3. Run `architect-prepare.mjs --target . --json` with `--slug` when known.
4. If the script returns `needs_input`, ask only
   `currentQuestion.question`.
5. If the script returns `needs_brief`, tell the user to finish
   `article-scaffold` brief first; do not invent missing brief fields.
6. If the script returns `prepare_architecture` or `architecture_exists`, create
   one architecture JSON object matching `outputContract.architecture`.
7. Create the parent directory for `suggestedInputPath` if needed, then write
   that JSON to the returned `suggestedInputPath`.
8. Run `architect-apply.mjs --target . --slug <slug> --input <suggestedInputPath> --json`.
9. If apply returns `outlineSync: "suggestion"`, tell the user that
   `three-act-outline.md.new` was created because the outline had manual
   content. Use `--force` only when the user explicitly wants to overwrite.
10. Do not write directly into `lead.md`, `act-*.md`, or `index.md`.

## Writing guidance

- Treat the brief as source material, not a script to paraphrase.
- Keep act boundaries sharp: pain/setup, investigation/complication,
  resolution/result.
- `mustKeep[]` should contain concrete facts, scenes, constraints, examples,
  or promises. Avoid generic items like "write introduction".
- `recommendedOrder[]` is a reading order for the future article, not a task
  checklist.
- Preserve the user's language from the scaffold state.
