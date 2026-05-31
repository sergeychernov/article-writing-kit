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

## Naming convention

Production article-writing-kit skills use the `article-` prefix in both the
folder name and frontmatter `name`, for example `article-init`. Article-specific
agents use the same prefix, for example `agents/article-architect.md`.

Prefer `article-` over `awk-` because it is readable and groups naturally in IDE
autocomplete via `/art`. Do not add new unprefixed article skills or agents.
Starter/demo artifacts without `article-` are not a naming precedent.

## Agents

Agent files live in `agents/<name>.md`. Optional YAML frontmatter with `description` and `scope`.

## Current artifacts

| Kind | ID | Purpose |
|------|-----|---------|
| skill | `article-init` | Script-driven initialization for an Obsidian-friendly article workspace |
| skill | `article-scaffold` | Wizard-style article folder scaffolding with resumable state |
| agent | `oracle` | Demo/starter agent; not a naming precedent for article-writing-kit artifacts |

## Local testing

After installing the skills as **Project** in ide-agents, run this inside a target writing repo:

```bash
node .cursor/skills/article-init/scripts/init-workspace.mjs --dry-run
node .cursor/skills/article-scaffold/scripts/scaffold-resume.mjs --new --json
node .cursor/skills/article-scaffold/scripts/brief-resume.mjs --slug my-article --json
node .cursor/skills/article-scaffold/scripts/brief-sync.mjs --slug my-article --json
```

## Next steps

1. Edit or add skills under `skills/` and agents under `agents/`.
2. Commit and push to your remote.
3. In ide-agents, open **Skills** / **Agents** and toggle **Global** or **Project** to symlink into your IDE.
