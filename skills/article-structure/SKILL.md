---
name: article-structure
description: >-
  Interactive post-draft heading structuring for a finished article. Reads the
  drafted act-*.md files, segments them per act, and act by act, chunk by chunk
  proposes headings of different levels (H2/H3) in a resumable interactive
  flow. Saves choices to .article-kit/structure/<slug>.json and applies them
  back into the act files plus a structure map in three-act-outline.md. Use
  after article-scaffold + drafting, when the act prose already exists.
scope: any
---

# Article structure

Turn already-drafted `act-*.md` files into a heading structure through a
resumable interactive dialogue. The LLM asks the human-facing questions (chunk
boundaries, heading choice); scripts own act-file reading, paragraph
segmentation, state persistence, heading insertion, and outline synchronization.

This skill is the post-draft counterpart to `article-architect`: the architect
designs an architecture from the brief before drafting; this skill labels an
already-written article with headings after drafting.

## Skill layout

```
<SKILL_DIR>/
├── SKILL.md
├── scripts/
│   ├── structure-status.mjs
│   ├── structure-resume.mjs
│   ├── structure-prepare.mjs
│   ├── structure-answer.mjs
│   ├── structure-apply.mjs
│   └── structure-lib.mjs
└── assets/
    └── schemas/
        └── structure-state.schema.json
```

`<SKILL_DIR>` is the directory that contains this file, for example
`.cursor/skills/article-structure/` when installed as Project through ide-agents.

## Quick start

Check whether the article is ready for structuring:

```bash
node <SKILL_DIR>/scripts/structure-status.mjs --target . --slug my-article --json
```

Read act segments and the headings output contract:

```bash
node <SKILL_DIR>/scripts/structure-prepare.mjs --target . --slug my-article --json
```

Find the next interactive step (chunk to define or heading to choose):

```bash
node <SKILL_DIR>/scripts/structure-resume.mjs --target . --slug my-article --json
```

Register a chunk and save a chosen heading:

```bash
node <SKILL_DIR>/scripts/structure-answer.mjs --target . --slug my-article \
  --act act1 --chunk c1 --start-line 5 --end-line 42 --preview "Node.js + VPN" \
  --level h3 --text "Node.js + VPN — а так можно было?" --json
```

Insert chosen headings into act files and sync the outline:

```bash
node <SKILL_DIR>/scripts/structure-apply.mjs --target . --slug my-article --json
```

## Flags

| Flag | Effect |
|------|--------|
| `--target <path>` | Article workspace root; default is current working directory |
| `--slug <slug>` | Article folder name; unsafe characters are normalized |
| `--thread-title <title>` | Current IDE thread/chat title; normalized to recover an existing article slug |
| `--chat-title <title>` | Alias for `--thread-title` |
| `--language ru\|en` | Output language when scaffold state cannot provide it |
| `--new` | (`structure-resume`) ignore saved structure state and start over |
| `--act <act1\|act2\|act3>` | (`structure-answer`) act key; (`structure-apply`) scope apply to a single act |
| `--chunk <id>` | (`structure-answer`) stable chunk id, for example `c1` |
| `--start-line <N>` | (`structure-answer`) first line of the chunk in the act file |
| `--end-line <M>` | (`structure-answer`) last line of the chunk in the act file |
| `--preview <text>` | (`structure-answer`) short chunk preview; auto-derived when omitted |
| `--level <h2\|h3\|callout>` | (`structure-answer`) chosen heading level; `callout` is auto-allowed for callout chunks and may be omitted when `--text` is given |
| `--text <heading>` | (`structure-answer`) chosen heading text |
| `--skip-heading` | (`structure-answer`) register the chunk without a heading |
| `--force` | (`structure-apply`) overwrite existing headings in act files instead of writing `*.new`, or re-apply an already-applied act |
| `--dry-run` | Validate and show intended writes without changing files |
| `--json` | Print machine-readable JSON |

## Output

`structure-apply.mjs` writes:

- chosen heading lines inserted at chunk boundaries in each `act-*.md` that has
  labelled chunks;
- a managed block in `<slug>/three-act-outline.md`:

  ```
  <!-- article-kit:structure:start -->
  ## Структура заголовков
  ...
  <!-- article-kit:structure:end -->
  ```

  The block is replaced in place; the rest of the outline is preserved;
- the structure state at `.article-kit/structure/<slug>.json`.

If a chunk starts on a line that already contains a markdown heading,
`structure-apply.mjs` writes `<act-file>.new` instead of overwriting unless
`--force` is passed. For a callout chunk whose marker already has a title, the
same `*.new` / `--force` rule applies; a callout without a title is filled in
in place.

## State contract

State files at `.article-kit/structure/<slug>.json` include:

- `$schema` pointing to `assets/schemas/structure-state.schema.json`
- `schemaVersion: 1`, `version: 1`, `generatedBy: "article-structure"`
- `slug`, `title`, `language`, `articleDir`
- `actsOrder: ["act1","act2","act3"]`
- `acts.<key>`: `{ file, exists, ready, segments[], chunks[] }`
- each chunk: `{ id, startLine, endLine, preview, heading: { level, text } | null }`
- `cursor: { actId, phase: "chunking" | "headings", chunkId } | null`
- `appliedAt`: ISO timestamp of the last apply, or null

