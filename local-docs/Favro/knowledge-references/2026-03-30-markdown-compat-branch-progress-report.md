# Markdown Compatibility Branch Progress Report

**Date:** 2026-03-30

**Branch:** `fav-162947`

**Favro card:** `162947` - "Markdown compatibility for card descriptions in editor and API"

## Executive Summary

This branch has implemented the phase 1 core of the markdown compatibility work: checklist export, checklist import, table import, and markdown-as-source-of-truth API behavior for `POST` and `PUT` when `descriptionFormat=markdown`.

The branch has not implemented the attachment round-trip part of the card. That area is only documented in the plans and decision record. The branch therefore matches the "phase 1" behavior reference already written in the local superpowers docs root, not the full Favro card scope.

The biggest reconciliation point is that the design docs explicitly narrow one part of the card scope: named task list names are intentionally not preserved as markdown round-trip metadata. That is a deliberate product/technical decision, not an unintentional omission.

## Sources Used For This Report

- Favro card `162947`
- `/Users/vu/.assistant-preferences/local-docs/Favro/plans/2026-03-23-markdown-compat.md`
- `/Users/vu/.assistant-preferences/local-docs/Favro/plans/2026-03-24-markdown-compat-phase-2-attachments.md`
- `/Users/vu/.assistant-preferences/local-docs/Favro/brainstorm/2026-03-24-markdown-compat-decision-record.md`
- `/Users/vu/.assistant-preferences/local-docs/Favro/knowledge-references/markdown-card-description-current-behavior.md`
- Current branch diff against `origin/master`

## Branch Delta Summary

Merge-base with `origin/master` is `e902bcd697`.

Since that base, the branch contains these commits in order:

1. `1f0d8bb233` `fix: serialize Favro checklists as standard - [ ] / - [x] markdown`
2. `69a9b0c5b5` `feat: parse standard - [ ] / - [x] markdown as Favro checklist nodes`
3. `fcfe0ab4ae` `feat: parse GFM markdown tables into Favro table nodes`
4. `4bccf6385a` `feat: add recreateDocumentFromMarkdown for API markdown PUT/POST`
5. `c48eddf195` `feat: use markdown parser for API PUT/POST when descriptionFormat=markdown`
6. `80a7411907` `fix: wrap table cell inline content in paragraph tokens for prosemirror-markdown`
7. `e3fb520042` `fix: use undefined checks instead of falsy checks in test helpers for position and detailedDescription`
8. `6bfc7faa14` `fix: use undefined checks in test helpers for position and detailedDescription, clean up test cards`
9. `704de03529` `[wip] Add design specs`

Observed diff size versus `origin/master`:

- 12 files changed
- 3231 insertions
- 12 deletions

## What Has Been Implemented

### 1. Checklist markdown export is now standard and stateful

Observed in `MainApp/lib/collaboration/server/favro_markdown.ts`:

- The serializer now emits `- [ ] ` or `- [x] ` based on each checklist item's `completed` state.
- This replaces the previous always-`-[ ]` behavior.

Implementation evidence:

- `MainApp/lib/collaboration/server/favro_markdown.ts:150-155`

### 2. Markdown checkbox import now creates real Favro checklist nodes

Observed in `MainApp/lib/collaboration/server/mongosync/mongosync.ts`:

- Bullet lists whose items begin with `[ ] ` or `[x] ` (standard spaced checkbox prefix after the list marker) are converted into `favro_checklist` nodes.
- Legacy compact `-[ ]` / `-[x]` paragraph syntax is not treated as checklist input; it stays plain paragraph text.
- New `taskListId` and `taskId` values are generated during import for converted lists.

Implementation evidence:

- `MainApp/lib/collaboration/server/mongosync/mongosync.ts:79-179`

Implication:

- Markdown checklist input is no longer just text in the markdown API flow.
- It becomes real document structure, which then drives MongoDB task list/task state through the existing dependency sync path.

### 3. Markdown tables are imported as Favro table nodes

Observed in `MainApp/lib/collaboration/server/favro_markdown.ts`:

- Parser token support was added for `table`, `tr`, and `td`.
- Markdown-it table output is normalized by removing `thead`/`tbody`, converting `th` to `td`, and wrapping inline cell content in paragraph tokens so the ProseMirror schema accepts it.

Implementation evidence:

- `MainApp/lib/collaboration/server/favro_markdown.ts:97-99`
- `MainApp/lib/collaboration/server/favro_markdown.ts:248-303`

Header handling:

- There is no dedicated table-header node type in the document schema. GFM `th` cells import as bold text in the first row.
- Export uses a bold-text heuristic: an all-bold first row becomes a GFM table header with separator row; otherwise export falls back to a non-header table markdown shape. This matches the knowledge reference doc on reconciled phase 1 behavior.

### 4. API markdown PUT and POST now use whole-document replacement semantics

Observed in `MainApp/lib/collaboration/collaboration_card.server.ts`:

