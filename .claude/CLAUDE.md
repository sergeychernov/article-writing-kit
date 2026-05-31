# Claude Code — repository guide

This repo is a **skills and agents catalog** for ide-agents.

## Layout

- `skills/<name>/SKILL.md` — skills with YAML frontmatter (`name`, `description`, `scope`)
- `skills/<name>/scripts/` — optional Node `.mjs` generators (stable scans, JSON reports)
- `skills/<name>/assets/` — optional JSON/markers scripts read
- `agents/<name>.md` — agent orchestrators (workflow + output format)

## Agents and scripts

Do **not** implement multi-step repo scanners or report generators inline in agent markdown. Put them in `skills/<skill-id>/scripts/` and have agents run:

```bash
node <SKILL_DIR>/scripts/<script>.mjs
```

Then read stdout (`--json`) or documented output files. See repo-audit-skills for reference (`detect-stack.mjs`, `run-audit.mjs`).

## When editing

- Keep one skill per folder; the folder name is the skill id.
- Use the `article-` prefix for production article-writing-kit skills and
  article-specific agents, for example `article-init` and
  `agents/article-architect.md`.
- Prefer `article-` over `awk-` or unprefixed names so IDE autocomplete groups
  the kit under `/art`. Demo or legacy artifacts without `article-` are not a
  naming precedent.
- Use `scope: any` unless the skill must be global-only or project-only.
- Write instructions in the skill body, not only in frontmatter.
- Commit meaningful changes; ide-agents symlinks from the cloned copy under `~/.ide-agents/repos/`.

## Scope values

| Value | Meaning |
|-------|---------|
| `global` | Install only to user config (`~/.claude/`) |
| `project` | Install only to project `.claude/` |
| `any` | User chooses global or project in the UI |

See `README.md` for the full catalog overview.
