# Markdown Card Description: PROD vs Phase 1 Branch

## Scope

This document compares two states of the markdown card-description behavior:

- `PROD`: the currently shipped behavior, before the phase 1 markdown changes on this branch
- `This branch / phase 1`: the current workspace state on this branch, which includes the phase 1 markdown work but is not shipped yet

This is an API-visible behavior reference only. It does not describe detailed implementation.

## State Definitions


| State                   | Meaning                                                                                           |
| ----------------------- | ------------------------------------------------------------------------------------------------- |
| `PROD`                  | Current shipped behavior                                                                          |
| `This branch / phase 1` | Current branch/workspace behavior, including the new markdown checklist/table/API round-trip work |


## High-Level Delta


| Area                                       | `PROD`                                                                             | `This branch / phase 1`                                                                                     |
| ------------------------------------------ | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `GET ...?descriptionFormat=markdown`       | Exports current document snapshot to markdown                                      | Same overall entry point                                                                                    |
| Checklist export                           | Non-standard legacy `-[ ]` form and completion is not preserved in markdown export | Standard `- [ ]` / `- [x]` export with completion preserved                                                 |
| Markdown `PUT` / `POST` semantics          | Markdown is not the source of truth for the document                               | Markdown becomes the source of truth for the document                                                       |
| Checkbox markdown import                   | Does not create real Favro checklist/task state through the API markdown path      | Standard checkbox markdown imports into real Favro checklist/task state                                     |
| Table markdown import                      | Not supported as real table structure through the API markdown path                | Standard markdown tables import into real Favro table nodes                                                 |
| `POST` with both markdown and `tasklists`  | `tasklists` still apply                                                            | Markdown builds the base document first; `tasklists` / `addTasklists` are appended after when also supplied |
| Attachments                                | Not structurally round-trippable                                                   | Still not structurally round-trippable in phase 1                                                           |
| Unsupported markdown on API `POST` / `PUT` | No meaningful markdown-structure import path to compare against                    | Degrades safely through the markdown import path                                                            |


## API-Level Behavior Comparison


