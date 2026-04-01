# Markdown Compatibility for Card Descriptions — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable API consumers to read and write card descriptions in standard markdown, with proper round-trip support for task list checkboxes and tables (fav-162947).

**Architecture:** Two main components: (1) `favro_markdown.ts` handles ProseMirror doc ↔ markdown serialization/deserialization; (2) an API layer (`api_cards.ts` + `collaboration_card.server.ts`) exposes this for markdown-aware PUT/POST card updates. When `descriptionFormat=markdown`, the ProseMirror document is the source of truth; MongoDB task lists (`Collection_CardTaskLists`, `Collection_CardTasks`) are derived from document nodes via `applyDependencyChanges`. Attachment round-trip is out of scope for this round and remains a future question.

**Tech Stack:** TypeScript, ProseMirror (`prosemirror-markdown`, `prosemirror-model`, `prosemirror-transform`), markdown-it v5 (global `markdownIt`, global `MarkdownIt`), Meteor, Mocha unit tests, Puppeteer E2E tests.

---

## Scope Note

This plan is intentionally limited to phase 1 only.

- **Phase 1A (Tasks 1–3):** Serializer/parser changes — fix checkbox output and add checkbox + table import. Unit-tested in isolation.
- **Phase 1B (Tasks 4–5):** API markdown round-trip — PUT/POST `detailedDescription` with `descriptionFormat=markdown` correctly creates real Favro task lists and tables from the markdown document. Depends on phase 1A.

Attachment round-trip and any phase 2 attachment behavior are explicitly out of scope for this document.

---

## Active Decisions And Future Questions

**Resolved design decision — task list names:** Task list names are **not** part of the guaranteed markdown round-trip contract. If a legacy MongoDB task list has a name, export should continue to render that name as a bold paragraph immediately before the checklist, matching the current document structure. On markdown import/re-import, that bold paragraph must be treated as ordinary document content, not as `taskList.name` metadata.

**Resolved design decision — markdown PUT semantics:** `PUT` with `descriptionFormat=markdown` is a full replacement of the card document, including checklist state. If the submitted markdown contains `- [ ]` / `- [x]` items and the card already has MongoDB task lists, the markdown replaces them entirely: old lists/tasks not represented in the new document are removed, and new lists/tasks represented in the markdown are created.

**Resolved design decision — markdown POST semantics:** `POST` with `descriptionFormat=markdown` also treats the markdown document as the source of truth for the initial card document. If the same request also includes `tasklists`, the markdown document wins: the markdown is used to create the initial ProseMirror doc and derived MongoDB task lists, and the `tasklists` payload is ignored. This behavior must be documented in the public API docs during implementation.

**Future open question — attachment markdown contract:** If attachment round-trip is revisited later, how should `file_attachment` and `favro_attachment` nodes be represented in markdown, and what should count as a valid round-trip marker versus ordinary markdown content?

---

## File Map

| File | Action | Reason |
|---|---|---|
| `MainApp/lib/collaboration/server/favro_markdown.ts` | Modify | Fix serializer; add `thead`/`tbody` normalization; add `table`/`tr`/`td` parser tokens |
| `MainApp/lib/collaboration/server/mongosync/mongosync.ts` | Modify | Post-process parsed doc: convert `bullet_list` checkbox items → `favro_checklist` nodes |
| `MainApp/lib/collaboration/server/unittests/favro_markdown.app-test.ts` | Create | Unit tests for serializer and parser changes |
| `MainApp/lib/collaboration/collaboration_card.server.ts` | Modify | New `recreateDocumentFromMarkdown` function for API markdown PUT/POST |
| `MainApp/server/api/cards/api_cards.ts` | Modify | Use markdown-aware document recreation when `descriptionFormat=markdown` on PUT and POST; markdown wins over `tasklists` on POST |
| `Test/src/api/apitest_cards.ts` | Modify | E2E tests for markdown round-trip via API |
| `Test/src/api/methods/apitest_cardmethods.ts` | Modify | Skip `checkTasklists` assertion when `descriptionFormat=markdown` and `detailedDescription` is provided |

---

## Background: How the Code Works (read before touching anything)

### Doc ↔ Markdown flow

- **Export (doc → markdown):** `getDocumentAsMarkdown(card)` in `collaboration_card.server.ts` gets the latest ProseMirror doc snapshot, then calls `FavroMarkdown.createSerializerState()` + `state.render(node, ...)` per top-level node. The serializer is defined in `favro_markdown.ts` via the `nodes` and `marks` exports.

- **Import (markdown → doc, on initial card create):** `createCardDocument(card)` in `mongosync.ts` calls `markdownToDocument(card.common.detailedDescription)` then **appends task lists from MongoDB** on top. The parser is `FavroMarkdown.getParser()` (a `prosemirror-markdown` `MarkdownParser` backed by a `FavroMarkdownIt` instance).

- **Import (markdown → doc, on API PUT):** `recreateDocumentFromDescription(workspaceId, userId, key, description)` in `collaboration_card.server.ts` stores the raw description string to `common.detailedDescription`, then triggers `recreateFromDescription: true` which calls `createCardDocument` (same path as above, including MongoDB task list append — this is the problem for round-trip).

- **Import (markdown → doc, on API POST today):** the create handler in `api_cards.ts` stores `detailedDescription` with `setDetailedDescription` and separately applies `tasklists`. That means `descriptionFormat=markdown` currently does not make markdown the source of truth on create; this must be fixed as part of Sub-plan 2.

### Current checkbox bug

`favro_markdown.ts:147–148`:
```typescript
favro_checklist: function(state, node) {
    state.renderList(node, "  ", () => "-[ ] ");  // BUG: no space after -, ignores completion state
},
```
All checklist items serialize to `-[ ] text` regardless of completion. Standard markdown requires `- [ ] ` (unchecked) and `- [x] ` (checked).

### Current checklist parser gap

The `tokens` export in `favro_markdown.ts` has NO entry for `favro_checklist` or `favro_checklistitem`. So when `- [ ] text` is fed to the parser, markdown-it parses it as a `bullet_list` > `list_item` > `paragraph` > text `"[ ] text"`. It is NOT converted back to a `favro_checklist` node — that conversion is missing.

### Current table parser gap

markdown-it's default preset supports GFM tables and generates: `table_open`, `thead_open`, `tr_open`, `th_open/close`, `thead_close`, `tbody_open`, `tr_open`, `td_open/close`, `tbody_close`, `table_close`. There are NO entries for `table`/`tr`/`td` in the `tokens` map, so tables are ignored during import.

### API round-trip design issue

`recreateDocumentFromDescription` → `createCardDocument` **appends MongoDB task lists** after parsing the description. If the PUT body contains `- [ ] Task` (markdown), after our parser fix the description would parse into `favro_checklist` nodes, AND the old MongoDB task lists would also be appended — causing duplicates.

**Fix:** New function `recreateDocumentFromMarkdown` that uses `replaceWithDoc` (not `recreateFromDescription`) to set the document directly from the parsed markdown. The existing `applyDependencyChanges` hook then diffs old doc vs new doc and correctly syncs task lists to MongoDB (removing old, adding new). The `updateCardDescriptionWithDocText` callback (registered in `getCardAuthorityOptions`) is called automatically during `insertDocument` — it converts the ProseMirror doc to plain text and updates `common.detailedDescription`.