The schema is the source of truth for downstream readers; do not infer the
shape from examples.

## Output contract

`structure-prepare.mjs --json` returns `outputContract` describing the heading
and chunk shape, plus per-act `segments[]` (paragraph groups split by blank
lines) as raw material for logical chunking. Use `structure-resume.mjs` to
discover the next missing step: either `needs_chunking` for an act with no
chunks yet, or `needs_heading` for a registered chunk without a heading.

## Agent instructions

When the user asks to structure or label a finished article with headings:

1. Resolve `<SKILL_DIR>` to this skill directory.
2. If the host exposes the current thread/chat title, pass it as
   `--thread-title "<current title>"`.
3. Run `structure-status.mjs --target . --json` with `--slug` when known.
4. If the script returns `needs_input`, ask only `currentQuestion.question`.
5. Run `structure-prepare.mjs --target . --slug <slug> --json` to read the
   per-act segments and the output contract.
6. Run `structure-resume.mjs --target . --slug <slug> --json` to find the next
   step. Use `--new` only when the user explicitly wants to start over.
7. For `needs_chunking`: propose a logical grouping of that act's segments into
   chunks. Show each chunk's **text preview** (the `preview` field — the
   beginning of the chunk's text) so the user can recognize it. Do **not** show
   line numbers to the user; they are internal and only used when calling
   `structure-answer.mjs`. Ask the user to confirm or correct the boundaries
   (one question). Then register every confirmed chunk with
   `structure-answer.mjs --act <key> --chunk <id> --start-line N --end-line M
   [--preview <text>] [--skip-heading] --json`.
8. For `needs_heading`: the response includes `anchor` (the beginning of the
   text the heading will be inserted before), `allowedLevels`, `hasH2`,
   `currentSection`, `proposalStyle`, and `callout` (non-null when the chunk
   starts with an Obsidian callout marker `> [!TYPE]`). Show the anchor text to
   the user as the chunk identifier, not line numbers or chunk ids alone.

   - **Section chunks** (`callout` is null): propose **exactly 6 variants**
     following `proposalStyle`, each at a level from `allowedLevels` — 2
     open-question, 2 ironic, 2 plain formal. The first heading in an act is
     always H2; H3 is only a subsection nesting under the existing H2 named in
     `currentSection`. Never propose H3 when `hasH2` is false.
   - **Callout chunks** (`callout` is non-null): propose **exactly 6 variants**
     as callout title text — no `##`/`###` prefix. Apply will write
     `> [!TYPE] <title>` instead of a markdown heading. If `callout.hasTitle`
     is true, the existing title is replaced only with `--force`.

   Save the choice with `structure-answer.mjs --act <key> --chunk <id>
   --level <h2|h3> --text "<heading>" --json` for sections, or
   `--text "<callout-title>" --json` (no `--level`) for callouts. Use
   `--skip-heading` only when the user explicitly wants no heading.
9. After each act is fully labelled, the `structure-resume.mjs` response lists
   it in `pendingApplyActs`. Apply that act so headings appear in its `act-*.md`
   immediately:

   ```bash
   node <SKILL_DIR>/scripts/structure-apply.mjs --target . --slug <slug> --act <act1|act2|act3> --json
   ```

   Already-applied acts are skipped on later runs; the outline block is synced
   on every apply. Repeat steps 6-9 per act. When `structure-resume.mjs`
   returns `action: "all_done"`, run a final apply (with or without `--act`) to
   write any remaining acts.
10. If any apply response lists `conflicts`, tell the user which act files
    already contain headings and were written as `*.new`; apply `--force` only
    when the user explicitly asks to overwrite those headings or re-apply an
    already-applied act.
11. Do not edit `act-*.md`, `lead.md`, `index.md`, `draft.md`, or
    `three-act-outline.md` directly; let `structure-apply.mjs` perform all
    writes.

## Writing guidance

- Chunk by meaning, not by paragraph count: a chunk is a single idea, scene,
  step, or turn the reader can label.
- Propose headings in the article's language. Keep them concrete and specific;
  avoid generic labels like "Введение" or "Заключение" unless the user asks.
- Respect heading hierarchy: the article title is H1 and lives in `index.md` /
  `lead.md`, not in act files. Each act file is a separate tree, so the first
  heading inside an act must be H2; use H3 only as a subsection nesting under an
  already chosen H2. Do not propose H3 for the first chunk of an act.
- Obsidian callout blocks (`> [!NOTE]`, `> [!WARNING]`, `> [!tip]`, custom
  types) are auto-detected: when a chunk's first line is a callout marker, the
  chosen heading becomes the callout title (`> [!TYPE] <title>`) instead of a
  markdown heading. Callout titles do not participate in the H2/H3 hierarchy.
- Prefer the shallowest level that fits: default to H2 for major sections and
  H3 only when a chunk is clearly nested inside an H2 section. Keep the in-act
  tree at most two levels.
- Preserve the user's wording when they give an explicit heading; do not
  silently rewrite it.
