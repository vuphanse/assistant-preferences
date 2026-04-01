# Markdown Compatibility Phase 2: Attachment Topics Parked

**Status:** Parked for later reconciliation. This is not an active implementation plan for the current round.

## Current Scope

The active scope for `fav-162947` is limited to phase 1:

- checklist markdown export/import
- table markdown import
- markdown-as-source-of-truth API behavior for `POST` and `PUT` when `descriptionFormat=markdown`

Attachment round-trip is explicitly out of scope for this round.

## Why This File Was Parked

The earlier phase 2 document captured a concrete implementation direction for attachment round-trip. That direction should not be treated as approved anymore because the upcoming spec reconciliation may change the intended behavior and constraints.

This file remains only as a parking place for future questions that came up during the earlier exploration.

## Future Open Questions

### 1. Attachment identity in markdown

- How should Favro-hosted file attachments be represented in markdown if we need stable round-trip identity?
- How should Favro card and board attachments be distinguished from ordinary Favro links?
- Should attachment identity be expressed through reserved Favro-owned HTTPS URLs, some other explicit marker, or a different approach entirely?

### 2. Import matching rules

- When should markdown content be converted back into real `file_attachment` nodes?
- When should markdown content be converted back into real `favro_attachment` nodes?
- Should unchanged supported integration attachments be matched by stable provider identity such as `fileId` / `driveId`, by exported URL equality, or by some other rule?

### 3. Attachment scope boundaries

- Should attachment round-trip be limited to same-card reuse?
- Should cross-card file reuse be supported during markdown import?
- Should cross-workspace `favro_attachment` recreation be supported, or should that remain out of scope?

### 4. Image-grid behavior

- If unchanged attachment images are round-tripped, should Favro preserve existing `image_grid` layout?
- If yes, what evidence is required before rebuilding a grid during import?

### 5. Access control and dereferencing

- If markdown uses Favro-owned attachment URLs, how should those URLs be dereferenced?
- Should dereferencing require normal Favro authentication every time?
- If Bearer or Basic authentication is supported, what connected-app restrictions must be enforced?

### 6. External markdown portability

- If attachment URLs require Favro authentication, is that acceptable even though external previewers will not render them cleanly?
- Do we need a separate portable-markdown mode, a time-limited token variant, or some other compatibility strategy for external tools?

### 7. UX and API contract

- Are attachment URLs in markdown reuse markers only, or should they also support authoring new attachment objects?
- What should happen when a previously valid attachment marker no longer matches a current attachment object?
- What should the public API documentation promise about attachment round-trip, degradation, and unsupported edits?

## Resume Criteria

Do not treat this file as implementation-ready until the spec reconciliation explicitly decides:

1. whether attachment round-trip is in scope at all
2. what the supported attachment contract is
3. what import/export rules are acceptable
4. what security and portability tradeoffs are acceptable