**Note on `fixDocument`:** `fixDocument` (which calls `repairIds`) only runs for client operations (`op.clientId`), NOT for `replaceWithDoc`. This is fine because `convertCheckboxListsInDoc` generates fresh `Random.id()` values for all checklist nodes and items.

---

## Sub-plan 1: Serializer/Parser Changes

### Task 1: Fix checkbox serialization (export)

**Files:** `MainApp/lib/collaboration/server/favro_markdown.ts`, `MainApp/lib/collaboration/server/unittests/favro_markdown.app-test.ts` (new)

- [ ] **Step 1.0: Create the `unittests` directory**

The directory does not exist yet:
```bash
mkdir -p MainApp/lib/collaboration/server/unittests
```

- [ ] **Step 1.1: Create unit test file with failing serializer tests**

Create `MainApp/lib/collaboration/server/unittests/favro_markdown.app-test.ts`:

```typescript
import assert = require("assert");

import * as FavroMarkdown from "/lib/collaboration/server/favro_markdown";
import * as FavroSchema from "/lib/collaboration/favro_schema";
import * as MongoSync from "/lib/collaboration/server/mongosync/mongosync";
import * as ProseMirrorShared from "/lib/collaboration/prosemirror_shared";

// Server-side ProseMirror deps are loaded via prosemirror_import.ts (Meteor.startup).
// Tests run after startup so deps are available.

function makeChecklistDoc(items: Array<{ text: string; completed: boolean }>): ProseMirrorModel.Node {
	let taskListId = "test-list-id";
	let checklistItems = items.map(function(item, i): ProseMirrorModel.Node {
		let attrs: FavroSchema.ChecklistItemAttr = { taskId: `task-${i}`, completed: item.completed };
		let text = ProseMirrorShared.schema.text(item.text);
		let checklistItem = ProseMirrorShared.schema.nodes.favro_checklistitem.createAndFill(attrs, text);
		return checklistItem;
	});
	let checklistAttrs: FavroSchema.ChecklistAttr = { taskListId };
	let checklist = ProseMirrorShared.schema.nodes.favro_checklist.createAndFill(checklistAttrs, checklistItems);
	return ProseMirrorShared.schema.nodes.doc.createAndFill(null, [checklist]);
}

function serializeDoc(doc: ProseMirrorModel.Node): string {
	let state = FavroMarkdown.createSerializerState();
	doc.forEach(function(node, _offset, index): void {
		state.render(node, doc, index);
	});
	return state.out.trim();
}

describe("favro_markdown serializer - checkboxes", function(): void {
	it("should serialize unchecked checklist items as '- [ ] '", function(): void {
		let doc = makeChecklistDoc([{ text: "Task A", completed: false }]);
		let markdown = serializeDoc(doc);
		assert.ok(markdown.includes("- [ ] Task A"), `Expected '- [ ] Task A' in: ${markdown}`);
	});

	it("should serialize completed checklist items as '- [x] '", function(): void {
		let doc = makeChecklistDoc([{ text: "Task B", completed: true }]);
		let markdown = serializeDoc(doc);
		assert.ok(markdown.includes("- [x] Task B"), `Expected '- [x] Task B' in: ${markdown}`);
	});

	it("should serialize mixed completion states correctly", function(): void {
		let doc = makeChecklistDoc([
			{ text: "Done", completed: true },
			{ text: "Pending", completed: false },
		]);
		let markdown = serializeDoc(doc);
		assert.ok(markdown.includes("- [x] Done"), `Expected '- [x] Done' in: ${markdown}`);
		assert.ok(markdown.includes("- [ ] Pending"), `Expected '- [ ] Pending' in: ${markdown}`);
	});
});
```

- [ ] **Step 1.2: Run test to confirm it fails**

```bash
MOCHA_GREP="favro_markdown serializer - checkboxes" ./startdebug_unittest.sh --once
```
Expected: FAIL (currently outputs `-[ ] ` for all items regardless of completion)

- [ ] **Step 1.3: Fix the serializer in `favro_markdown.ts`**

In `MainApp/lib/collaboration/server/favro_markdown.ts`, replace the `favro_checklist` entry in the `nodes` export (around line 147):

```typescript
// Before:
favro_checklist: function(state: FavroMarkdownSerializerState, node: ProseMirrorModel.Node): void {
	state.renderList(node, "  ", () => "-[ ] ");
},
favro_checklistitem: function(state: FavroMarkdownSerializerState, node: ProseMirrorModel.Node): void {
	state.renderInline(node);
},

// After:
favro_checklist: function(state: FavroMarkdownSerializerState, node: ProseMirrorModel.Node): void {
	state.renderList(node, "  ", function(i: number): string {
		let item = node.child(i);
		let attrs = item.attrs as FavroSchema.ChecklistItemAttr;
		return attrs.completed ? "- [x] " : "- [ ] ";
	});
},
favro_checklistitem: function(state: FavroMarkdownSerializerState, node: ProseMirrorModel.Node): void {
	state.renderInline(node);
},
```

**Note on `renderList`:** Despite the parameter name `firstDelim`, prosemirror-markdown calls the callback with `(index)` for **every** item in the list, not just the first. The existing `ordered_list` handler (lines 119–126) does the same — it uses `i` to compute the item number. Using `node.child(i)` inside the callback is correct and intentional.

- [ ] **Step 1.4: Run test to confirm it passes**

```bash
MOCHA_GREP="favro_markdown serializer - checkboxes" ./startdebug_unittest.sh --once
```
Expected: PASS

- [ ] **Step 1.5: Commit**

```bash
git add MainApp/lib/collaboration/server/favro_markdown.ts MainApp/lib/collaboration/server/unittests/favro_markdown.app-test.ts
git commit -m "fix: serialize Favro checklists as standard - [ ] / - [x] markdown"
```

---

### Task 2: Add checkbox parsing (import)

**Files:** `MainApp/lib/collaboration/server/mongosync/mongosync.ts`, `MainApp/lib/collaboration/server/unittests/favro_markdown.app-test.ts`

**Approach:** Post-process the ProseMirror doc returned by `FavroMarkdown.getParser().parse()`. Walk top-level nodes; when a `bullet_list` has items whose text begins with `[ ] ` (unchecked) or `[x] ` (checked), convert the entire list to a `favro_checklist`. Also handle legacy paragraphs starting with `-[ ]` / `-[x]` (no space after `-`) by grouping consecutive runs into a checklist.

**Why post-process instead of parser tokens:** `favro_checklistitem` requires `taskId` and `taskListId` UUIDs. These must be generated as new `Random.id()` values during import. Note: `repairIds` (called by `fixDocument`) does NOT run for `replaceWithDoc` operations — it only runs for client operations (`op.clientId`). This is fine because `convertCheckboxListsInDoc` generates fresh `Random.id()` values for every checklist and item, so uniqueness is guaranteed without `fixDocument`.

**IMPORTANT — where checkbox conversion is applied:** `convertCheckboxListsInDoc` must NOT be called inside `markdownToDocument`. `markdownToDocument` is also used by `createCardDocument` (initial card creation), which **appends MongoDB task lists afterwards**. If we add checkbox conversion there, re-imported `- [ ]` items would be duplicated against existing MongoDB task lists. Instead, `convertCheckboxListsInDoc` is exported and called only in `recreateDocumentFromMarkdown` (the new API path). The unit tests below therefore test `convertCheckboxListsInDoc(markdownToDocument(...))` directly.

