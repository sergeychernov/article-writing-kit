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
│   └── <agent-id>.md         # optional — frontmatter: description, scope, skills
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

Agent files live in `agents/<name>.md`. YAML frontmatter may include
`description`, `scope`, `skills`, and `subagents`.

```yaml
---
description: Orchestrates article-architect.
scope: any
skills:
  - article-architect
---
```

`skills` lists the skill id the agent itself orchestrates (the scripts it
calls). `subagents` lists other agent ids a router agent delegates to (for
example `article-assistant`). ide-agents auto-installs both. When present,
write either as a YAML block list. Standalone demo agents omit `skills`; do
not use inline arrays such as `skills: []` or `skills: [article-architect]`.

## Current artifacts

| Kind | ID | Purpose |
|------|-----|---------|
| skill | `article-init` | Script-driven initialization for an Obsidian-friendly article workspace |
| skill | `article-scaffold` | Wizard-style article folder scaffolding with resumable state |
| skill | `article-architect` | Script-backed three-act architecture from a completed article brief |
| skill | `article-structure` | Post-draft interactive heading labelling for already-written act-*.md files |
| skill | `article-notes` | Optional pre-scaffold brainstorming notes (ideas, theses, cases, questions, climax) |
| skill | `article-assistant` | Read-only pipeline router; determines the stage and delegates to a subagent |
| agent | `article-init` | Orchestrates workspace initialization |
| agent | `article-scaffold` | Orchestrates folder scaffolding and the brief dialogue |
| agent | `article-architect` | Orchestrates the article architecture workflow and calls the skill scripts |
| agent | `article-structure` | Orchestrates the interactive heading-labelling dialogue and calls the skill scripts |
| agent | `article-notes` | Orchestrates the pre-scaffold notes dialogue |
| agent | `article-assistant` | Editorial assistant; routes to the right subagent by stage |
| agent | `oracle` | Demo/starter agent; not a naming precedent for article-writing-kit artifacts |

## Local testing

After installing the skills as **Project** in ide-agents, run this inside a target writing repo:

```bash
node .cursor/skills/article-init/scripts/init-workspace.mjs --dry-run
node .cursor/skills/article-scaffold/scripts/scaffold-resume.mjs --new --json
node .cursor/skills/article-scaffold/scripts/brief-resume.mjs --slug my-article --json
node .cursor/skills/article-scaffold/scripts/brief-sync.mjs --slug my-article --json
node .cursor/skills/article-architect/scripts/architect-status.mjs --slug my-article --json
node .cursor/skills/article-architect/scripts/architect-prepare.mjs --slug my-article --json
node .cursor/skills/article-structure/scripts/structure-status.mjs --slug my-article --json
node .cursor/skills/article-structure/scripts/structure-resume.mjs --slug my-article --json
node .cursor/skills/article-notes/scripts/notes-resume.mjs --slug my-article --json
node .cursor/skills/article-assistant/scripts/pipeline-status.mjs --slug my-article --json
```

## Next steps

1. Edit or add skills under `skills/` and agents under `agents/`.
2. Commit and push to your remote.
3. In ide-agents, open **Skills** / **Agents** and toggle **Global** or **Project** to symlink into your IDE.