| API call                                                                                | `PROD`                                                                                                                         | `This branch / phase 1`                                                                                                                                    |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/v1/cards/...` without `descriptionFormat=markdown`                            | Returns stored plain-text `common.detailedDescription`                                                                         | Same                                                                                                                                                       |
| `GET /api/v1/cards/...` with `descriptionFormat=markdown`                               | Returns markdown serialization of latest document snapshot; if no snapshot exists, falls back to stored plain-text description | Same entry point, but the returned markdown can now reflect phase 1 checklist/table import results                                                         |
| `POST /api/v1/cards/...` with `descriptionFormat=markdown` and `detailedDescription`    | Does not treat markdown as the authoritative document source                                                                   | Parses markdown into a document and uses that as the source of truth                                                                                       |
| `PUT /api/v1/cards/:cardId` with `descriptionFormat=markdown` and `detailedDescription` | Does not do markdown document replacement semantics                                                                            | Parses markdown into a document and replaces the document from markdown; when `addTasklists` is also supplied on this path, those lists are appended after |
| `POST` with `descriptionFormat=markdown` and `tasklists`                                | `tasklists` still apply                                                                                                        | Markdown is applied first; `tasklists` are appended to the document afterward                                                                              |
| `PUT` or `POST` without `descriptionFormat=markdown`                                    | Plain-text description path                                                                                                    | Same                                                                                                                                                       |


## Export Comparison: Current Card Document To Markdown

This section describes what `GET ...?descriptionFormat=markdown` returns.


| Current card document content                              | `PROD`                                                           | `This branch / phase 1`                                                                                           |
| ---------------------------------------------------------- | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Paragraph text                                             | Ordinary markdown paragraph                                      | Same                                                                                                              |
| Heading node                                               | Markdown heading                                                 | Same                                                                                                              |
| Bullet list                                                | `* item`                                                         | Same                                                                                                              |
| Ordered list                                               | `1. item`, `2. item`, ...                                        | Same                                                                                                              |
| Favro checklist                                            | `-[ ] item` for every item, regardless of completion state       | `- [ ] item` or `- [x] item`, preserving completion state                                                         |
| Paragraph / list text that only looks like checkbox syntax | No systematic escaping                                           | Escaped on export so `GET` → `PUT` markdown round-trip does not silently reinterpret it as checklist state        |
| Task list name stored as bold paragraph before checklist   | `**Task list name**` on export                                   | Same export shape; name is presentation only and not part of the guaranteed markdown round-trip metadata contract |
| Code block                                                 | Fenced code block                                                | Same                                                                                                              |
| Horizontal rule                                            | `---`                                                            | Same                                                                                                              |
| Bold / italic / strike / inline code                       | Standard markdown formatting                                     | Same                                                                                                              |
| Link mark                                                  | `[text](href)`                                                   | Same                                                                                                              |
| Mention node                                               | `[@User name]`                                                   | Same                                                                                                              |
| Hard break                                                 | Literal newline                                                  | Same                                                                                                              |
| Table                                                      | Markdown table with synthetic empty header row and separator row | GFM table; header row vs data rows follow a bold-text heuristic (not a dedicated header schema type)              |
| Table cell paragraph breaks                                | Flattened to spaces                                              | Same                                                                                                              |
| Favro-hosted file attachment                               | `![filename](temporary-file-url)`                                | Same                                                                                                              |
| Drive / integration file attachment                        | `[filename](editLink)`                                           | Same                                                                                                              |
| Image grid                                                 | Flattened to consecutive attachment images                       | Same                                                                                                              |
| Favro card / board attachment                              | `[name](favro-link)`                                             | Same                                                                                                              |
| Inaccessible Favro card / board attachment                 | Plaintext code-style permission message                          | Same in phase 1                                                                                                   |
| `anchor_node`                                              | No markdown output                                               | Same                                                                                                              |
| Temporary `image` node                                     | No markdown output                                               | Same                                                                                                              |


## Import Comparison: Markdown To Card Document Through The API

This section describes `POST` / `PUT` behavior when the caller uses `descriptionFormat=markdown`.

### `PROD`

In `PROD`, the markdown flag mainly affects the response shape on `GET`. It does not give the API true markdown-document replacement semantics on `POST` and `PUT`.

Practical consequences in `PROD`:

- standard checkbox markdown is not a reliable way to create real Favro checklist/task state through the API markdown path
- markdown tables are not imported as real Favro table structure through the API markdown path
- `POST` does not let markdown override `tasklists`
- markdown is not the authoritative representation for full document replacement

### `This branch / phase 1`

In this branch, `POST` and `PUT` with `descriptionFormat=markdown` treat markdown as the document source of truth for the **base** document.

Reconciled phase 1 API behavior:

- `POST` and `PUT` with `descriptionFormat=markdown` build the base document from markdown first.
- If `tasklists` / `addTasklists` are also supplied, they are appended afterwards at the end of the document.
- Task list names render as bold text on export but are not part of the guaranteed round-trip metadata contract.
- Legacy compact `-[ ]` paragraph syntax is not treated as supported markdown checklist input.
- Existing lookalike content is escaped on markdown export so `GET`/`PUT` round-trip does not silently reinterpret it as checklist state.
- Table headers use a bold-text heuristic rather than a dedicated schema type.


| Markdown input                                                | `This branch / phase 1` result                                     |
| ------------------------------------------------------------- | ------------------------------------------------------------------ |
| Plain paragraph text                                          | Paragraph nodes                                                    |
| `# Heading` or `## Heading`                                   | Heading node                                                       |
| `###` and deeper headings                                     | Heading node, clamped to level 2                                   |
| Inline formatting inside headings                             | Imported as plain heading text                                     |
| `* item` or `- item` list                                     | Bullet list                                                        |
| `1. item` list                                                | Ordered list                                                       |
| `- [ ] item` / `- [x] item`                                   | Real Favro checklist                                               |
| Legacy compact `-[ ] item` / `-[x] item` in a plain paragraph | Remains ordinary paragraph text (not supported as checklist input) |
| Regular bullet list items without checkbox prefixes           | Remain ordinary bullet lists                                       |
| Fenced or indented code block                                 | Code block                                                         |
| `---`                                                         | Horizontal rule                                                    |
| Standard markdown link `[text](url)`                          | Text with link mark                                                |
| Bare URL                                                      | Usually imported as a link                                         |
| `[@User name]`                                                | Mention node                                                       |
| Markdown table                                                | Real table / row / cell nodes                                      |
| Markdown image `![alt](url)`                                  | Still unsupported by the markdown API path                         |
| Ordinary Favro card link                                      | Ordinary link, not `favro_attachment`                              |
| File attachment image/link exported by current `GET` markdown | Not reconstructed as attachment nodes                              |