- [ ] **Step 2.1: Write failing parser tests**

Add to `MainApp/lib/collaboration/server/unittests/favro_markdown.app-test.ts`.

Note: tests call `MongoSync.convertCheckboxListsInDoc(MongoSync.markdownToDocument(...))` — this mirrors exactly what `recreateDocumentFromMarkdown` does internally.

```typescript
describe("markdownToDocument - checkboxes", function(): void {
	function parseMarkdown(text: string): ProseMirrorModel.Node {
		return MongoSync.convertCheckboxListsInDoc(MongoSync.markdownToDocument(text));
	}

	it("should parse '- [ ] text' as an unchecked favro_checklistitem", function(): void {
		let doc = parseMarkdown("- [ ] Task A");
		let topNode = doc.firstChild;
		assert.equal(topNode.type.name, "favro_checklist", "expected favro_checklist");
		let item = topNode.firstChild;
		assert.equal(item.type.name, "favro_checklistitem");
		assert.equal(item.attrs.completed, false);
		assert.equal(item.textContent, "Task A");
	});

	it("should parse '- [x] text' as a checked favro_checklistitem", function(): void {
		let doc = parseMarkdown("- [x] Task B");
		let topNode = doc.firstChild;
		assert.equal(topNode.type.name, "favro_checklist");
		let item = topNode.firstChild;
		assert.equal(item.attrs.completed, true);
		assert.equal(item.textContent, "Task B");
	});

	it("should keep regular bullet lists (no checkbox prefix) as bullet_list", function(): void {
		let doc = parseMarkdown("- Regular item");
		let topNode = doc.firstChild;
		assert.equal(topNode.type.name, "bullet_list");
	});

	it("should assign unique taskId and taskListId to parsed checklist nodes", function(): void {
		let doc = parseMarkdown("- [ ] A\n- [x] B");
		let checklist = doc.firstChild;
		assert.ok(checklist.attrs.taskListId, "taskListId should be set");
		let item0 = checklist.child(0);
		let item1 = checklist.child(1);
		assert.ok(item0.attrs.taskId, "taskId should be set");
		assert.ok(item1.attrs.taskId, "taskId should be set");
		assert.notEqual(item0.attrs.taskId, item1.attrs.taskId, "taskIds must be unique");
	});

	it("should handle legacy -[ ] paragraph format", function(): void {
		// Legacy format: -[ ] without space after - → stored as paragraph text
		let doc = parseMarkdown("-[ ] Task C");
		let topNode = doc.firstChild;
		assert.equal(topNode.type.name, "favro_checklist", "legacy -[ ] should become checklist");
		assert.equal(topNode.firstChild.attrs.completed, false);
		assert.equal(topNode.firstChild.textContent, "Task C");
	});

	it("should round-trip: checklist → markdown → checklist", function(): void {
		let originalDoc = makeChecklistDoc([
			{ text: "Done", completed: true },
			{ text: "Todo", completed: false },
		]);
		let markdown = serializeDoc(originalDoc);
		let roundTripped = parseMarkdown(markdown);
		let checklist = roundTripped.firstChild;
		assert.equal(checklist.type.name, "favro_checklist");
		assert.equal(checklist.childCount, 2);
		assert.equal(checklist.child(0).attrs.completed, true);
		assert.equal(checklist.child(0).textContent, "Done");
		assert.equal(checklist.child(1).attrs.completed, false);
		assert.equal(checklist.child(1).textContent, "Todo");
	});
});
```

- [ ] **Step 2.2: Run tests to confirm they fail**

```bash
MOCHA_GREP="markdownToDocument - checkboxes" ./startdebug_unittest.sh --once
```
Expected: FAIL (bullet_list is returned, not favro_checklist)

- [ ] **Step 2.3: Add `convertCheckboxListsInDoc` to `mongosync.ts`**

Add the following to `MainApp/lib/collaboration/server/mongosync/mongosync.ts` **before** `markdownToDocument`:

```typescript
/** Returns true if the bullet_list node's items all start with a checkbox prefix [ ] or [x] */
function isBulletCheckboxList(list: ProseMirrorModel.Node): boolean {
	if (list.childCount === 0)
		return false;

	let allMatch = true;
	list.forEach(function(item: ProseMirrorModel.Node): void {
		let firstChild = item.firstChild;
		if (!firstChild || firstChild.type !== ProseMirrorShared.schema.nodes.paragraph)
			allMatch = false;
		else if (!/^\[[ xX]\] /.test(firstChild.textContent))
			allMatch = false;
	});

	return allMatch;
}

/** Converts a bullet_list with checkbox items into a favro_checklist node.
 *  Preserves inline marks (bold, italic, code, links) by slicing the paragraph
 *  content after the checkbox prefix rather than rebuilding from textContent. */
function bulletListToChecklist(list: ProseMirrorModel.Node): ProseMirrorModel.Node {
	let checklistAttrs: FavroSchema.ChecklistAttr = { taskListId: Random.id() };
	let items: ProseMirrorModel.Node[] = [];

	list.forEach(function(item: ProseMirrorModel.Node): void {
		let firstPara = item.firstChild;
		let text = firstPara.textContent;
		let completed = /^\[[xX]\] /.test(text);
		let prefixLen = text.match(/^\[[ xX]\] /)[0].length;
		let attrs: FavroSchema.ChecklistItemAttr = { taskId: Random.id(), completed };

		// Slice the paragraph's inline content after the checkbox prefix to preserve marks.
		// The prefix "[ ] " or "[x] " is always plain text in the first text node.
		let content = firstPara.content.cut(prefixLen);
		let checklistItem = ProseMirrorShared.schema.nodes.favro_checklistitem.createAndFill(attrs, content.size > 0 ? content : null);
		items.push(checklistItem);
	});

	return ProseMirrorShared.schema.nodes.favro_checklist.createAndFill(checklistAttrs, items);
}

/** Returns true if a paragraph node's text matches legacy Favro checkbox format: -[ ] or -[x] */
function isLegacyCheckboxParagraph(node: ProseMirrorModel.Node): boolean {
	if (node.type !== ProseMirrorShared.schema.nodes.paragraph)
		return false;
	return /^-\[[ xX]\]/.test(node.textContent);
}

/** Converts a sequence of legacy -[ ] / -[x] paragraph nodes into a favro_checklist.
 *  Preserves inline marks by slicing the paragraph content after the prefix. */
function legacyParagraphsToChecklist(paragraphs: ProseMirrorModel.Node[]): ProseMirrorModel.Node {
	let checklistAttrs: FavroSchema.ChecklistAttr = { taskListId: Random.id() };
	let items = paragraphs.map(function(para): ProseMirrorModel.Node {
		let text = para.textContent;
		let completed = /^-\[[xX]\]/.test(text);
		let prefixLen = text.match(/^-\[[ xX]\]\s*/)[0].length;
		let attrs: FavroSchema.ChecklistItemAttr = { taskId: Random.id(), completed };

		// Slice paragraph content after the legacy prefix to preserve inline marks.
		let content = para.content.cut(prefixLen);
		return ProseMirrorShared.schema.nodes.favro_checklistitem.createAndFill(attrs, content.size > 0 ? content : null);
	});
	return ProseMirrorShared.schema.nodes.favro_checklist.createAndFill(checklistAttrs, items);
}

/**
 * Post-processes a parsed ProseMirror doc to convert checkbox bullet lists and
 * legacy -[ ] paragraphs into favro_checklist nodes.
 */
function convertCheckboxListsInDoc(doc: ProseMirrorModel.Node): ProseMirrorModel.Node {
	let newChildren: ProseMirrorModel.Node[] = [];
	let legacyRun: ProseMirrorModel.Node[] = [];
	let changed = false;

	function flushLegacyRun(): void {
		if (legacyRun.length === 0)
			return;
		newChildren.push(legacyParagraphsToChecklist(legacyRun));
		legacyRun = [];
		changed = true;
	}

	doc.forEach(function(node: ProseMirrorModel.Node): void {
		if (node.type === ProseMirrorShared.schema.nodes.bullet_list && isBulletCheckboxList(node)) {
			flushLegacyRun();
			newChildren.push(bulletListToChecklist(node));
			changed = true;
		} else if (isLegacyCheckboxParagraph(node)) {
			legacyRun.push(node);
		} else {
			flushLegacyRun();
			newChildren.push(node);
		}
	});
	flushLegacyRun();

	if (!changed)
		return doc;

	return ProseMirrorShared.schema.nodes.doc.createAndFill(null, newChildren);
}
```

