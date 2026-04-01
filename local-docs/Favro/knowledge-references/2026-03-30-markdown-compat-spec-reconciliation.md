# Markdown Compatibility Spec Reconciliation

**Date started:** 2026-03-30

**Branch:** `fav-162947`

**Scope of this note:** This is the single accumulating source of truth for the markdown-compatibility spec reconciliation cycle for this branch.

## Current Baseline

The current branch scope is phase 1 only:

- checklist markdown export/import
- table markdown import
- markdown-as-source-of-truth API behavior for `POST` and `PUT` when `descriptionFormat=markdown`

The current branch does not implement attachment round-trip.

Reference docs:

- [Phase 1 plan](/Users/vu/.assistant-preferences/local-docs/Favro/plans/2026-03-23-markdown-compat.md)
- [Phase 2 parked note](/Users/vu/.assistant-preferences/local-docs/Favro/plans/2026-03-24-markdown-compat-phase-2-attachments.md)
- [Decision record](/Users/vu/.assistant-preferences/local-docs/Favro/brainstorm/2026-03-24-markdown-compat-decision-record.md)
- [Progress report](/Users/vu/.assistant-preferences/local-docs/Favro/knowledge-references/2026-03-30-markdown-compat-branch-progress-report.md)
- [Master vs branch matrix](/Users/vu/.assistant-preferences/local-docs/Favro/knowledge-references/2026-03-30-markdown-compat-master-vs-branch-summary-matrix.md)

## Reconciliation Workflow

This workflow is mandatory for each adjustment iteration in this reconciliation cycle.

1. The user asks a question about the current implementation, or proposes a requirement adjustment.
2. Verify the claim against the current branch and existing docs before accepting or rejecting it.
3. State whether the question or proposed adjustment is valid, invalid, conflicting, incomplete, or still open.
4. Brainstorm the adjustment with the user until the intended requirement is precise enough to document.
5. Give technical advice where it materially improves clarity, safety, implementation cost, or compatibility.
6. If the adjustment changes agreed behavior, update the decision record accordingly.
7. Record the adjustment in this note as a new dated section so future planning can use it without re-deriving context.

## Agent Guideline

Because this reconciliation cycle may grow large, treat this note as the first place to recover context before continuing later iterations.

When adding a new section:

- always cite the code or docs that were checked
- separate observed current behavior from proposed behavior
- distinguish resolved decisions from still-open questions
- record any product or technical tradeoff that should survive into implementation planning
- keep the section self-contained enough that a later agent can continue without rereading the entire conversation

## Section Template For Future Iterations

Use one new section per accepted iteration, with this shape:

### Iteration N - Short Title

**User prompt**

Brief statement of the question or proposed requirement adjustment.

**Verification**

- What code and docs were checked
- What the current branch actually does
- Whether the user's premise was correct

**Discussion**

- Clarifications made during brainstorming
- Key tradeoffs
- Recommended interpretation

**Decision**

- Final agreed requirement adjustment for this iteration
- Whether the decision record was updated

**Planning impact**

- What a future implementation-plan adjustment will likely need to cover
- Any explicit non-goals or deferred questions

## Iterations

### Iteration 1 - Table Header Heuristic

**User prompt**

Check whether table headers are supported during API markdown round-trip now. Desired adjustment:

- import markdown table headers as bold text
- export GFM tables with headers
- only treat the first row as a header on export if every first-row cell is exactly one bold span wrapping the whole cell text content

**Verification**

Checked:

- [favro_markdown.ts](/Users/vu/Development/Favro/MainApp/lib/collaboration/server/favro_markdown.ts)
- [favro_markdown.app-test.ts](/Users/vu/Development/Favro/MainApp/lib/collaboration/server/unittests/favro_markdown.app-test.ts)
- [2026-03-23-markdown-compat.md](/Users/vu/.assistant-preferences/local-docs/Favro/plans/2026-03-23-markdown-compat.md)
- [markdown-card-description-current-behavior.md](/Users/vu/.assistant-preferences/local-docs/Favro/knowledge-references/markdown-card-description-current-behavior.md)

Observed current branch behavior:

- import rewrites `th` to `td` and does not add bold formatting
- export writes a synthetic empty header row rather than a meaningful GFM header row
- tests only verify table-node import and data preservation, not header styling or header round-trip
- the current docs explicitly say true header semantics are not preserved