- `recreateDocumentFromMarkdown(...)` was added.
- It parses markdown, applies checkbox conversion, and replaces the document with `replaceWithDoc`.
- Markdown rebuild runs first on the markdown API path; API-supplied task lists are appended afterward (see API section below), not merged into the markdown parse in place of `tasklists`.

Implementation evidence:

- `MainApp/lib/collaboration/collaboration_card.server.ts:273-285`

Observed in `MainApp/server/api/cards/api_cards.ts`:

- `POST` uses `recreateDocumentFromMarkdown(...)` when `descriptionFormat=markdown` and `detailedDescription !== undefined`.
- `PUT` uses the same markdown-aware path under the same condition.
- Empty string markdown is intentionally allowed on the markdown path, which enables clearing the document on `PUT`.

Implementation evidence:

- `MainApp/server/api/cards/api_cards.ts:345-361`
- `MainApp/server/api/cards/api_cards.ts:760-764`

### 5. Markdown plus API `tasklists` / `addTasklists` on the same request

Observed in `MainApp/server/api/cards/api_cards.ts`:

- When `descriptionFormat=markdown` and `detailedDescription` is provided, the card document is recreated from markdown first.
- If `tasklists` (on `POST`) or `addTasklists` (on `PUT`) are also present, `ApiTaskListShared.addTaskLists(...)` runs **after** that and appends those lists to the end of the document.
- When markdown format is requested but `detailedDescription` is not provided, legacy task list behavior applies without the markdown document rebuild path.

Implementation evidence:

- `MainApp/server/api/cards/api_cards.ts` (POST: `shouldAppendTasklistsAfterMarkdown` and conditional `addTaskLists`)
- `MainApp/server/api/cards/api_cards.ts` (PUT: same flag and ordering relative to `recreateDocumentFromMarkdown`)

### 6. Test coverage was added for the phase 1 behavior

Observed unit coverage:

- `MainApp/lib/collaboration/server/unittests/favro_markdown.app-test.ts`
- Checklist serialization
- Checkbox import (standard spaced list items)
- Legacy compact `-[ ]` paragraph treated as plain text; lookalike escaping on export
- Checklist round-trip
- Table import and table round-trip

Observed API/integration-style coverage:

- `Test/src/api/apitest_cards.ts:631-940`
- POST checklist creation from markdown
- PUT checklist creation from markdown
- GET checklist export in standard markdown
- GET-then-PUT round-trip
- Markdown-first `POST` with `tasklists` appended after
- Table round-trip
- Imported checklist behavior through task/tasklist APIs
- Mixed document coverage
- Unsupported markdown degradation
- Empty markdown clearing behavior

Test helper updates were also made to align expected behavior with markdown semantics:

- `Test/src/api/methods/apitest_cardmethods.ts`
- `Test/src/api/methods/apitest_taskmethods.ts`

## What Has Not Been Implemented

### 1. Attachment round-trip remains unimplemented

Despite the Favro card explicitly calling out attachments, the code on this branch still has phase 1 attachment behavior:

- Favro-hosted file attachments are still exported as markdown images pointing at temporary URLs.
- Favro card and board attachments are still exported as ordinary Favro links.
- Inaccessible Favro attachments still degrade to plaintext permission text.
- Markdown import still does not recreate `file_attachment` or `favro_attachment` nodes.
- `image_grid` layout is still not reconstructed on round-trip.

Observed current code:

- `MainApp/lib/collaboration/server/favro_markdown.ts:182-215`

Observed current documented behavior:

- `/Users/vu/.assistant-preferences/local-docs/Favro/knowledge-references/markdown-card-description-current-behavior.md` (attachment section)

Observed phase 2 plan, not yet implemented:

- `/Users/vu/.assistant-preferences/local-docs/Favro/plans/2026-03-24-markdown-compat-phase-2-attachments.md:1-46`
- `/Users/vu/.assistant-preferences/local-docs/Favro/plans/2026-03-24-markdown-compat-phase-2-attachments.md:491-568`
- `/Users/vu/.assistant-preferences/local-docs/Favro/plans/2026-03-24-markdown-compat-phase-2-attachments.md:719-810`

### 2. Reserved attachment URLs are decided but absent from code

The decision record says attachments should serialize to reserved Favro-owned HTTPS paths under `__md_favro_attachment`.

That has not happened yet. The current serializer still uses:

- resolved file URLs for non-drive `file_attachment`
- resolved direct Favro links for `favro_attachment`
- plaintext fallback for denied Favro attachments

Spec/decision evidence:

- `/Users/vu/.assistant-preferences/local-docs/Favro/brainstorm/2026-03-24-markdown-compat-decision-record.md:16-20`
- `/Users/vu/.assistant-preferences/local-docs/Favro/brainstorm/2026-03-24-markdown-compat-decision-record.md:161-220`

Code evidence of current behavior:

- `MainApp/lib/collaboration/server/favro_markdown.ts:182-215`

### 3. No attachment-aware markdown import path exists yet

The phase 2 plan expects:

