---
name: article-habr-poll
description: >-
  Optional in-article Habr poll drafting for a finished article. Through a
  resumable interactive flow decides whether a poll is needed, collects question,
  2–10 options and single/multi choice, then appends a markdown placeholder to
  the end of act-3-*.md (Habr only allows polls at the end of an article). Use
  after or alongside article-habr metadata selection, when engagement via a poll
  may help.
scope: any
---

# Article Habr Poll

Draft an optional **Habr in-article poll** through a resumable dialogue, then
append a markdown placeholder to the **end of `act-3-*.md`**. On Habr, polls can
only be attached at the end of the article — not in the middle of the text. The
LLM proposes the question and options; scripts own validation, state, and file
edits.

This skill is a companion to `article-habr` (publication metadata). Polls are
optional content, not frontmatter fields.

## Skill layout

```
<SKILL_DIR>/
├── SKILL.md
├── scripts/
│   ├── poll-status.mjs
│   ├── poll-resume.mjs
│   ├── poll-answer.mjs
│   ├── poll-apply.mjs
│   └── poll-lib.mjs
└── assets/
    └── schemas/
        └── habr-poll-state.schema.json
```

`<SKILL_DIR>` is the directory that contains this file, for example
`.cursor/skills/article-habr-poll/` when installed as Project through ide-agents.

## Quick start

```bash
node <SKILL_DIR>/scripts/poll-status.mjs --target . --slug my-article --json
node <SKILL_DIR>/scripts/poll-resume.mjs --target . --slug my-article --json
node <SKILL_DIR>/scripts/poll-answer.mjs --target . --slug my-article --field decision --value yes --json
node <SKILL_DIR>/scripts/poll-answer.mjs --target . --slug my-article --field question --value "Какой VPN вы используете?" --json
node <SKILL_DIR>/scripts/poll-answer.mjs --target . --slug my-article --field options --value "WireGuard, OpenVPN, Другой" --json
node <SKILL_DIR>/scripts/poll-answer.mjs --target . --slug my-article --field multiple --value no --json
node <SKILL_DIR>/scripts/poll-apply.mjs --target . --slug my-article --json
```

To skip the poll:

```bash
node <SKILL_DIR>/scripts/poll-answer.mjs --target . --slug my-article --field decision --value no --json
```

## Flags

| Flag | Effect |
|------|--------|
| `--target <path>` | Article workspace root |
| `--slug <slug>` | Article folder name |
| `--thread-title <title>` | Recover slug from IDE thread title |
| `--language ru\|en` | Output language |
| `--new` | (`poll-resume`) start over |
| `--field <decision\|question\|options\|multiple>` | (`poll-answer`) |
| `--value <v>` | yes/no, question, or comma-separated options |
| `--force` | (`poll-apply`) replace an existing poll marker block |
| `--dry-run` | Show intended writes without changing files |
| `--json` | Machine-readable JSON |

## Limits

- **Decision**: yes → continue; no → skip and mark complete.
- **Question**: 1–300 characters.
- **Options**: 2–10 unique strings, each ≤ 120 characters.
- **Multiple**: yes/no (multi-select vs single).
- **Placement**: fixed — always appended to the end of `act-3-*.md` (Habr constraint).

## Output

Inserted block at the **end of act-3** (example):

```markdown
<!-- article-kit:habr-poll:start -->
> **Опрос:** Какой VPN вы используете?
>
> - [ ] WireGuard
> - [ ] OpenVPN
> - [ ] Другой
>
> _Один ответ. На Habr опрос только в конце статьи — перенеси в редактор._
<!-- article-kit:habr-poll:end -->
```

State is persisted at `.article-kit/habr-poll/<slug>.json`.

## Output contract

`poll-resume.mjs --json` returns the next step:

- `needs_decision` → yes/no
- `needs_question` → poll question text
- `needs_options` → 2–10 options
- `needs_multiple` → yes/no
- `needs_apply` → run `poll-apply.mjs`
- `skipped` / `all_done` → finished

## Agent instructions

1. Resolve `<SKILL_DIR>` and run `poll-status.mjs` / `poll-resume.mjs`.
2. For `needs_decision`: ask whether a poll helps; save with `--field decision`.
3. If yes: propose question, options, multiple; confirm each step.
4. Run `poll-apply.mjs` — the block is appended to the end of act-3.
5. Do not edit article files directly.
6. Remind the user to recreate the poll in the Habr editor (end of article only).

## Writing guidance

- Prefer a poll when the article invites reader experience or preference.
- Keep options short, concrete, and mutually exclusive.
- Default to single-choice unless multi-select is clearly better.
- Do not suggest mid-article placement — Habr does not support it.
