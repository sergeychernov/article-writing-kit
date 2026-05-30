# Skills & agents catalog

A git repository of **IDE skills** and **agents** for Cursor, Claude Code, and Codex.

Managed with [ide-agents](https://github.com/sergeychernov/ide-agents) — clone this repo in the UI, then install artifacts globally or per project.

## Layout

```
.
├── skills/
│   └── <skill-id>/
│       └── SKILL.md          # required — frontmatter: name, description, scope
├── agents/
│   └── <agent-id>.md         # optional — frontmatter: description, scope
├── .cursor/rules/            # Cursor project rules (repo structure)
├── .claude/CLAUDE.md         # Claude Code project instructions
└── .agents/AGENTS.md         # Codex project instructions
```

## SKILL.md frontmatter

```yaml
---
name: my-skill
description: What this skill does.
scope: any   # global | project | any
---
```

## Agents

Agent files live in `agents/<name>.md`. Optional YAML frontmatter with `description` and `scope`.

## Sample artifacts

This repo was bootstrapped with starter skills and agents. Replace or remove them as you build your catalog.

| Kind | ID | Purpose |
|------|-----|---------|
| skill | `article-init` | Script-driven initialization for an Obsidian-friendly article workspace |
| skill | `article-scaffold` | Wizard-style article folder scaffolding with resumable state |
| skill | `hello` | Smoke-test skill for installations |
| skill | `article-outline` | Outline a long-form article |
| agent | `editor` | Review and tighten prose |
| agent | `researcher` | Gather facts and sources |

## Local testing

After installing the skills as **Project** in ide-agents, run this inside a target writing repo:

```bash
node .cursor/skills/article-init/scripts/init-workspace.mjs --dry-run
node .cursor/skills/article-scaffold/scripts/scaffold-resume.mjs --new --json
```

## Next steps

1. Edit or add skills under `skills/` and agents under `agents/`.
2. Commit and push to your remote.
3. In ide-agents, open **Skills** / **Agents** and toggle **Global** or **Project** to symlink into your IDE.
