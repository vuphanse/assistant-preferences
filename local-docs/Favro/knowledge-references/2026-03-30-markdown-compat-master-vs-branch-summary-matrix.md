# Markdown Compatibility: Master vs Branch Summary Matrix

**Date:** 2026-03-30

**Branch:** `fav-162947`

**Compare against:** `master` at merge-base `e902bcd697`

## Scope

This summary is intentionally limited to the currently implemented phase 1 scope on this branch:

- checklist markdown export/import
- table markdown import
- markdown-as-source-of-truth API behavior for `POST` and `PUT` when `descriptionFormat=markdown`

Attachment round-trip is not part of this branch scope.

## High-Level Change Summary


| Area                                             | `master`                                     | `fav-162947` branch                                                |
| ------------------------------------------------ | -------------------------------------------- | ------------------------------------------------------------------ |
| Checklist export                                 | Legacy `-[ ]` form, completion not preserved | Standard `- [ ]` / `- [x]`, completion preserved                   |
| Checklist import through markdown API path       | Not a real checklist round-trip path         | Standard checkbox markdown becomes real Favro checklist/task state |
| Table import through markdown API path           | Not supported as real table structure        | GFM markdown tables import as real Favro table nodes               |
| `POST` / `PUT` with `descriptionFormat=markdown` | Markdown is not the document source of truth | Markdown becomes the document source of truth                      |
| `POST` with both markdown and `tasklists`        | `tasklists` still apply                      | Markdown builds the document first; `tasklists` are appended after |
| Attachments                                      | Not structurally round-trippable             | Still not structurally round-trippable                             |


## Markdown Syntax / Schema Matrix


| Syntax or schema item                                 | `master`                                                   | `fav-162947` branch                                                     | Notes                                                    |
| ----------------------------------------------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------- | -------------------------------------------------------- |
| Paragraph text                                        | Supported                                                  | Supported                                                               | No intentional phase 1 change                            |
| `#` / `##` headings                                   | Supported                                                  | Supported                                                               | No intentional phase 1 change                            |
| `###`+ headings on import                             | Imported via existing markdown path                        | Imported, clamped the same way as current branch behavior docs describe | No new phase 1 contract here                             |
| Bullet list `- item` / `* item`                       | Supported                                                  | Supported                                                               | Non-checkbox bullet lists stay ordinary lists            |
| Ordered list `1. item`                                | Supported                                                  | Supported                                                               | No intentional phase 1 change                            |
| Favro checklist export                                | `-[ ] item` for all items                                  | `- [ ] item` or `- [x] item`                                            | Completion state now preserved                           |
| Standard checkbox import `- [ ]` / `- [x]`            | Not a reliable API checklist import path                   | Imported as real `favro_checklist` nodes                                | Creates real Mongo task/tasklist state via document sync |
| Legacy compact checkbox import `-[ ]` / `-[x]`        | No reliable API guarantee                                  | Not supported; remains plain paragraph text                             | Only standard spaced `- [ ]` / `- [x]` list items become checklists |
| Named task list title rendered as bold text           | Exported as bold paragraph before checklist                | Same export behavior                                                    | Bold on export only; not part of guaranteed round-trip metadata     |
| Code block                                            | Supported                                                  | Supported                                                               | No intentional phase 1 change                            |
| Horizontal rule `---`                                 | Supported                                                  | Supported                                                               | No intentional phase 1 change                            |
| Inline marks: bold / italic / strike / code           | Supported                                                  | Supported                                                               | No intentional phase 1 change                            |
| Markdown links                                        | Supported                                                  | Supported                                                               | Ordinary links stay ordinary links                       |
| Mentions `[@User]`                                    | Supported                                                  | Supported                                                               | No intentional phase 1 change                            |
| Table export                                          | Existing markdown table export                             | GFM tables; bold-text heuristic picks header row vs data rows           | No dedicated `th` schema; all-bold first row → GFM header separator   |
| Table import                                          | Not imported as real table nodes through markdown API path | Imported as real table / row / cell nodes                               | `th` cells become bold text in row 1 (heuristic, not stored headers) |
| Markdown image `![alt](url)` import                   | Not part of real attachment round-trip                     | Still unsupported in phase 1                                            | No attachment reconstruction yet                         |
| Favro card link import                                | Ordinary link                                              | Ordinary link                                                           | Still not reconstructed as `favro_attachment`            |
| Favro-hosted file attachment export                   | Markdown image with temporary URL                          | Same                                                                    | Phase 1 does not change attachment export                |
| Favro card / board attachment export                  | Ordinary Favro link                                        | Same                                                                    | Phase 1 does not change attachment export                |
| Inaccessible Favro attachment export                  | Plaintext permission text                                  | Same                                                                    | Phase 1 does not change attachment export                |
| `file_attachment` reconstruction on import            | No                                                         | No                                                                      | Future-scope question only                               |
| `favro_attachment` reconstruction on import           | No                                                         | No                                                                      | Future-scope question only                               |
| `image_grid` preservation                             | No                                                         | No                                                                      | Future-scope question only                               |
| Unsupported constructs such as blockquotes / raw HTML | No meaningful markdown source-of-truth import path         | Degrade safely through markdown import path                             | Still unsupported as structured schema                   |


## API Semantics Matrix


| API behavior                                                       | `master`                                                | `fav-162947` branch                                            |
| ------------------------------------------------------------------ | ------------------------------------------------------- | -------------------------------------------------------------- |
| `GET` with `descriptionFormat=markdown`                            | Serializes current document snapshot to markdown        | Same entry point                                               |
| `POST` with `descriptionFormat=markdown` and `detailedDescription` | Does not treat markdown as authoritative document input | Parses markdown into a document and uses it as source of truth |
| `PUT` with `descriptionFormat=markdown` and `detailedDescription`  | Does not fully replace the document from markdown       | Replaces the current document from parsed markdown             |
| Empty string markdown on `PUT`                                     | Legacy truthy handling skips empty strings              | Empty markdown clears the document on markdown path            |
| `POST` with markdown plus `tasklists`                              | `tasklists` still apply                                 | Markdown first; `tasklists` appended after                       |
| `PUT` with markdown plus `addTasklists`                          | Legacy combined behavior                                | Markdown first; `addTasklists` appended after                    |
| `POST` / `PUT` without `descriptionFormat=markdown`                | Plain-text path                                         | Same plain-text path                                           |


## Key Differences To Keep In Mind

- This branch improves checklists and tables, but not attachments.
- This branch changes API semantics for markdown `POST` and `PUT`; markdown now drives the base document instead of acting like a plain text blob, and API `tasklists` / `addTasklists` on the same request are appended after the markdown-built document.
- Named task list names are intentionally not preserved as round-trip metadata. The branch keeps the current bold-text export pattern, but re-import does not treat that as task list naming metadata.

## Short Takeaway

Compared with `master`, this branch turns markdown card descriptions into a real phase 1 round-trip mechanism for:

- checklist syntax
- table syntax
- document replacement semantics in the API

Compared with `master`, this branch still does **not** solve:

- attachment round-trip
- image-grid round-trip
- markdown image import as Favro attachments
- richer unsupported markdown constructs beyond safe degradation