Conclusion:

- the user's premise was correct
- the requested behavior is not implemented today
- the requested change is plausible and additive, but it changes the current phase 1 table contract

**Discussion**

Refined requirement:

- markdown header rows should not imply a new schema concept
- instead, header intent should be represented through formatting in the existing schema
- the import side should convert header cells into bold text in the first row
- the export side should use a conservative heuristic so only clearly header-like first rows become GFM headers

Chosen export heuristic:

- the first row counts as a header only if every cell contains exactly one bold span
- that bold span must cover the whole cell text content
- mixed content, partial bolding, or extra inline nodes should not qualify

Why this is a good fit:

- it avoids broad schema changes
- it is explicit enough to test
- it minimizes false positives on export

**Decision**

Accepted requirement adjustment:

- GFM header import should become bold text in the first Favro table row
- GFM header export should happen only when every cell in the first row is exactly one bold span covering the entire cell text content

Decision record updated:

- yes, added a new active decision for table header semantics

**Planning impact**

A future implementation-plan adjustment will likely need to cover:

- parser-side handling of header rows so imported `th` cells become bold content, not plain cells
- serializer-side detection of the exact bold-only first-row pattern
- fallback export behavior when the first row does not qualify
- unit tests for positive and negative header detection cases
- API round-trip coverage for import and re-export of header tables

Explicit non-goals for this iteration:

- no new true header-row schema type
- no broader table-model redesign

### Iteration 2 - Markdown With API Task List Payloads

**User prompt**

Adjustment request:

- `POST` for cards should support both markdown description and `tasklists`
- `PUT` should support markdown description together with `addTasklists`
- markdown description should always be used to construct the card document first
- only then should the additional API task lists be applied at the end of the document
- the reason for the change is compatibility with existing API consumers that already use `tasklists` / `addTasklists`

**Verification**

Checked:

- [api_cards.ts](/Users/vu/Development/Favro/MainApp/server/api/cards/api_cards.ts)
- [apitest_cards.ts](/Users/vu/Development/Favro/Test/src/api/apitest_cards.ts)
- [apitest_cardmethods.ts](/Users/vu/Development/Favro/Test/src/api/methods/apitest_cardmethods.ts)
- [decision record](/Users/vu/.assistant-preferences/local-docs/Favro/brainstorm/2026-03-24-markdown-compat-decision-record.md)
- [markdown-card-description-current-behavior.md](/Users/vu/.assistant-preferences/local-docs/Favro/knowledge-references/markdown-card-description-current-behavior.md)

Observed current branch behavior:

- on `POST`, when `descriptionFormat=markdown` and `detailedDescription` is present, markdown is applied and `tasklists` are skipped
- on `PUT`, `addTasklists` are applied before markdown replacement, which means the branch does not currently document or guarantee a combined additive contract
- tests and docs currently encode "markdown wins over tasklists" for `POST`

Conclusion:

- the requested adjustment conflicts with the current branch decision and docs
- the compatibility concern is real
- the requested semantics are plausible if the contract is changed from "markdown wins" to "markdown first, then append explicit API task-list payload"

**Discussion**

Key distinction:

- the user is not asking for heuristic merging between markdown-derived checklists and API task lists
- the user wants ordered composition:
  1. build the base document from markdown
  2. append explicit API task lists afterwards

Recommended interpretation:

- `POST`: markdown builds the initial document, then `tasklists` are appended at the end
- `PUT`: markdown rebuilds the document, then `addTasklists` are appended at the end

Why this is a good fit:

- it preserves compatibility with existing API consumers
- it avoids ambiguous content-based merge rules
- it is simpler and more predictable than trying to match or deduplicate checklist payloads

Tradeoff accepted:

- markdown is no longer the sole checklist-state authority when explicit API task-list payloads are also provided
- instead, markdown becomes the base document-construction input, with API task-list payloads as explicit additive follow-up mutations

**Decision**

Accepted requirement adjustment:

- `POST` with markdown plus `tasklists` should support both inputs
- `PUT` with markdown plus `addTasklists` should support both inputs
- markdown constructs the document first
- API task-list payloads are then appended afterwards at the end of the document

Decision record updated:

- yes, decisions for markdown `POST` and `PUT` semantics were updated

**Planning impact**

A future implementation-plan adjustment will likely need to cover:

