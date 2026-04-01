# Markdown Compatibility Decision Record

**Date:** 2026-03-24

**Related plan:** [2026-03-23-markdown-compat.md](/Users/vu/.assistant-preferences/local-docs/Favro/plans/2026-03-23-markdown-compat.md)

## Purpose

This document records the reasoning behind the design decisions that were made while resolving the open questions in the markdown compatibility plan for card descriptions.

After the 2026-03-30 scope adjustment, only phase 1 decisions are considered active. Attachment-related phase 2 topics are intentionally kept as open questions for future reconciliation.

## Active Decisions

1. Task list names are **not** part of the guaranteed markdown round-trip contract.
2. `PUT` with `descriptionFormat=markdown` constructs the card document from markdown first; if `addTasklists` is also supplied, those task lists are appended afterwards as additional checklist content at the end of the document.
3. `POST` with `descriptionFormat=markdown` uses the markdown document as the source of truth for the initial card document; if `tasklists` is also supplied, the markdown-derived document is created first and the API task lists are appended afterwards at the end of the document.
4. Markdown table headers use a formatting heuristic rather than a distinct schema type: on import, GFM header cells become bold text in the first Favro table row; on export, the first row is emitted as a GFM header row only if every first-row cell is exactly one bold span covering the entire cell text content.
5. Checklist markdown import must stay aligned with standard markdown task-list syntax. Existing document content that only looks like checklist syntax must not be automatically reinterpreted or normalized during markdown round-trip.

## Decision 1: Task List Names Are Not Round-Trip Metadata

### Background

Legacy task list names already exist in MongoDB. In the card document, these names are rendered as a bold paragraph immediately before the checklist rather than as an attribute on the checklist node itself.

That means the visible document structure looks like content, not explicit task-list metadata.

### Options Considered

1. Preserve task list names as part of markdown round-trip by interpreting a bold paragraph before a checklist as the task-list name.
2. Render task list names as bold text on export, but treat them as ordinary document content on import.

### Why Option 1 Was Rejected

- A bold paragraph before a checklist is ambiguous. It may be intended as metadata, or it may simply be document content.
- The association is fragile. Inserting a paragraph, an empty line, or any other block between the bold text and the checklist makes it unclear whether the name still belongs to that checklist.
- It creates accidental behavior. Editing or deleting that bold paragraph in markdown could silently rename or clear a legacy MongoDB task-list name.
- The current document model does not store the name on the checklist node, so the round-trip rule would be based on a formatting heuristic instead of explicit structure.

### Decision

Task list names are not part of the guaranteed markdown round-trip contract.

Legacy task-list names should still be rendered as bold text before the checklist on export, because that matches the current document structure and preserves readability. On import, that bold paragraph is treated as ordinary document content, not as `taskList.name` metadata.

### Consequence

Checklist items and completion state are guaranteed to survive markdown export/import. Legacy task-list names are not.

## Decision 2: Markdown PUT Builds The Document First, Then Applies Explicit API Task List Additions

### Background

The markdown PUT flow should still treat markdown as the document-construction input for the description itself.

At the same time, the API already has an additive `addTasklists` field that existing consumers may depend on independently of markdown description handling.

### Options Considered

1. Treat markdown PUT as a full replacement of the card document and ignore `addTasklists`.
2. Let markdown construct the document first, then apply `addTasklists` as explicit additive API input afterwards.
3. Try to merge `addTasklists` into markdown-derived checklists by content or name.

### Why Option 1 Was Rejected

- It can break existing API consumers that already rely on `addTasklists`.
- It changes the legacy additive API contract more than necessary.

### Why Option 3 Was Rejected

- It introduces ambiguous matching rules.
- It would be difficult for API consumers to predict when an API task list would merge versus append.
- It creates a larger behavioral surface than this adjustment needs.

### Decision

`PUT` with `descriptionFormat=markdown` should construct the card document from markdown first.

If the same request also includes `addTasklists`, those task lists should be applied afterwards as additional checklist content appended at the end of the document.

### Consequence

This preserves the markdown-driven document construction path while maintaining compatibility for API consumers that already rely on additive task-list operations.

It also keeps the semantics explicit:

- markdown determines the base document
- `addTasklists` adds extra checklists afterwards

This is no longer a pure "markdown alone fully defines checklist state" contract when additive API task-list payload is present.

## Decision 3: Markdown POST Builds The Initial Document First, Then Appends Explicit API Task Lists

### Background

For `POST`, markdown should still be used to build the initial document when the client explicitly asks for `descriptionFormat=markdown`.

However, the API also has a legacy `tasklists` field that existing consumers may already use when creating cards.

The question is therefore not whether markdown constructs the base document, but whether `tasklists` should be ignored, rejected, or appended afterwards.

### Options Considered

1. Reject `tasklists` together with `descriptionFormat=markdown`.
2. Let markdown win and ignore `tasklists`.
3. Construct the document from markdown first, then append API `tasklists` afterwards.
4. Merge API `tasklists` into markdown-derived checklists by content or name.

### Why Option 1 Was Rejected

- It adds an avoidable API restriction for advanced clients that intentionally use markdown format.
- When a client explicitly sets `descriptionFormat=markdown`, it is reasonable to assume they want the markdown document model to control the result.

### Why Option 2 Was Rejected

- It can break existing API consumers that already send `tasklists`.
- It narrows compatibility more than necessary.

### Why Option 4 Was Rejected

- Merge semantics are ambiguous and order-dependent.
- It is difficult to define a stable, unsurprising matching rule between markdown-derived checklists and API `tasklists`.
- It creates more risk than a simple append model.