- a `markdown_attachments.ts` helper
- attachment-aware parsing inside the markdown import path
- an updated `recreateDocumentFromMarkdown(...)`
- an authenticated server route for reserved attachment URLs
- extracted API auth helpers

None of those files or codepaths are present in the current diff.

### 4. Public API documentation updates are still missing

The phase 1 plan explicitly says the public API docs should be updated to explain:

- markdown source-of-truth semantics on `POST` and `PUT`
- markdown-first document build with `tasklists` / `addTasklists` appended after on the same request
- plain text continuing to live in `common.detailedDescription`

I did not find public API doc changes on this branch. The only added documentation is in the local superpowers docs root.

Plan evidence:

- `/Users/vu/.assistant-preferences/local-docs/Favro/plans/2026-03-23-markdown-compat.md:1089-1092`

## Reconciliation Points Against The Favro Card

### 1. Named task list behavior has been consciously narrowed

The Favro card says named task lists should not be silently broken and asks whether names should round-trip.

The decision record resolves that question by explicitly choosing not to preserve task list names as markdown metadata. Export keeps the bold paragraph presentation, but import treats that bold paragraph as normal content.

This is not a missing implementation detail. It is a deliberate scope decision that needs product/spec reconciliation.

Evidence:

- Favro card open question and checklist item
- `/Users/vu/.assistant-preferences/local-docs/Favro/plans/2026-03-23-markdown-compat.md:25-33`
- `/Users/vu/.assistant-preferences/local-docs/Favro/brainstorm/2026-03-24-markdown-compat-decision-record.md:13-20`
- `/Users/vu/.assistant-preferences/local-docs/Favro/brainstorm/2026-03-24-markdown-compat-decision-record.md:22-52`

### 2. The branch is phase 1 complete in intent, not card complete

The knowledge reference document is accurate: this branch is a phase 1 branch.

It adds:

- standard checklist export
- checkbox import
- table import
- markdown document-source-of-truth semantics
- markdown-first semantics with API task lists appended after on `POST` / `PUT`

It still does not add:

- attachment round-trip
- image-grid round-trip
- markdown image import
- broader markdown feature support

Evidence:

- `/Users/vu/.assistant-preferences/local-docs/Favro/knowledge-references/markdown-card-description-current-behavior.md` (high-level delta, tables, practical summary)

### 3. Planner8-specific syntax expectations are not clearly enforced in touched code

The Favro card and phase 1 plan both mention that Planner8 should only support the standard spaced checkbox form `- [ ]` / `- [x]`.

What the code currently does:

- exports only the standard spaced form
- accepts the standard spaced checkbox list form on import in the markdown API path
- does not treat legacy compact `-[ ]` paragraph syntax as checklist input (it remains plain text)

If Planner8 behavior is meant to be stricter than generic API compatibility, I do not see a Planner8-specific enforcement point in the changed files.

### 4. Table import is implemented with deliberate semantic loss

The card asks that header rows not break import even though Favro does not use header semantics.

The branch implements that by mapping `th` to bold text in the first row (heuristic) and using a bold-first-row heuristic on export for GFM headers. If the intended product behavior was richer than that, that would need reconciliation, but the current implementation matches the reconciled phase 1 design in the knowledge reference.

## Overall Status Assessment

### Status by area

- Checklists: implemented on branch
- Tables: implemented on branch
- Markdown API source-of-truth semantics: implemented on branch
- POST/PUT markdown-first flow with `tasklists` / `addTasklists` appended after: implemented on branch
- Attachment round-trip: not implemented
- Reserved markdown attachment URL system: not implemented
- Image-grid preservation: not implemented
- Public API docs update: not implemented
- Named task list preservation: explicitly rejected by design decision and therefore pending reconciliation

### Best current description of the branch

This branch is best understood as "phase 1 implemented plus design/spec groundwork for phase 2", not "full card implementation".

That means the branch is already valuable and non-trivial, but it is carrying an unresolved contract gap relative to the card's full attachment requirements and a deliberate narrowing around named task list round-trip.

## Verification Status

I ran `make check` on 2026-03-30 in this workspace and it completed successfully.

I also attempted a focused unittest run with:

```bash
MOCHA_GREP="favro_markdown|Markdown round-trip" ./startdebug_unittest.sh --once
```

That command did not reach test execution in this environment and exited with:

```text
Timed out waiting for command line actor to appear
```

So the report can rely on:

- code inspection
- branch history
- documentation inspection
- successful `make check`

It cannot claim that the new markdown runtime tests were re-executed successfully in this session.

## Suggested Starting Point For The Next Planning Pass

Before writing the adjustment plan, the main questions to settle are:

1. Is the deliberate decision to not preserve named task list names still acceptable?
2. Should attachment round-trip now be treated as required for this branch before merge, or as an explicitly separate follow-up?
3. Do we need stricter product language around standard `- [ ]` authoring expectations now that legacy `-[ ]` is not supported API checklist input?
4. Do public API docs need to land in the same branch as the behavior change?
