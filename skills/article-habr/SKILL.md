---
name: article-habr
description: >-
  Adapts a finished article for Habr by selecting the publication format (from a
  bundled registry of 12 Habr formats), target audience (from a bundled registry
  of 21 Habr audiences), thematic hubs (from a bundled registry of 431 Habr hubs),
  and tags through a resumable interactive flow, then applies them into the
  index.md frontmatter (format/audience/tags/hubs fields). Use after
  article-structure, when the drafted article is ready to publish on Habr.
scope: any
---

# Article Habr

Select Habr **format**, **audience**, **hubs**, and **tags** for a finished
article through a resumable interactive dialogue, then write them into the
`format`/`audience`/`tags`/`hubs` frontmatter of `index.md`. The LLM asks the
human-facing questions and proposes candidates; scripts own registry validation,
state persistence, and frontmatter edits.

This skill is the publish-prep counterpart to `article-structure`: structure
labels the drafted article with headings; this skill labels it with Habr
metadata.

## Skill layout

```
<SKILL_DIR>/
├── SKILL.md
├── scripts/
│   ├── habr-status.mjs
│   ├── habr-resume.mjs
│   ├── habr-answer.mjs
│   ├── habr-apply.mjs
│   └── habr-lib.mjs
└── assets/
    ├── habr-hubs.json
    ├── habr-formats.json
    ├── habr-audiences.json
    └── schemas/
        ├── habr-state.schema.json
        ├── habr-hubs.schema.json
        ├── habr-formats.schema.json
        └── habr-audiences.schema.json
```

`<SKILL_DIR>` is the directory that contains this file, for example
`.cursor/skills/article-habr/` when installed as Project through ide-agents.

## Format registry

`assets/habr-formats.json` is a static registry of 12 Habr publication formats
from the publication form radio group. Each entry has `{ value, title: { ru, en } }`.
Prefer a specific format over `common` when the article clearly matches one.

## Audience registry

`assets/habr-audiences.json` is a static registry of 21 Habr target audience
options from the publication form. Each entry has `{ alias, title: { ru, en } }`.
Up to 5 audiences may be selected. Prefer specific audiences over `other`.

| alias | ru |
|-------|----|
| `backend` | Бэкенд |
| `frontend` | Фронтенд |
| `mobile` | Мобильная разработка |
| `sysadmin` | Системное администрирование |
| `security` | Информационная безопасность |
| `ai-ml` | AI и ML |
| `industrial` | Промышленная инженерия |
| `gamedev` | Геймдев |
| `testing` | Тестирование |
| `support` | Техническая поддержка |
| `analysis` | Системный и бизнес-анализ |
| `design` | Дизайн |
| `management` | Менеджмент |
| `top-management` | Топ-менеджмент |
| `marketing` | Маркетинг и контент |
| `hr` | HR |
| `hardware` | Железо и гаджеты |
| `diy` | DIY |
| `health` | Здоровье |
| `science` | Научпоп |
| `other` | Другое |

## Hub registry

`assets/habr-hubs.json` is a static registry of 431 Habr thematic hubs parsed
from the habr.com chips suggest panel. Each entry has `{ alias, title, multiauthor }`.
Prefer hubs with `multiauthor: true` (marked `*` on Habr).

## Quick start

```bash
node <SKILL_DIR>/scripts/habr-status.mjs --target . --slug my-article --json
node <SKILL_DIR>/scripts/habr-resume.mjs --target . --slug my-article --json
node <SKILL_DIR>/scripts/habr-answer.mjs --target . --slug my-article --field format --value tutorial --json
node <SKILL_DIR>/scripts/habr-answer.mjs --target . --slug my-article --field audience --value "sysadmin, backend" --json
node <SKILL_DIR>/scripts/habr-answer.mjs --target . --slug my-article --field hubs --value "Linux, Python" --json
node <SKILL_DIR>/scripts/habr-answer.mjs --target . --slug my-article --field tags --value "vpn, linux" --json
node <SKILL_DIR>/scripts/habr-apply.mjs --target . --slug my-article --json
```

## Flags

| Flag | Effect |
|------|--------|
| `--target <path>` | Article workspace root |
| `--slug <slug>` | Article folder name |
| `--thread-title <title>` | Recover slug from IDE thread title |
| `--language ru\|en` | Output language |
| `--new` | (`habr-resume`) start over |
| `--field <format\|audience\|hubs\|tags>` | (`habr-answer`) which selection to save |
| `--value <v>` | format value/title, or comma-separated audiences/hubs/tags |
| `--force` | (`habr-apply`) overwrite non-empty frontmatter |
| `--dry-run` | Show intended writes without changing files |
| `--json` | Machine-readable JSON |

## Limits

- **Format**: exactly one value from `assets/habr-formats.json`.
- **Audience**: up to 5 from `assets/habr-audiences.json`.
- **Hubs**: up to 5 from `assets/habr-hubs.json`.
- **Tags**: up to 10 lowercase strings.

## Output

```yaml
---
tags: ["vpn", "linux", "python", "networking", "sysadmin"]
format: tutorial
audience: ["Системное администрирование", "Бэкенд"]
publication:
hubs: ["Linux", "Python", "*nix", "Сетевые технологии", "Системное администрирование"]
---
```

State is persisted at `.article-kit/habr/<slug>.json`.

## Output contract

`habr-resume.mjs --json` returns the next step:

- `needs_format` → pick one format from `formats.items`
- `needs_audience` → pick up to `maxAudiences` from `audiencesRegistry.items`
- `needs_hubs` → pick up to `maxHubs` from the hubs registry
- `needs_tags` → propose lowercase tags
- `needs_apply` → run `habr-apply.mjs`
- `all_done` → already applied

## Agent instructions

1. Resolve `<SKILL_DIR>` and run `habr-status.mjs` / `habr-resume.mjs`.
2. For `needs_format`: propose and confirm one format; save with `--field format`.
3. For `needs_audience`: propose and confirm up to 5 audiences (use
   `brief.audience` as a hint); save with `--field audience`.
4. For `needs_hubs`: propose and confirm hubs (`multiauthor: true` preferred);
   save with `--field hubs`.
5. For `needs_tags`: propose and confirm tags; save with `--field tags`.
6. Run `habr-apply.mjs`. Use `--force` only when the user asks to overwrite.
7. Do not edit `index.md` directly.

## Writing guidance

- Format: match genre (`tutorial`, `retrospective`, `review`, `opinion`…).
- Audience: match who the article is for (VPN/sysadmin → `Системное
  администрирование`, maybe `Бэкенд`). Prefer specific audiences over `Другое`.
- Hubs: match the real subject; prefer multiauthor hubs.
- Tags: lowercase, concrete, established on Habr.