**Do NOT modify `markdownToDocument`.** The function stays unchanged. Export `convertCheckboxListsInDoc` so it can be called from `recreateDocumentFromMarkdown`:

```typescript
// Change "function convertCheckboxListsInDoc" → "export function convertCheckboxListsInDoc"
export function convertCheckboxListsInDoc(doc: ProseMirrorModel.Node): ProseMirrorModel.Node {
    // ... body unchanged
```

**Import note:** `import * as FavroSchema from "/lib/collaboration/favro_schema"` already exists at line 9 of `mongosync.ts`. Do **not** add it again.

- [ ] **Step 2.4: Run tests to confirm they pass**

```bash
MOCHA_GREP="markdownToDocument - checkboxes" ./startdebug_unittest.sh --once
```
Expected: PASS

- [ ] **Step 2.5: Commit**

```bash
git add MainApp/lib/collaboration/server/mongosync/mongosync.ts MainApp/lib/collaboration/server/unittests/favro_markdown.app-test.ts
git commit -m "feat: parse standard - [ ] / - [x] markdown as Favro checklist nodes"
```

---

### Task 3: Add table parsing (import)

**Files:** `MainApp/lib/collaboration/server/favro_markdown.ts`, `MainApp/lib/collaboration/server/unittests/favro_markdown.app-test.ts`

**Approach:** markdown-it (default preset, `{ linkify: true }`) supports GFM tables and generates `table_open`, `thead_open`, `tr_open`, `th_open/close`, `thead_close`, `tbody_open`, `td_open/close`, `tbody_close`, `table_close` tokens. The prosemirror-markdown `MarkdownParser` maps token types via the `tokens` map (using the base name without `_open`). We need to:
1. Add `table`, `tr`, `td` to the `tokens` map.
2. Strip `thead`/`tbody` wrapper tokens in `FavroMarkdownIt.parse()` so the parser only sees `table`, `tr`, `td` tokens. Convert `th` → `td` so header cells are treated as regular cells.

**Note on table_cell content:** The Favro schema requires `table_cell` to contain block-level content (e.g., a `paragraph`). When markdown-it produces inline content (`td_open` → inline tokens → `td_close`), prosemirror-markdown wraps it in a paragraph automatically via its inline handling. If this doesn't happen automatically, a custom `node` handler will be needed for `td` that explicitly creates a `paragraph` wrapper.

**Known limitation — empty header row:** The existing table serializer (`favro_markdown.ts:156–166`) outputs an empty header row (`||`) followed by a separator (`|-|-|`) before the data rows, because the Favro ProseMirror schema does not support header cells. On round-trip, markdown-it parses this empty header row into a `tr` with empty `td` cells, so the round-tripped table will have an extra row compared to the original. This asymmetry is accepted as a known limitation for now; fixing it would require either header cell support in the schema or stripping the synthetic header row during import.

- [ ] **Step 3.1: Write failing parser tests for tables**

Add to `MainApp/lib/collaboration/server/unittests/favro_markdown.app-test.ts`:

```typescript
describe("markdownToDocument - tables", function(): void {
	it("should parse a standard GFM markdown table", function(): void {
		let markdown = "| a | b |\n| - | - |\n| c | d |";
		let doc = MongoSync.markdownToDocument(markdown);
		// First non-empty child should be a table
		let tableNode: ProseMirrorModel.Node;
		doc.forEach(function(node): void {
			if (node.type.name === "table")
				tableNode = node;
		});
		assert.ok(tableNode, "Expected a table node");
		// Should have at least the data row; header row may or may not be included
		assert.ok(tableNode.childCount >= 1, "Table should have at least 1 row");
		// Last row should have cell content 'c' and 'd'
		let lastRow = tableNode.lastChild;
		assert.equal(lastRow.firstChild.textContent, "c");
		assert.equal(lastRow.lastChild.textContent, "d");
	});

	it("should round-trip a Favro-exported table", function(): void {
		// Build a Favro table doc with one data row
		let cell = function(text: string): ProseMirrorModel.Node {
			return ProseMirrorShared.schema.nodes.table_cell.createAndFill(
				null,
				ProseMirrorShared.schema.nodes.paragraph.create(null, ProseMirrorShared.schema.text(text)),
			);
		};
		let row = ProseMirrorShared.schema.nodes.table_row.create(null, [cell("x"), cell("y")]);
		let tableDoc = ProseMirrorShared.schema.nodes.doc.create(null, [
			ProseMirrorShared.schema.nodes.table.create(null, [row]),
		]);

		let markdown = serializeDoc(tableDoc);
		// Exported markdown looks like: ||\n|-|-|\n|x|y|\n
		let roundTripped = MongoSync.markdownToDocument(markdown);

		let tableNode: ProseMirrorModel.Node;
		roundTripped.forEach(function(node): void {
			if (node.type.name === "table")
				tableNode = node;
		});
		assert.ok(tableNode, "Expected a table node after round-trip");

		// The data row must be preserved; find the row with 'x'
		let dataRow: ProseMirrorModel.Node;
		tableNode.forEach(function(row): void {
			if (row.firstChild.textContent === "x")
				dataRow = row;
		});
		assert.ok(dataRow, "Expected data row with 'x'");
		assert.equal(dataRow.lastChild.textContent, "y");
	});
});
```

- [ ] **Step 3.2: Run tests to confirm they fail**

```bash
MOCHA_GREP="markdownToDocument - tables" ./startdebug_unittest.sh --once
```
Expected: FAIL (table nodes are not being created)

- [ ] **Step 3.3: Update `FavroMarkdownIt.parse()` to normalize table tokens**

In `MainApp/lib/collaboration/server/favro_markdown.ts`, update the `FavroMarkdownIt` class:

