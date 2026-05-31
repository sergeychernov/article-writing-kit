# Codex — repository guide

This repository holds **Agent Skills** and **agents** consumed by ide-agents.

## Expected layout

```
skills/<skill-id>/
├── SKILL.md
├── scripts/       # optional — *.mjs generators (stdlib, ESM)
└── assets/        # optional — JSON config for scripts
agents/<agent-id>.md
```

## SKILL.md

Required frontmatter:

```yaml
---
name: skill-id
description: Short summary for the UI.
scope: any
---
```

Project installs symlink into `<project>/.agents/skills/<name>`.

## Naming

- Production article-writing-kit skills must use the `article-` prefix in the
  folder name and frontmatter `name`, for example `article-init`.
- Article-specific agents must also use `article-`, for example
  `agents/article-architect.md`.
- Prefer `article-` over `awk-` or unprefixed names so IDE autocomplete can
  group the kit under `/art`.
- Existing demo or legacy artifacts without `article-` are not a naming
  precedent.

## Agents

Markdown files in `agents/` with optional frontmatter. Project installs use `.agents/agents/<name>.md`.

Agents define **role and workflow** only. Repeatable generators (stack detection, audits, structured reports) go in `skills/<skill-id>/scripts/` — agents invoke `node <SKILL_DIR>/scripts/….mjs` instead of improvising the same logic in chat. Pattern: [repo-audit-skills](https://github.com/sergeychernov/repo-audit-skills).

## Editing rules

- Do not flatten skills to repo root unless you intentionally use the flat layout (ide-agents detects nested `skills/` first).
- Preserve skill folder names — they become installation ids.
- Push to git after changes so remote catalogs stay in sync.

See `README.md` for usage with ide-agents.