## Checklist Behavior Comparison


| Behavior                                                                         | `PROD`           | `This branch / phase 1`              |
| -------------------------------------------------------------------------------- | ---------------- | ------------------------------------ |
| Export real checklist nodes as standard markdown                                 | No               | Yes                                  |
| Preserve checklist completion in markdown export                                 | No               | Yes                                  |
| Import standard checkbox markdown into real checklist nodes                      | No               | Yes                                  |
| Import legacy compact `-[ ]` / `-[x]` paragraph syntax into real checklist nodes | No API guarantee | No (not supported; stays plain text) |
| Create real MongoDB tasks/task lists from markdown checklists                    | No API guarantee | Yes                                  |
| Preserve checklist state across `GET markdown -> PUT same markdown`              | No               | Yes                                  |


## Table Behavior Comparison


| Behavior                                                                            | `PROD` | `This branch / phase 1`                                                         |
| ----------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------- |
| Export real table nodes as markdown tables                                          | Yes    | Yes                                                                             |
| Import standard markdown tables into real table nodes through the API markdown path | No     | Yes                                                                             |
| Preserve round-trip as table structure                                              | No     | Yes, with current serializer/parser asymmetry still present                     |
| Preserve dedicated markdown `th` / header cell schema                               | No     | No (headers are approximated via bold-text heuristic, not a separate node type) |


Table notes:

- `PROD` export still uses a synthetic empty header row where that shape applies.
- On this branch, import maps GFM header cells to bold text in the first row; export emits a GFM header row when the first table row is bold-only in every cell, otherwise it falls back to a non-header table markdown shape. This is a bold-text heuristic, not stored header semantics in the document schema.

## Attachment Behavior Comparison

Phase 1 does not change attachment behavior yet.


| Behavior                                                                      | `PROD` | `This branch / phase 1` |
| ----------------------------------------------------------------------------- | ------ | ----------------------- |
| Export Favro-hosted file attachments as markdown images with temporary URLs   | Yes    | Yes                     |
| Export integration attachments as ordinary external links                     | Yes    | Yes                     |
| Export Favro card/board attachments as ordinary Favro links                   | Yes    | Yes                     |
| Export inaccessible Favro card/board attachments as plaintext permission text | Yes    | Yes                     |
| Recreate `file_attachment` nodes from markdown import                         | No     | No                      |
| Recreate `favro_attachment` nodes from markdown import                        | No     | No                      |
| Preserve `image_grid` layout through markdown round-trip                      | No     | No                      |


## Unsupported Markdown Comparison


| Behavior                                                                                           | `PROD`                                                                    | `This branch / phase 1` |
| -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ----------------------- |
| API `POST` / `PUT` uses a real markdown structure-import path                                      | No                                                                        | Yes                     |
| Unsupported markdown is distinguished from supported markdown during API import                    | Not meaningfully, because markdown is not the source-of-truth import path | Yes                     |
| Unsupported markdown can fall back to plain paragraph-per-line content on the markdown import path | Not the relevant API behavior in `PROD`                                   | Yes                     |


Examples that are still unsupported in this branch:

- markdown images
- blockquotes
- raw HTML blocks
- other markdown token types that are not mapped into the Favro document schema

## Practical Summary

### Shipped in `PROD`

Today, the shipped system supports markdown export reasonably well for existing document content, but the API markdown import path is not a true document round-trip mechanism.

In practice, `PROD` does not yet give you:

- standard checklist markdown round-trip
- markdown-driven checklist/task creation through API `POST` / `PUT`
- markdown table import through the API markdown path
- markdown plus `tasklists` combined on `POST` (markdown first, then `tasklists` appended)
- attachment round-trip

### Added in `This branch / phase 1`

This branch adds:

- standard checklist markdown export
- standard checkbox markdown import
- markdown table import
- markdown `POST` / `PUT` as document-source-of-truth behavior
- markdown-first document build on `POST`/`PUT`, with `tasklists` / `addTasklists` appended after when provided
- checklist/task state round-trip for the markdown API path

This branch still does not add:

- attachment round-trip
- image-grid round-trip
- markdown image import
- blockquote or raw HTML support