```typescript
class FavroMarkdownIt extends MarkdownIt {
	parse(text: string): MarkdownIt.Token[] {
		let env: MarkdownIt.Environment = { toFavroSchema: true };
		let tokens = markdownIt.parse(text, env); // markdownIt is extended upon startup
		return normalizeTableTokens(tokens);
	}
}

function normalizeTableTokens(tokens: MarkdownIt.Token[]): MarkdownIt.Token[] {
	// Remove thead/tbody wrappers (prosemirror schema has no thead/tbody node types).
	// Convert th → td so header cells are treated as regular cells.
	let result: MarkdownIt.Token[] = [];
	for (let token of tokens) {
		if (token.type === "thead_open" || token.type === "thead_close" ||
			token.type === "tbody_open" || token.type === "tbody_close")
			continue;

		if (token.type === "th_open" || token.type === "th_close") {
			// Use prototype-preserving clone (object spread loses class prototype methods
			// like attrGet/attrSet which prosemirror-markdown may call):
			let cloned = Object.assign(Object.create(Object.getPrototypeOf(token)), token);
			cloned.type = token.type === "th_open" ? "td_open" : "td_close";
			cloned.tag = "td";
			result.push(cloned);
		} else {
			result.push(token);
		}
	}
	return result;
}
```

- [ ] **Step 3.4: Add table token mappings to `tokens` export**

In `MainApp/lib/collaboration/server/favro_markdown.ts`, add to the `tokens` export object:

```typescript
export const tokens: Generics.StringMap<TokenParser> = {
	// ... existing entries ...
	table: { block: "table" },
	tr: { block: "table_row" },
	td: { block: "table_cell" },
};
```

**Note:** If tests fail because `table_cell` content is not wrapped in `paragraph`, add a custom `node` handler for `td` in place of the `block` mapping:
```typescript
// Custom handler if paragraph wrapping is needed:
// td: {
//   node: "table_cell",
//   getAttrs: () => ({}),
// },
```
Try the simple `block` mapping first; only switch to the custom handler if paragraph wrapping doesn't happen automatically.

- [ ] **Step 3.5: Run tests to confirm they pass**

```bash
MOCHA_GREP="markdownToDocument - tables" ./startdebug_unittest.sh --once
```
Expected: PASS. If table cell content is not wrapped in paragraphs, fix as noted in Step 3.4.

- [ ] **Step 3.6: Also run all favro_markdown tests to avoid regression**

```bash
MOCHA_GREP="favro_markdown" ./startdebug_unittest.sh --once
```
Expected: all PASS

- [ ] **Step 3.7: Commit**

```bash
git add MainApp/lib/collaboration/server/favro_markdown.ts MainApp/lib/collaboration/server/unittests/favro_markdown.app-test.ts
git commit -m "feat: parse GFM markdown tables into Favro table nodes"
```

---

## Sub-plan 2: API Markdown Round-Trip

**Prerequisite:** Sub-plan 1 (Tasks 1–3) must be complete and merged first.

### Task 4: Add `recreateDocumentFromMarkdown` to `collaboration_card.server.ts`

**Files:** `MainApp/lib/collaboration/collaboration_card.server.ts`

**Why a new function:** The existing `recreateDocumentFromDescription` path calls `createCardDocument` which **appends MongoDB task lists** after parsing. For markdown-aware PUT/POST, the markdown is the full source of truth — existing or concurrently supplied task lists must not be merged on top of it. The `replaceWithDoc` operation already supports full document replacement: it diffs old vs new doc and calls `applyDependencyChanges` to sync task lists to MongoDB (removing old, adding new). Note: `fixDocument`/`repairIds` does NOT run for `replaceWithDoc` (only for `op.clientId`), but this is fine because `convertCheckboxListsInDoc` generates fresh `Random.id()` values. The `updateCardDescription` callback in the authority options (`updateCardDescriptionWithDocText`) is called automatically during `insertDocument` — it converts the new ProseMirror doc to plain text and updates `common.detailedDescription` in MongoDB.

- [ ] **Step 4.1: Write a unit test stub** (conceptual — full test is in Task 5 as E2E)

There is no isolated unit test for this function; the full behavior is tested E2E in Task 5. You may add a brief comment test, or skip to implementation.

- [ ] **Step 4.2: Add `recreateDocumentFromMarkdown` to `collaboration_card.server.ts`**

In `MainApp/lib/collaboration/collaboration_card.server.ts`, add after `recreateDocumentFromDescription`:

```typescript
/**
 * Replaces the card's document by parsing the given markdown string directly,
 * without appending existing MongoDB task lists. Task lists in the markdown
 * (standard - [ ] / - [x] syntax) become the new source of truth; existing
 * MongoDB task lists are removed and new ones are created via applyDependencyChanges.
 *
 * Use this instead of recreateDocumentFromDescription when the input is structured
 * markdown (i.e. descriptionFormat === "markdown" in the API).
 *
 * Note: common.detailedDescription is updated automatically by the
 * updateCardDescriptionWithDocText callback in the authority options — it
 * converts the new ProseMirror doc to plain text and stores that, which is
 * the correct behavior (we don't store raw markdown in the DB field).
 */
export async function recreateDocumentFromMarkdown(workspaceId: string, userId: string, key: string, markdown: string): Promise<void> {
	// convertCheckboxListsInDoc is called here (not inside markdownToDocument) so that
	// the plain-text path (recreateDocumentFromDescription) is not affected.
	let doc = MongoSync.convertCheckboxListsInDoc(MongoSync.markdownToDocument(markdown));

	await ChangesAccumulator.withScope(async function(): Promise<void> {
		await applyCardDocumentOp(workspaceId, {
			key,
			userId,
			replaceWithDoc: doc.toJSON(),
		});
	});
}
```

- [ ] **Step 4.3: Verify `make check` passes**

```bash
make check
```
Expected: no type errors or lint errors.

- [ ] **Step 4.4: Commit**

```bash
git add MainApp/lib/collaboration/collaboration_card.server.ts
git commit -m "feat: add recreateDocumentFromMarkdown for API markdown PUT/POST"
```

---

### Task 5: Update PUT/POST handlers + E2E tests

**Files:** `MainApp/server/api/cards/api_cards.ts`, `Test/src/api/apitest_cards.ts`, `Test/src/api/methods/apitest_cardmethods.ts`

- [ ] **Step 5.0: Update `API.Card.create` test helper for markdown compatibility**

The `create` helper in `Test/src/api/methods/apitest_cardmethods.ts` has two built-in assertions that will fail when `descriptionFormat=markdown`:

1. **`assertObject` checks `detailedDescription` matches input** (line 504): the POST response returns markdown re-serialized from ProseMirror, which may differ from the input (whitespace normalization, paragraph separators). The helper does `assert.deepEqual` against the raw input string.

2. **`checkTasklists` verifies API-supplied tasklists were created** (line 535-536): when markdown wins over `tasklists` on POST, the API-supplied tasklists are not created — but the helper still checks for them.

In `Test/src/api/methods/apitest_cardmethods.ts`, apply these changes:

Around line 504, skip the `detailedDescription` comparison when markdown format is used (the re-serialized markdown may differ from input):
```typescript
// Before:
	detailedDescription: createOptions.detailedDescription,

// After:
	...(!descriptionFormat ? { detailedDescription: createOptions.detailedDescription } : {}),
```