- changing `POST` flow so `tasklists` are not skipped when markdown is present
- ensuring the ordering is markdown document creation first, API task-list append second
- changing `PUT` flow so `addTasklists` happen after markdown reconstruction rather than before it
- updating tests that currently assert "markdown wins and tasklists are ignored"
- adding new tests for combined markdown-plus-tasklist payloads on both `POST` and `PUT`
- updating behavior docs and branch summary docs once implementation lands

Explicit non-goals for this iteration:

- no heuristic merge of API task lists into markdown-derived checklists
- no name-based or content-based deduplication contract

### Iteration 3 - Preserve Legacy Lookalike Checklist Content

**User prompt**

Concern:

- what happens to existing legacy documents that contain broken checklist-like markdown
- examples include bullet-list content such as `[ ] text` or `[X] text`
- examples also include legacy paragraph forms such as `-[ ] text`
- desired principle: API markdown round-trip should support general markdown, but existing lookalike content should stay as-is rather than being automatically fixed

**Verification**

Checked:

- [mongosync.ts](/Users/vu/Development/Favro/MainApp/lib/collaboration/server/mongosync/mongosync.ts)
- [collaboration_card.server.ts](/Users/vu/Development/Favro/MainApp/lib/collaboration/collaboration_card.server.ts)
- [favro_markdown.ts](/Users/vu/Development/Favro/MainApp/lib/collaboration/server/favro_markdown.ts)
- [favro_markdown.app-test.ts](/Users/vu/Development/Favro/MainApp/lib/collaboration/server/unittests/favro_markdown.app-test.ts)
- local markdown-it tokenization checks against the example syntaxes

Observed current branch behavior:

- markdown `GET` uses the live document serializer via `getDocumentAsMarkdown(...)`
- markdown `POST` and `PUT` rebuild the document through `recreateDocumentFromMarkdown(...)`, which explicitly runs `convertCheckboxListsInDoc(...)`
- bullet lists are currently converted to checklists when every list item starts with `[ ] `, `[x] `, or `[X] `
- legacy compact paragraph forms like `-[ ] text` and `-[x] text` are also converted to checklists
- regular broken forms like `[] text` are already left alone in some cases, but the overall rule is still heuristic and can reinterpret old plain content on round-trip

Conclusion:

- the compatibility concern is valid
- the risk is not just parser behavior in isolation, but the full `GET markdown -> PUT/POST markdown` round-trip
- the current branch is still too aggressive in turning lookalike content into checklist structure

**Discussion**

Agreed compatibility principle:

- anything intentionally authored through API markdown round-trip should follow general markdown expectations
- anything already present in an existing document that only looks like checklist syntax should remain plain content unless the syntax is clearly valid standard markdown task-list input

Recommended technical direction:

- stop treating legacy compact paragraph syntax like `-[ ] text` as checklist syntax
- avoid broad text-based reinterpretation rules for checklist detection
- move toward syntax-aware checklist recognition so real markdown task-list input is supported without auto-fixing old content

Why this is a good fit:

- it matches the user's compatibility goal
- it reduces silent semantic drift for existing documents
- it keeps markdown import aligned with standard markdown instead of Favro-specific legacy shorthand

Tradeoff accepted:

- some legacy shorthand that previously became a checklist on import will no longer do so
- that is acceptable because preserving existing content without reinterpretation is more important than auto-upgrading ambiguous legacy syntax

**Decision**

Accepted requirement adjustment:

- checklist markdown import should stay aligned with standard markdown task-list syntax
- existing document content with broken syntax or lookalike checklist syntax should remain as plain content
- there should be no automatic fix, normalization, or reinterpretation of that legacy content during API markdown round-trip

Decision record updated:

- yes, added a new active decision covering legacy lookalike checklist compatibility

**Planning impact**

A future implementation-plan adjustment will likely need to cover:

- removing legacy compact paragraph checklist conversion from the markdown API import path
- replacing the current broad text-based checklist detection with syntax-aware handling
- adding regression tests for lookalike content such as `[X]`, `[]`, and `-[ ]` forms
- verifying that valid standard markdown task-list syntax still round-trips as checklist content
- documenting the exact supported checklist markdown forms for API consumers

Explicit non-goals for this iteration:

- no automatic migration of old stored content
- no silent cleanup of legacy syntax during export