### Decision

`POST` with `descriptionFormat=markdown` should construct the initial card document from markdown first.

If the same request also includes `tasklists`, those task lists should then be appended afterwards as additional checklist content at the end of the document.

### Consequence

API consumers can use a predictable compatibility model:

1. markdown builds the base description document
2. explicit API task-list payloads are then appended afterwards if provided

This preserves compatibility for consumers already using `tasklists`, while still making markdown the document-construction path.

## Decision 4: Table Header Semantics Use A Bold-Text Heuristic

### Background

The current branch imports markdown tables into Favro table nodes, but it deliberately drops true header semantics because the Favro table schema does not have a distinct header-row or header-cell type.

Today:

- import converts `th` to ordinary `td`
- export writes a synthetic empty header row to satisfy markdown table syntax

That preserves table structure, but it does not preserve author intent around headers in a useful way.

### Options Considered

1. Keep the current behavior and continue dropping header meaning entirely.
2. Add true header-row support to the schema.
3. Use a formatting heuristic: import markdown headers as bold text in the first row, and export a first row as a markdown header only when it clearly matches that formatting convention.

### Why Option 1 Was Rejected

- It keeps incoming markdown headers readable as cells, but loses too much user intent.
- It also prevents meaningful GFM header export, which makes the markdown output less natural for external consumers.

### Why Option 2 Was Rejected

- It requires a broader schema and editor behavior change than this adjustment needs.
- The current reconciliation is about spec alignment for the existing phase 1 surface, not a larger table-model redesign.

### Decision

Use a formatting heuristic for table headers.

On markdown import:

- a GFM header row should become the first Favro table row
- each imported header cell should be represented as bold text within that cell

On markdown export:

- the first row should be emitted as a GFM header row only if every cell in that first row is exactly one bold span covering the entire cell text content
- otherwise, export should fall back to the non-header table representation

### Consequence

- Header intent becomes visible and round-trippable within the limits of the current schema.
- The rule stays conservative: random first rows do not silently become markdown headers.
- The heuristic is explicit and testable, but it is still only a heuristic. Favro tables still do not gain a true header-row schema concept.

## Decision 5: Keep Checklist Round-Trip Compatible Without Reinterpreting Legacy Lookalike Content

### Background

The branch currently adds checklist semantics during markdown import through a post-processing step that converts:

- bullet lists whose item text starts with `[ ] `, `[x] `, or `[X] `
- legacy compact paragraph syntax like `-[ ]` and `-[x]`

This creates a compatibility problem for existing document content.

`GET ...?descriptionFormat=markdown` serializes the live document structure to markdown. If that markdown is later sent back through `POST` or `PUT`, the current import path can reinterpret some plain content as a real checklist even when the user did not intend any automatic fix or normalization.

### Options Considered

1. Keep the current text-based detection, including legacy compact paragraph support.
2. Narrow the regexes, but keep the same general text-based reinterpretation model.
3. Restrict checklist import to standard markdown task-list syntax and stop auto-converting legacy or lookalike content.

### Why Option 1 Was Rejected

- It can silently change the meaning of existing document content after an API markdown round-trip.
- It violates the compatibility goal of keeping legacy plain content unchanged unless the user explicitly authors valid markdown checklist syntax.

### Why Option 2 Was Rejected

- It may reduce false positives, but it does not fully solve the ambiguity.
- As long as checklist detection is based on text heuristics rather than intended markdown structure, some plain content can still be reinterpreted unexpectedly.

### Decision

Checklist markdown import should stay aligned with standard markdown task-list syntax.

Legacy compact paragraph forms such as `-[ ] text` should not be treated as checklist syntax for API markdown round-trip.

Existing document content that contains broken syntax or lookalike checklist syntax should remain plain content. It must not be automatically fixed, normalized, or reinterpreted into checklist nodes without the user's explicit intent.

### Consequence

- API markdown round-trip stays compatible with general markdown expectations.
- Existing legacy content is preserved more safely.
- The import path should move away from broad text-based checklist heuristics and toward syntax-aware handling that distinguishes real markdown task lists from lookalike content.

## Future Open Questions: Attachment Round-Trip

The following topics were previously drafted as phase 2 decisions. They are no longer treated as settled decisions for this round.

### Open Question 1: How should `favro_attachment` nodes be represented in markdown?

Relevant tradeoffs that remain valid:

- Ordinary Favro links are ambiguous because a normal link to a Favro card or board is not the same thing as a Favro attachment.
- A custom URL scheme would be less portable than standard HTTPS for external tooling.
- Any explicit attachment marker must still preserve normal Favro access control on dereference.

### Open Question 2: How should `file_attachment` nodes be represented in markdown?

Relevant tradeoffs that remain valid:

- S3 pre-signed URLs are not stable identities for round-trip.
- A portable representation should work with general markdown tooling where possible.
- Any stable representation must be clear about whether it is only a reuse marker or also an authoring mechanism.

### Open Question 3: How should unchanged integration attachments be matched on import?

Relevant tradeoffs that remain valid:

- Exact URL matching is brittle.
- Stable provider identity such as `fileId` / `driveId` may be more robust, but the exact contract is not being fixed in this round.
- Changed or ambiguous external links should degrade safely rather than being guessed into attachment objects.

### Open Question 4: What portability tradeoff is acceptable for external markdown viewers?

If attachment identity eventually relies on Favro-controlled URLs or authenticated dereference, exported markdown may render poorly in external previewers. That tradeoff remains unresolved and should be revisited only when attachment scope is back on the table.