Around lines 535-536, skip the `checkTasklists` assertion when markdown description takes precedence over `tasklists`:
```typescript
// Before:
if (createOptions.tasklists)
	await checkTasklists(organizationId, card.cardCommonId, createOptions.tasklists, false, user);

// After:
if (createOptions.tasklists && !(descriptionFormat === "markdown" && createOptions.detailedDescription !== undefined))
	await checkTasklists(organizationId, card.cardCommonId, createOptions.tasklists, false, user);
```

- [ ] **Step 5.1: Write failing E2E tests for markdown PUT/POST round-trip**

**Note:** The `API.Card.create`, `API.Card.update`, and `API.Card.get` test helpers already accept a `descriptionFormat` parameter. `API.TaskList.getAll` and `API.Task.getAll/update` are also available for verifying task list behavior. The `create` helper was updated in Step 5.0 to skip built-in assertions that conflict with markdown semantics.

Add a new describe block in `Test/src/api/apitest_cards.ts`. Find the existing `"Update"` describe block and add after it:

```typescript
describe("Markdown round-trip", function(): void {
	let roundTripCard: API.Card;
	let postMarkdownCard: API.Card;

	Utils.before(async function(): Promise<void> {
		roundTripCard = await API.Card.create({
			widgetCommonId: backlogCommonId,
			name: "MarkdownRoundTripCard",
		}, API.user, organizationId);
	});

	it("should create task list items from standard checkbox markdown on POST", async function(): Promise<void> {
		postMarkdownCard = await API.Card.create({
			widgetCommonId: backlogCommonId,
			name: "MarkdownPostCard",
			detailedDescription: "- [ ] Post unchecked\n- [x] Post checked",
		}, API.user, organizationId, undefined, "markdown");
		assert.equal(postMarkdownCard.tasksTotal, 2);
		assert.equal(postMarkdownCard.tasksDone, 1);
	});

	it("should prefer markdown over tasklists on POST when descriptionFormat=markdown", async function(): Promise<void> {
		let card = await API.Card.create({
			widgetCommonId: backlogCommonId,
			name: "MarkdownWinsCard",
			detailedDescription: "- [ ] Markdown task",
			tasklists: [{
				name: "Ignored API Task List",
				tasks: [{
					name: "Ignored task",
				}],
			}],
		}, API.user, organizationId, undefined, "markdown");

		assert.equal(card.tasksTotal, 1);
		assert.equal(card.tasksDone, 0);

		let markdownCard = await API.Card.get(card.cardId, API.user, organizationId, null, { descriptionFormat: "markdown" });
		assert.ok(markdownCard.detailedDescription.includes("- [ ] Markdown task"));
		assert.ok(!markdownCard.detailedDescription.includes("Ignored task"));
	});

	it("should create task list items from standard checkbox markdown on PUT", async function(): Promise<void> {
		let markdown = "- [ ] Unchecked task\n- [x] Checked task";
		let updated = await API.Card.update(
			roundTripCard.cardId,
			{ detailedDescription: markdown },
			API.user,
			organizationId,
			undefined,
			"markdown",
		);
		assert.equal(updated.tasksTotal, 2);
		assert.equal(updated.tasksDone, 1);
	});

	it("should export checklist items as standard - [ ] / - [x] markdown on GET", async function(): Promise<void> {
		let card = await API.Card.get(roundTripCard.cardId, API.user, organizationId, null, { descriptionFormat: "markdown" });
		let description = card.detailedDescription;
		assert.ok(description.includes("- [ ] Unchecked task"), `Expected '- [ ] Unchecked task' in: ${description}`);
		assert.ok(description.includes("- [x] Checked task"), `Expected '- [x] Checked task' in: ${description}`);
	});

	it("should export POST-created checklist items as standard markdown on GET", async function(): Promise<void> {
		let card = await API.Card.get(postMarkdownCard.cardId, API.user, organizationId, null, { descriptionFormat: "markdown" });
		let description = card.detailedDescription;
		assert.ok(description.includes("- [ ] Post unchecked"), `Expected '- [ ] Post unchecked' in: ${description}`);
		assert.ok(description.includes("- [x] Post checked"), `Expected '- [x] Post checked' in: ${description}`);
	});

	it("should preserve task list items on markdown round-trip (GET then PUT)", async function(): Promise<void> {
		let card = await API.Card.get(roundTripCard.cardId, API.user, organizationId, null, { descriptionFormat: "markdown" });
		let markdown = card.detailedDescription;

		// Repost unchanged markdown — task counts should be unchanged
		let rePut = await API.Card.update(
			roundTripCard.cardId,
			{ detailedDescription: markdown },
			API.user,
			organizationId,
			undefined,
			"markdown",
		);
		assert.equal(rePut.tasksTotal, 2);
		assert.equal(rePut.tasksDone, 1);
	});

	it("should import a markdown table as a Favro table structure", async function(): Promise<void> {
		let markdown = "| col1 | col2 |\n| ---- | ---- |\n| a | b |";
		// PUT as markdown
		await API.Card.update(
			roundTripCard.cardId,
			{ detailedDescription: markdown },
			API.user,
			organizationId,
			undefined,
			"markdown",
		);
		// GET as markdown and verify the table survived the round-trip
		let card = await API.Card.get(roundTripCard.cardId, API.user, organizationId, null, { descriptionFormat: "markdown" });
		let description = card.detailedDescription;
		// A separator row (|-) is only produced by the table serializer, never by plain text.
		// This distinguishes a real parsed table from pipe-delimited text surviving as paragraphs.
		assert.ok(/\|-/.test(description), `Expected table separator row in: ${description}`);
		// Check cell content is present as markdown table cells
		assert.ok(description.includes("| a |") || description.includes("|a|"), `Expected cell 'a' in markdown table: ${description}`);
		assert.ok(description.includes("| b |") || description.includes("|b|"), `Expected cell 'b' in markdown table: ${description}`);
	});

	it("should handle PUT without descriptionFormat (plain text, no checklist parsing)", async function(): Promise<void> {
		// Use a fresh card so existing MongoDB task lists from earlier tests don't interfere.
		// recreateDocumentFromDescription → createCardDocument appends existing Mongo task lists,
		// so reusing roundTripCard (which has tasks from earlier tests) would give non-zero tasksTotal.
		let freshCard = await API.Card.create({
			widgetCommonId: backlogCommonId,
			name: "PlainTextPutCard",
		}, API.user, organizationId);

		let plain = "- [ ] This is plain text not a checklist";
		let updated = await API.Card.update(
			freshCard.cardId,
			{ detailedDescription: plain },
			API.user,
			organizationId,
		);
		// Without descriptionFormat=markdown, tasksTotal should be 0 (no markdown parsing on a fresh card)
		assert.equal(updated.tasksTotal, 0, "Plain text PUT should not create task list items");
	});
});
```

- [ ] **Step 5.1b: Add behavioral verification and degradation E2E tests**

Add the following tests to the same `Markdown round-trip` describe block in `Test/src/api/apitest_cards.ts`, after the tests from Step 5.1:

