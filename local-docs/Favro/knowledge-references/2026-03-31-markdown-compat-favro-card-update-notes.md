# Markdown Compatibility Favro Card Update Notes

**Date:** 2026-03-31

**Purpose:** Reference notes for updating the Favro card description later so it matches the reconciled phase 1 scope and decisions.

**Related sources:**

- [Spec reconciliation note](/Users/vu/.assistant-preferences/local-docs/Favro/knowledge-references/2026-03-30-markdown-compat-spec-reconciliation.md)
- [Decision record](/Users/vu/.assistant-preferences/local-docs/Favro/brainstorm/2026-03-24-markdown-compat-decision-record.md)
- [Phase 1 plan](/Users/vu/.assistant-preferences/local-docs/Favro/plans/2026-03-23-markdown-compat.md)

## Goal Of The Card Update

The current Favro card description still mixes:

- original assumptions from before reconciliation
- phase 2 attachment scope that is now parked
- wording that no longer matches the intended API markdown contract

The later card update should make the card match the reconciled phase 1 direction, not the older assumptions.

## Main Updates Needed

### 1. Make The Card Explicitly Phase 1 Only

The card should be updated so its active scope matches the current branch direction:

- checklist markdown export/import
- table markdown import/export behavior within the current schema limits
- markdown `POST` / `PUT` behavior for `descriptionFormat=markdown`

Attachment round-trip should no longer read as active scope for this iteration. If attachment notes stay in the card, they should be clearly marked as future work or parked scope.

### 2. Remove The “Legacy Checkbox Input Remains Supported” Requirement

This statement is no longer valid.

Reason:

- it came from a mistaken assumption about existing editor behavior and current master behavior
- the reconciled API direction is to use standard markdown task-list syntax for round-trip
- existing legacy or lookalike content should be preserved safely, not treated as supported API checklist input

Recommended replacement:

- supported API checklist input uses standard markdown task-list syntax
- existing stored content with broken or lookalike checklist syntax should not be auto-fixed or silently reinterpreted during API markdown round-trip

### 3. Clarify Task List Name Behavior

The card should stop treating task list name preservation as an open question.

Current reconciled direction:

- task list names are rendered as bold text before the checklist on export
- task list names are not part of the guaranteed markdown round-trip contract
- checklist items and completion state are preserved; task list names are not reconstructed as metadata on import

This means “named task lists should not be silently broken” should be clarified to mean:

- existing names should still be visible in exported markdown as bold text
- markdown import should not interpret bold text as task-list-name metadata

### 4. Clarify Combined Markdown And API Task List Payload Behavior

The card should explicitly document the compatibility rule for API consumers:

- `POST` with `descriptionFormat=markdown` constructs the card document from markdown first, then appends `tasklists` afterwards if supplied
- `PUT` with `descriptionFormat=markdown` reconstructs the card document from markdown first, then appends `addTasklists` afterwards if supplied

This should not stay implicit, because it is a real contract change from the current branch behavior.

### 5. Update The Table Header Wording

The current card wording still frames headers as “Favro does not use header semantics” and leaves the topic as an open question.

The reconciled direction is now more specific:

- no dedicated header-row schema type is being introduced
- incoming GFM header rows should import as bold text in the first table row
- export should emit a GFM header row only when every first-row cell is exactly one bold span covering the whole cell text content

This should be described as a formatting heuristic, not as full header semantics.

## Suggested Card Section Changes

### Verification / Checklist

Update checklist items so they match the reconciled phase 1 contract.

Recommended changes:

- remove “Verify legacy checkbox input remains supported”
- keep or refine “Verify standard `- [ ]` / `- [x]` checkbox input is supported”
- add a verification item that existing lookalike or broken checklist content is preserved safely and not auto-reinterpreted during API markdown round-trip
- add verification for markdown plus `tasklists` on `POST`
- add verification for markdown plus `addTasklists` on `PUT`
- update table-header verification to check bold-first-row import and conservative GFM-header export heuristic
- remove or park attachment QA items if the card is being made phase-1-only

### How

The `How` section should be rewritten to remove outdated and corrupted wording and to reflect the settled decisions.

It should state clearly:

- standard markdown task-list syntax is the supported API checklist syntax
- existing lookalike legacy content should be preserved, not auto-upgraded
- task list names render as bold text but are not round-trip metadata
- markdown builds the base document first; API task-list payloads append afterwards
- tables use a header-formatting heuristic rather than a dedicated schema type
- attachment round-trip is not part of this phase if the card is updated to match current scope

### Open Questions

The following should no longer remain as open questions in the card for this phase:

- whether task list names should be preserved as metadata
- whether table headers should be supported at all

If the card is updated to reflect the reconciled decisions, those items should either be removed from open questions or rewritten as settled direction.

Attachment-related questions can remain only if they are clearly labeled as future work rather than active phase 1 scope.

### Findings

The task-list naming findings can remain, but the conclusion should be aligned with the settled decision:

- named task lists matter
- they should remain readable in exported markdown
- they are not part of the guaranteed metadata round-trip contract

## Concrete Items To Rewrite Or Remove

- Remove statements that imply legacy `[]` / `-[ ]` input is a required supported API checklist syntax.
- Remove duplicated checklist syntax wording.
- Remove the malformed combined sentence in the `How` section about checkbox syntax and Planner8.
- Rewrite table-header wording so it matches the bold-text heuristic.
- Rewrite named-task-list wording so it matches “rendered as bold text, not round-trip metadata”.
- Add explicit wording for markdown plus `tasklists` / `addTasklists`.
- Drop or park attachment round-trip scope if the card is meant to reflect the current reconciled implementation scope.

## Recommended Framing For The Later Card Update

When the card is updated later, the safest framing is:

- standard markdown support for API round-trip where explicitly supported
- conservative preservation of existing Favro content where syntax is ambiguous
- no accidental reinterpretation of legacy lookalike content
- no broader schema redesign in phase 1
