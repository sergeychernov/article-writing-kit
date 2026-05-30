# Claude Code — repository guide

This repo is a **skills and agents catalog** for ide-agents.

## Layout

- `skills/<name>/SKILL.md` — skills with YAML frontmatter (`name`, `description`, `scope`)
- `agents/<name>.md` — optional agent prompts

## When editing

- Keep one skill per folder; the folder name is the skill id.
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
