---
name: article-habr
description: >-
  Adapts a finished article for Habr by selecting the publication format (from a
  bundled registry of 12 Habr formats), target audience (from a bundled registry
  of 21 Habr audiences), complexity (from a bundled registry of 4 levels),
  thematic hubs (from a bundled registry of 431 Habr hubs), and tags through a
  resumable interactive flow, then applies them into the index.md frontmatter
  (format/audience/complexity/tags/hubs fields). Use after article-structure,
  when the drafted article is ready to publish on Habr.
scope: any
---

# Article Habr

Select Habr **format**, **audience**, **complexity**, **hubs**, and **tags** for
a finished article through a resumable interactive dialogue, then write them into
the `format`/`audience`/`complexity`/`tags`/`hubs` frontmatter of `index.md`. The
LLM asks the human-facing questions and proposes candidates; scripts own registry
validation, state persistence, and frontmatter edits.

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
    ├── habr-complexities.json
    └── schemas/
        ├── habr-state.schema.json
        ├── habr-hubs.schema.json
        ├── habr-formats.schema.json
        ├── habr-audiences.schema.json
        └── habr-complexities.schema.json
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
Exactly one audience may be selected. Prefer a specific audience over `other`.

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

## Complexity registry

`assets/habr-complexities.json` is a static registry of 4 Habr complexity levels
from the publication form radio group. Exactly one may be selected (including
`null` / «Не указан»).

| value | ru |
|-------|----|
| `null` | Не указан |
| `low` | Простой |
| `medium` | Средний |
| `high` | Сложный |

Prefer `low` / `medium` / `high` over `null` when the level is clear.

## Hub registry

`assets/habr-hubs.json` is a static registry of 431 Habr thematic hubs parsed
from the habr.com chips suggest panel. Each entry has `{ alias, title, multiauthor }`.
Prefer hubs with `multiauthor: true` (marked `*` on Habr).

## Quick start

```bash
node <SKILL_DIR>/scripts/habr-status.mjs --target . --slug my-article --json
node <SKILL_DIR>/scripts/habr-resume.mjs --target . --slug my-article --json
node <SKILL_DIR>/scripts/habr-answer.mjs --target . --slug my-article --field format --value tutorial --json
node <SKILL_DIR>/scripts/habr-answer.mjs --target . --slug my-article --field audience --value sysadmin --json
node <SKILL_DIR>/scripts/habr-answer.mjs --target . --slug my-article --field complexity --value medium --json
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
| `--field <format\|audience\|complexity\|hubs\|tags>` | (`habr-answer`) which selection to save |
| `--value <v>` | format/audience/complexity value or title, or comma-separated hubs/tags |
| `--force` | (`habr-apply`) overwrite non-empty frontmatter |
| `--dry-run` | Show intended writes without changing files |
| `--json` | Machine-readable JSON |

## Limits

- **Format**: exactly one value from `assets/habr-formats.json`.
- **Audience**: exactly one from `assets/habr-audiences.json`.
- **Complexity**: exactly one from `assets/habr-complexities.json` (`null`/`low`/`medium`/`high`).
- **Hubs**: up to 5 from `assets/habr-hubs.json`.
- **Tags**: up to 10 lowercase strings.

## Output

```yaml
---
tags: ["vpn", "linux", "python", "networking", "sysadmin"]
format: tutorial
audience: "Системное администрирование"
complexity: medium
publication:
hubs: ["Linux", "Python", "*nix", "Сетевые технологии", "Системное администрирование"]
---
```

State is persisted at `.article-kit/habr/<slug>.json`.

## Output contract

`habr-resume.mjs --json` returns the next step:

- `needs_format` → pick one format from `formats.items`
- `needs_audience` → pick exactly one from `audiencesRegistry.items`
- `needs_complexity` → pick exactly one from `complexities.items`
- `needs_hubs` → pick up to `maxHubs` from the hubs registry
- `needs_tags` → propose lowercase tags
- `needs_apply` → run `habr-apply.mjs`
- `all_done` → already applied

## Agent instructions

1. Resolve `<SKILL_DIR>` and run `habr-status.mjs` / `habr-resume.mjs`.
2. For `needs_format`: propose and confirm one format; save with `--field format`.
3. For `needs_audience`: propose and confirm exactly one audience (use
   `brief.audience` as a hint); save with `--field audience`.
4. For `needs_complexity`: propose and confirm exactly one complexity; save with
   `--field complexity`.
5. For `needs_hubs`: propose and confirm hubs (`multiauthor: true` preferred);
   save with `--field hubs`.
6. For `needs_tags`: propose and confirm tags; save with `--field tags`.
7. Run `habr-apply.mjs`. Use `--force` only when the user asks to overwrite.
8. Do not edit `index.md` directly.

## Writing guidance

- Format: match genre (`tutorial`, `retrospective`, `review`, `opinion`…).
- Audience: pick the single best match (VPN/sysadmin → `Системное
  администрирование`). Prefer a specific audience over `Другое`.
- Complexity: match prerequisites and depth (`low` intro, `medium` practical,
  `high` deep dive). Prefer an explicit level over `null` when clear.
- Hubs: match the real subject; prefer multiauthor hubs.
- Tags: lowercase, concrete, established on Habr.
