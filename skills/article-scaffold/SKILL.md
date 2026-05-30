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

Create a new article folder from templates, or resume a partially completed
setup. The LLM asks the human-facing questions; scripts own state recovery,
slug normalization, file creation, and conflict handling.

## Skill layout

```
<SKILL_DIR>/
├── SKILL.md
├── scripts/
│   ├── scaffold-start.mjs
│   ├── scaffold-status.mjs
│   ├── scaffold-resume.mjs
│   ├── scaffold-apply.mjs
│   └── scaffold-lib.mjs
└── assets/
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

## Flags

| Flag | Effect |
|------|--------|
| `--target <path>` | Article workspace root; default is current working directory |
| `--slug <slug>` | Article folder name; unsafe characters are normalized |
| `--title <title>` | Article title for `index.md` and `three-act-outline.md` |
| `--language ru\|en` | Template language; default is `ru` |
| `--dry-run` | Show intended changes without writing article files |
| `--force` | Overwrite conflicting article files instead of writing `*.new` suggestions |
| `--new` | Ignore saved scaffold state and ask for a new article slug |
| `--json` | Print machine-readable JSON |

## Thread title

Scripts return `suggestedThreadTitle` once the article title is known. Scripts do
not rename IDE chats directly because that is host-specific.

If the current IDE exposes a thread/chat title tool, rename the current thread to
`suggestedThreadTitle` after the title step succeeds. In Codex, use the thread
title tool when available. Do not ask the user for permission to rename when the
title came from the user during this scaffold flow.

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

Wizard state is stored in `.article-kit/scaffold/<slug>.json`. If the state file
is missing, `scaffold-status.mjs` and `scaffold-resume.mjs` still recover from
the article folder structure and `index.md` title when possible.

Existing article files are preserved by default. Conflicts create `*.new`
suggestions; `--force` is required to overwrite.

## Agent instructions

When the user wants to create a new article:

1. If the user asks for a new article, run `scaffold-resume.mjs --new --json`.
2. If the user asks to continue or resume an article setup, run
   `scaffold-resume.mjs --json`.
3. If the script returns `needs_input`, ask only `currentQuestion`; do not mention
   other missing fields or present a numbered multi-question list.
4. Save known answers with `scaffold-start.mjs --json` when a slug is known.
5. After a script response includes `suggestedThreadTitle`, rename the current
   thread/chat to that value if the host provides a title tool.
6. Run `scaffold-apply.mjs` only after `slug` and `title` are known.
7. Summarize created, unchanged, overwritten, and suggestion files.
8. Recommend `article-architect` next to fill `three-act-outline.md`.
