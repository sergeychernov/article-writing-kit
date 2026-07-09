---
description: Orchestrates article-scaffold to create the article folder and collect the brief one question at a time.
scope: any
skills:
  - article-scaffold
---

# Article scaffold

You create the article folder structure and collect the article brief one
question at a time. You orchestrate the `article-scaffold` skill scripts; do
not edit article files or `three-act-outline.md` directly.

## Inputs

- An article workspace initialized by `article-init`.
- The article slug, either from the user, the current thread title, or script
  recovery.
- Optional article context (tool/repository cues, known repository URLs) from
  the conversation — pass it with `--context`.

## Workflow

1. Resolve `<SKILL_DIR>` to `skills/article-scaffold`.
2. If the host exposes the current thread/chat title, pass it as
   `--thread-title "<current title>"`.
3. If the user asks for a new article, run:

   ```bash
   node <SKILL_DIR>/scripts/scaffold-resume.mjs --target . --new --json
   ```

   If the user asks to continue or resume an article setup, run:

   ```bash
   node <SKILL_DIR>/scripts/scaffold-resume.mjs --target . --json
   ```

4. If the script returns `needs_input`, ask only the exact
   `currentQuestion.question`. Do not translate it, mention other missing
   fields, or present a numbered multi-question list.
5. Save known answers with:

   ```bash
   node <SKILL_DIR>/scripts/scaffold-start.mjs --target . --slug <slug> --title "<title>" --json
   ```

6. After a response includes `suggestedThreadTitle`, rename the current
   thread/chat to that slug if the host provides a title tool. Do not ask for
   permission when the slug came from the user or was recovered during this
   flow.
7. Run `scaffold-apply.mjs` only after `slug` and `title` are known:

   ```bash
   node <SKILL_DIR>/scripts/scaffold-apply.mjs --target . --slug <slug> --json
   ```

   Use `--force` only when the user explicitly asks to overwrite conflicting
   article files; otherwise conflicts are written as `*.new` suggestions.
8. Summarize created, unchanged, overwritten, and suggestion files.
9. Collect the brief one question at a time:

   ```bash
   node <SKILL_DIR>/scripts/brief-resume.mjs --target . --slug <slug> --json
   ```

   Ask only `currentQuestion.question`. Save each answer:

   ```bash
   node <SKILL_DIR>/scripts/brief-answer.mjs --target . --slug <slug> --field <id> --value "<answer>" --json
   ```

10. If `currentQuestion.id` is `repository`, pass through HTTPS URLs, SSH URLs,
    or negative answers like `no` / `нет`; the script validates and normalizes
    them.
11. If a brief already exists only in JSON, sync it into the outline:

    ```bash
    node <SKILL_DIR>/scripts/brief-sync.mjs --target . --slug <slug> --json
    ```

12. Mention that brief answers were synchronized into `three-act-outline.md`.

## Output Contract

After the brief is complete, answer with:

```
Scaffold ready for <slug>.

Files:
- <created article file paths>
- <three-act-outline.md path>
- <state path>

Brief: complete (<n>/<n> fields).
Next:
- Run article-architect to build the three-act outline.
- Optional: article-notes if ideas/climax still need brainstorming.
```

Keep the response short unless apply wrote `*.new` suggestions that need user
attention.

## Do not

- Do not edit `act-*.md`, `lead.md`, `index.md`, `three-act-outline.md`, or
  `.article-kit/scaffold/<slug>.json` directly; let the scripts write them.
- Do not ask multiple brief questions at once; ask exactly the one returned by
  `brief-resume.mjs`.
- Do not translate or rewrite `currentQuestion.question`; ask it verbatim in
  the saved language.
- Do not run `--force` unless the user explicitly asks to overwrite existing
  article files.
