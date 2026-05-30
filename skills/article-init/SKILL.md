---
name: article-init
description: >-
  Initializes or retrofits a repository for AI-assisted long-form article
  writing with an Obsidian-friendly Markdown structure. Creates project
  instructions and Cursor article rules from bundled templates via
  scripts/init-workspace.mjs. Use when setting up a writing repo, preparing an
  Obsidian article vault, or starting the article-writing kit from scratch.
scope: any
---

# Article init

Bootstraps the article-writing workspace in the target repository. The stable
work is done by `scripts/init-workspace.mjs`; this skill should mostly run the
script and summarize the result.

## Skill layout

```
<SKILL_DIR>/
├── SKILL.md
├── scripts/
│   └── init-workspace.mjs
└── assets/
    ├── AGENTS.md
    ├── CLAUDE.md
    └── article-writing-obsidian.mdc
```

`<SKILL_DIR>` is the directory that contains this file, for example
`.cursor/skills/article-init/` when installed as Project through ide-agents.

## Quick start

Run from the target article repository:

```bash
node <SKILL_DIR>/scripts/init-workspace.mjs
```

Or initialize a specific path:

```bash
node <SKILL_DIR>/scripts/init-workspace.mjs --target /path/to/articles
```

## Flags

| Flag | Effect |
|------|--------|
| `--target <path>` | Initialize this directory instead of the current working directory |
| `--dry-run` | Show intended changes without writing files |
| `--force` | Overwrite conflicting files instead of writing `*.new` suggestions |
| `--claude` | Also create `.claude/CLAUDE.md` |
| `--json` | Print machine-readable JSON |

## Output

By default the script creates missing files only:

| Target file | Source template |
|-------------|-----------------|
| `AGENTS.md` | `assets/AGENTS.md` |
| `.cursor/rules/article-writing-obsidian.mdc` | `assets/article-writing-obsidian.mdc` |
| `.claude/CLAUDE.md` | `assets/CLAUDE.md` when `--claude` is passed |

If a target file already exists with different content, the script preserves it
and writes a `*.new` suggestion unless `--force` is passed.

## Agent instructions

When the user asks to initialize an article workspace:

1. Resolve `<SKILL_DIR>` from the installed skill path.
2. Run `init-workspace.mjs` in the target repository, or with `--target` if the
   user named a path.
3. Use `--dry-run` first when the repository already has article or assistant
   instructions.
4. Summarize created, unchanged, overwritten, and suggestion files.
5. Mention that Obsidian is optional and that a vault is a local Markdown folder.
6. Recommend the next tool: `article-scaffold` for creating the first article.