```typescript
	describe("Imported checklist behavior", function(): void {
		let behavioralCard: API.Card;

		Utils.before(async function(): Promise<void> {
			behavioralCard = await API.Card.create({
				widgetCommonId: backlogCommonId,
				name: "BehavioralTestCard",
				detailedDescription: "- [ ] Task one\n- [x] Task two",
			}, API.user, organizationId, undefined, "markdown");
		});

		it("should create real MongoDB task lists accessible via TaskList API", async function(): Promise<void> {
			let taskLists = await API.TaskList.getAll(
				{ cardCommonId: behavioralCard.cardCommonId },
				API.user,
				organizationId,
			);
			assert.equal(taskLists.length, 1, "Expected one task list");

			let tasks = await API.Task.getAll(
				{ taskListId: taskLists[0].taskListId },
				API.user,
				organizationId,
			);
			assert.equal(tasks.length, 2, "Expected two tasks");
			let taskOne = tasks.find(t => t.name === "Task one");
			let taskTwo = tasks.find(t => t.name === "Task two");
			assert.ok(taskOne, "Expected 'Task one'");
			assert.ok(taskTwo, "Expected 'Task two'");
			assert.equal(taskOne.completed, false);
			assert.equal(taskTwo.completed, true);
		});

		it("should allow toggling task completion state via Task API", async function(): Promise<void> {
			let taskLists = await API.TaskList.getAll(
				{ cardCommonId: behavioralCard.cardCommonId },
				API.user,
				organizationId,
			);
			let tasks = await API.Task.getAll(
				{ taskListId: taskLists[0].taskListId },
				API.user,
				organizationId,
			);
			let taskOne = tasks.find(t => t.name === "Task one");

			let updated = await API.Task.update(
				taskOne.taskId,
				{ completed: true },
				API.user,
				organizationId,
			);
			assert.equal(updated.completed, true);

			let card = await API.Card.get(behavioralCard.cardId, API.user, organizationId);
			assert.equal(card.tasksDone, 2, "Both tasks should now be done");
			assert.equal(card.tasksTotal, 2);
		});

		it("should allow reordering tasks via Task API", async function(): Promise<void> {
			let taskLists = await API.TaskList.getAll(
				{ cardCommonId: behavioralCard.cardCommonId },
				API.user,
				organizationId,
			);
			let tasks = await API.Task.getAll(
				{ taskListId: taskLists[0].taskListId },
				API.user,
				organizationId,
			);
			let taskTwo = tasks.find(t => t.name === "Task two");

			let reordered = await API.Task.update(
				taskTwo.taskId,
				{ position: 0 },
				API.user,
				organizationId,
			);
			assert.equal(reordered.position, 0);

			let reorderedTasks = await API.Task.getAll(
				{ taskListId: taskLists[0].taskListId },
				API.user,
				organizationId,
			);
			assert.equal(reorderedTasks[0].name, "Task two", "Task two should now be first");
		});

		it("should reflect correct progress after task mutations", async function(): Promise<void> {
			let taskLists = await API.TaskList.getAll(
				{ cardCommonId: behavioralCard.cardCommonId },
				API.user,
				organizationId,
			);
			let tasks = await API.Task.getAll(
				{ taskListId: taskLists[0].taskListId },
				API.user,
				organizationId,
			);
			let taskOne = tasks.find(t => t.name === "Task one");
			await API.Task.update(taskOne.taskId, { completed: false }, API.user, organizationId);

			let card = await API.Card.get(behavioralCard.cardId, API.user, organizationId);
			assert.equal(card.tasksTotal, 2);
			assert.equal(card.tasksDone, 1, "Only Task two should be done");
		});
	});

	it("should round-trip a mixed document with text, checklist, and table", async function(): Promise<void> {
		let mixedCard = await API.Card.create({
			widgetCommonId: backlogCommonId,
			name: "MixedDocCard",
			detailedDescription: "# Heading\n\nSome paragraph text.\n\n- [ ] Task A\n- [x] Task B\n\n| col1 | col2 |\n| ---- | ---- |\n| a | b |",
		}, API.user, organizationId, undefined, "markdown");

		assert.equal(mixedCard.tasksTotal, 2);
		assert.equal(mixedCard.tasksDone, 1);

		let card = await API.Card.get(mixedCard.cardId, API.user, organizationId, null, { descriptionFormat: "markdown" });
		let description = card.detailedDescription;

		// Text preserved
		assert.ok(description.includes("Heading"), `Expected 'Heading' in: ${description}`);
		assert.ok(description.includes("Some paragraph text"), `Expected 'Some paragraph text' in: ${description}`);
		// Checklist preserved
		assert.ok(description.includes("- [ ] Task A"), `Expected '- [ ] Task A' in: ${description}`);
		assert.ok(description.includes("- [x] Task B"), `Expected '- [x] Task B' in: ${description}`);
		// Table cell content preserved
		assert.ok(
			description.includes("|a|") || description.includes("| a |") || description.includes("|a "),
			`Expected table cell 'a' in: ${description}`,
		);
	});

	it("should degrade safely with unsupported markdown constructs", async function(): Promise<void> {
		let degradeCard = await API.Card.create({
			widgetCommonId: backlogCommonId,
			name: "DegradeTestCard",
		}, API.user, organizationId);

		let markdown = "<div>HTML block</div>\n\nNormal paragraph";
		await API.Card.update(
			degradeCard.cardId,
			{ detailedDescription: markdown },
			API.user,
			organizationId,
			undefined,
			"markdown",
		);

		let card = await API.Card.get(degradeCard.cardId, API.user, organizationId);
		assert.ok(card.detailedDescription !== undefined, "Description should not be undefined after unsupported markdown");
	});

	it("should clear document and task lists when given empty markdown on PUT", async function(): Promise<void> {
		let clearCard = await API.Card.create({
			widgetCommonId: backlogCommonId,
			name: "ClearTestCard",
			detailedDescription: "- [ ] Will be cleared",
		}, API.user, organizationId, undefined, "markdown");
		assert.equal(clearCard.tasksTotal, 1);

		let updated = await API.Card.update(
			clearCard.cardId,
			{ detailedDescription: "" },
			API.user,
			organizationId,
			undefined,
			"markdown",
		);
		assert.equal(updated.tasksTotal, 0, "Empty markdown should clear all task lists");
	});
```

**Note on convert-to-card:** The card requirement mentions "convert to card" as expected behavior for imported checklists. This is a UI-only operation not exposed through the public API, so it cannot be tested via E2E API tests. Verify manually that imported checklist items show the "Convert to card" option in the editor UI.

- [ ] **Step 5.2: Ask the user to start the test environment**

Tell the user: "Please run `./startdebug_test.sh` to start the test environment before running E2E tests."

- [ ] **Step 5.3: Run E2E tests to confirm they fail**

```bash
cd Test && ./test.sh -g "Markdown round-trip"
```
Expected: FAIL (the API POST path still uses `setDetailedDescription` + legacy `tasklists`, and the API PUT path still calls `recreateDocumentFromDescription` instead of the markdown-aware path)

- [ ] **Step 5.4: Update the PUT/POST handlers in `api_cards.ts`**

In `MainApp/server/api/cards/api_cards.ts`, update both the create flow and the PUT handler.

In the **create flow** inside the `createCard` inner function (around lines 283–359 of `api_cards.ts`), two locations need to change:

