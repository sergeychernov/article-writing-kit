# Codex — repository guide

This repository holds **Agent Skills** and **agents** consumed by ide-agents.

## Expected layout

```
skills/<skill-id>/SKILL.md
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

## Agents

Markdown files in `agents/` with optional frontmatter. Project installs use `.agents/agents/<name>.md`.

## Editing rules

- Do not flatten skills to repo root unless you intentionally use the flat layout (ide-agents detects nested `skills/` first).
- Preserve skill folder names — they become installation ids.
- Push to git after changes so remote catalogs stay in sync.

See `README.md` for usage with ide-agents.