**Location 1 — Replace the `setDetailedDescription` call (lines 343-344):**
```typescript
// Before (line 343-344):
if (detailedDescription && detailedDescription.trim())
	await Meteor.callAsync("setDetailedDescription", cardId, detailedDescription);

// After:
if (descriptionFormat === "markdown" && detailedDescription !== undefined) {
	let createdCard = await Collection_Cards.findOneAsync(cardId, {
		fields: { "common.key": 1 },
	});
	await CollaborationCard.recreateDocumentFromMarkdown(context.workspaceId, context.user._id, createdCard.common.key, detailedDescription);
} else if (detailedDescription && detailedDescription.trim()) {
	await Meteor.callAsync("setDetailedDescription", cardId, detailedDescription);
}
```

**Location 2 — Conditionally skip `addTaskLists` (line 352):**
```typescript
// Before (line 352):
await ApiTaskListShared.addTaskLists(cardId, tasklists, context.user._id);

// After:
if (descriptionFormat !== "markdown" || detailedDescription === undefined)
	await ApiTaskListShared.addTaskLists(cardId, tasklists, context.user._id);
```

The `descriptionFormat` variable must be read from `context.params.query.descriptionFormat` at the top of the `createCard` function (or in the outer scope where it's already available for the response — see line 597).

**POST precedence rule:** when `descriptionFormat=markdown` **and** `detailedDescription` is provided, the markdown document is the source of truth and `tasklists` is ignored. When `descriptionFormat=markdown` but `detailedDescription` is omitted, `tasklists` is applied normally — the format parameter only affects the response shape in that case.

Then update the PUT handler (around line 751) where `detailedDescription` is processed:

```typescript
// Before:
if (detailedDescription)
	await CollaborationCard.recreateDocumentFromDescription(context.workspaceId, context.user._id, card.common.key, detailedDescription);

// After:
if (descriptionFormat === "markdown" && detailedDescription !== undefined) {
	// For markdown format, use the markdown-aware path. This also handles "" (empty string)
	// which clears the document, unlike the legacy path that skips empty strings.
	await CollaborationCard.recreateDocumentFromMarkdown(context.workspaceId, context.user._id, card.common.key, detailedDescription);
} else if (detailedDescription) {
	// Legacy path: truthiness check intentionally skips "" to preserve existing behavior.
	await CollaborationCard.recreateDocumentFromDescription(context.workspaceId, context.user._id, card.common.key, detailedDescription);
}
```

**Note:** The `detailedDescription !== undefined` check (instead of truthiness) is intentional for the markdown path. When `descriptionFormat=markdown`, an empty string `""` means "clear the document", and the `recreateDocumentFromMarkdown` function handles this correctly by producing an empty doc. The legacy path keeps its existing truthiness check to avoid changing behavior for non-markdown consumers.

**Implementation follow-up:** when this work is implemented, update the public API documentation to state that:
- `POST` and `PUT` with `descriptionFormat=markdown` treat markdown as the source of truth for the card document
- On `POST`, if `tasklists` is also supplied, markdown wins and `tasklists` is ignored
- `common.detailedDescription` continues to store derived plain text, while markdown is retrieved through `descriptionFormat=markdown`

- [ ] **Step 5.5: Verify `make check` passes**

```bash
make check
```
Expected: no type or lint errors.

- [ ] **Step 5.6: Run E2E tests to confirm they pass**

```bash
cd Test && ./test.sh -g "Markdown round-trip"
```
Expected: PASS. The markdown POST tests now create the initial document from `recreateDocumentFromMarkdown`, so checklist/task state is derived from the markdown and `tasklists` is ignored when both are supplied. The markdown PUT tests use the same markdown-aware document recreation path. The "plain text PUT" test still uses a fresh card (no existing MongoDB task lists) and the legacy `recreateDocumentFromDescription` path, so `tasksTotal` remains 0. The behavioral tests verify that imported checklists create real MongoDB task lists that support completion toggle, reorder, and progress updates via the Task API. The mixed-document test verifies text + checklist + table survive a POST round-trip. The degradation test verifies unsupported HTML blocks do not corrupt the card. The empty-markdown test verifies document and task list cleanup.

- [ ] **Step 5.7: Commit**

```bash
git add MainApp/server/api/cards/api_cards.ts Test/src/api/apitest_cards.ts Test/src/api/methods/apitest_cardmethods.ts
git commit -m "feat: use markdown parser for API PUT/POST when descriptionFormat=markdown"
```

---

## Future Scope: Attachment Round-Trip

Attachment round-trip is not part of this round.

If the work is reopened later, treat the following as unresolved questions rather than settled direction:

- How should `file_attachment` nodes be represented in markdown?
- How should `favro_attachment` nodes be represented in markdown?
- How should unchanged integration attachments be matched on import?
- Should image-grid layout be preserved on round-trip, and under what rules?
- What auth and portability tradeoffs are acceptable if attachment URLs need Favro-controlled dereference behavior?

---

## Edge Cases and Test Coverage Checklist

After Sub-plan 1:
- [ ] Mixed doc: text + checklist + table → all three are serialized correctly
- [ ] Empty checklist → serializes to nothing (or one empty item if required by schema)
- [ ] Checklist item with inline marks (bold, italic) → marks are preserved through round-trip
- [ ] Legacy `-[ ]` paragraphs → converted to checklist on import
- [ ] Table with merged cells (if supported) → no regression
- [ ] Table round-trip adds an extra empty header row (known limitation) → data rows are preserved correctly
- [ ] Named task lists: bold paragraph before a checklist → serialized as bold text + checklist in markdown; round-trip may lose the task list name. **Known limitation** (see Decision 1 in decision record).

After Sub-plan 2:
- [ ] POST with `descriptionFormat=markdown` + checklist/table content → correct document created
- [ ] POST with `descriptionFormat=markdown` + `tasklists` → markdown wins, `tasklists` ignored
- [ ] PUT with `descriptionFormat=markdown` + mixed text/checklist/table → correct document created
- [ ] PUT without `descriptionFormat` (plain text) → legacy behavior unchanged, no checklist parsing
- [ ] PUT with `descriptionFormat=markdown` + empty string → no error, empty document
- [ ] Existing MongoDB task lists replaced on markdown PUT (old lists removed, new ones from markdown)
- [ ] `tasksTotal` and `tasksDone` reflect the new checklist state after PUT
- [ ] Imported checklists create real MongoDB task lists accessible via TaskList/Task API (E2E: Step 5.1b)
- [ ] Imported checklist tasks support completion toggle via Task API with correct progress update (E2E: Step 5.1b)
- [ ] Imported checklist tasks support reordering via Task API (E2E: Step 5.1b)
- [ ] Convert-to-card for imported checklist items works in the editor UI (manual QA — not API-testable)
- [ ] Mixed document (text + checklist + table) round-trips correctly via POST with `descriptionFormat=markdown` (E2E: Step 5.1b)
- [ ] Unsupported markdown constructs (HTML blocks) degrade safely without corrupting the card (E2E: Step 5.1b)
- [ ] Empty markdown on PUT clears document and task lists (E2E: Step 5.1b)
- [ ] Public API docs updated during implementation to document markdown POST/PUT semantics and POST precedence over `tasklists`
