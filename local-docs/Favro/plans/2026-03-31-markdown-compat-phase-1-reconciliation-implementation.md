# Markdown Compatibility Phase 1 Reconciliation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the reconciled phase 1 markdown behavior for card descriptions: safe checklist round-trip, combined markdown plus API task-list payload support, and table-header heuristics that match the updated spec notes.

**Architecture:** Keep the existing phase 1 shape: `favro_markdown.ts` owns doc-to-markdown and markdown-to-doc shape conversions, `mongosync.ts` owns checklist-node creation from parsed markdown, and `api_cards.ts` owns POST/PUT sequencing. The implementation must preserve the new compatibility rule for legacy lookalike content by pairing import-side narrowing with export-side escaping for ordinary content that would otherwise be reinterpreted on round-trip.

**Tech Stack:** TypeScript, Meteor, ProseMirror, `prosemirror-markdown`, markdown-it, Mocha unit tests via `./startdebug_unittest.sh --once`, Puppeteer API tests via `Test/test.sh -g`, Make-based typecheck/lint.

---

## Scope And Source Of Truth

This plan implements only the reconciled phase 1 decisions recorded in:

- [Spec reconciliation note](/Users/vu/.assistant-preferences/local-docs/Favro/knowledge-references/2026-03-30-markdown-compat-spec-reconciliation.md)
- [Decision record](/Users/vu/.assistant-preferences/local-docs/Favro/brainstorm/2026-03-24-markdown-compat-decision-record.md)
- [Favro card update notes](/Users/vu/.assistant-preferences/local-docs/Favro/knowledge-references/2026-03-31-markdown-compat-favro-card-update-notes.md)

This plan intentionally supersedes the outdated behavior assumptions in [2026-03-23-markdown-compat.md](/Users/vu/.assistant-preferences/local-docs/Favro/plans/2026-03-23-markdown-compat.md), especially:

- markdown no longer ignores `tasklists` / `addTasklists`
- legacy compact `-[ ]` input is no longer a required API markdown contract
- tables now have a settled header-formatting heuristic

Attachment round-trip remains out of scope.

## Worktree And Test Prerequisites

- Execute this plan from a dedicated worktree.
- Before running Puppeteer/API tests, have the user start `./startdebug_test.sh`.
- Unit tests in this plan use `./startdebug_unittest.sh --once`.

## File Map

| File | Action | Reason |
|---|---|---|
| `MainApp/server/api/cards/api_cards.ts` | Modify | Change POST/PUT sequencing so markdown builds the base document first and API task-list payloads append afterwards |
| `Test/src/api/apitest_cards.ts` | Modify | Update markdown round-trip API expectations and add regression coverage for combined payloads, lookalike content, and table headers |
| `Test/src/api/methods/apitest_cardmethods.ts` | Modify | Adjust shared helper assertions so markdown-created lists and appended API task lists can coexist |
| `MainApp/lib/collaboration/server/mongosync/mongosync.ts` | Modify | Narrow checklist import behavior and remove legacy compact-paragraph conversion from markdown API round-trip |
| `MainApp/lib/collaboration/server/favro_markdown.ts` | Modify | Add round-trip-safe export escaping for ordinary lookalike content and add table-header import/export helpers |
| `MainApp/lib/collaboration/collaboration_card.server.ts` | Modify | Ensure markdown export uses the round-trip-safe markdown preparation path |
| `MainApp/lib/collaboration/server/unittests/favro_markdown.app-test.ts` | Modify | Add unit coverage for safe checklist round-trip and table-header heuristics |
| `/Users/vu/.assistant-preferences/local-docs/Favro/knowledge-references/markdown-card-description-current-behavior.md` | Modify | Refresh repo-local behavior notes after implementation lands |

## Implementation Strategy

1. Lock the new API contract first with failing Puppeteer/API tests.
2. Implement POST/PUT sequencing to satisfy the combined markdown plus task-list payload behavior.
3. Lock the new checklist compatibility behavior with unit tests, then implement the paired import/export fix:
   - import no longer treats legacy compact paragraphs as checklists
   - export escapes ordinary content that only looks like a task-list marker
4. Lock the table-header heuristic with unit and API tests, then implement import/export support.
5. Update the repo-local behavior docs and run focused verification plus one full repo check.

---

### Task 1: Lock The New API Contract In Tests

**Files:**
- Modify: `Test/src/api/apitest_cards.ts`
- Modify: `Test/src/api/methods/apitest_cardmethods.ts`

- [ ] **Step 1: Write the failing API tests for combined markdown and task-list payloads**

Update `Test/src/api/apitest_cards.ts` inside `describe("Markdown round-trip", ...)`.

Replace the old POST test that expects markdown to win over `tasklists` with this:

```typescript
		it("should append API tasklists after markdown on POST when descriptionFormat=markdown", async function(): Promise<void> {
			let card = await API.Card.create({
				widgetCommonId: backlogCommonId,
				name: "MarkdownAndTasklistsPostCard",
				detailedDescription: "- [ ] Markdown task",
				tasklists: [{
					name: "API Task List",
					tasks: [{
						name: "API task",
					}],
				}],
			}, API.user, organizationId, undefined, "markdown");

			createdCardIds.push(card.cardId);
			assert.equal(card.tasksTotal, 2);
			assert.equal(card.tasksDone, 0);

			let markdownCard = await API.Card.get(card.cardId, API.user, organizationId, null, { descriptionFormat: "markdown" });
			assert.ok(markdownCard.detailedDescription.includes("- [ ] Markdown task"));
			assert.ok(markdownCard.detailedDescription.includes("**API Task List**"));
			assert.ok(markdownCard.detailedDescription.includes("- [ ] API task"));
		});
```

Add this new PUT test nearby:

```typescript
		it("should append addTasklists after markdown on PUT when descriptionFormat=markdown", async function(): Promise<void> {
			let updated = await API.Card.update(
				roundTripCard.cardId,
				{
					detailedDescription: "- [ ] Rebuilt markdown task",
					addTasklists: [{
						name: "PUT API Task List",
						tasks: [{
							name: "PUT API task",
							completed: true,
						}],
					}],
				},
				API.user,
				organizationId,
				undefined,
				"markdown",
			);

			assert.equal(updated.tasksTotal, 2);
			assert.equal(updated.tasksDone, 1);

			let markdownCard = await API.Card.get(roundTripCard.cardId, API.user, organizationId, null, { descriptionFormat: "markdown" });
			assert.ok(markdownCard.detailedDescription.includes("- [ ] Rebuilt markdown task"));
			assert.ok(markdownCard.detailedDescription.includes("**PUT API Task List**"));
			assert.ok(markdownCard.detailedDescription.includes("- [x] PUT API task"));
		});
```

Update `Test/src/api/methods/apitest_cardmethods.ts` so `create()` allows extra markdown-derived task lists when markdown and `tasklists` are both supplied:

```typescript
	if (createOptions.tasklists) {
		let hasMarkdownTasklists = descriptionFormat === "markdown" && createOptions.detailedDescription !== undefined;
		await checkTasklists(organizationId, card.cardCommonId, createOptions.tasklists, hasMarkdownTasklists, user);
	}
```

- [ ] **Step 2: Run the API tests to verify they fail**

Run after the user has started `./startdebug_test.sh`:

```bash
/bin/zsh -lc 'cd Test && ./test.sh -g "API Cards.*Markdown round-trip"'
```

Expected: FAIL in the old POST test replacement and the new PUT test because current code still skips POST `tasklists` and applies PUT `addTasklists` before markdown reconstruction.

- [ ] **Step 3: Write the minimal helper fix needed for the new assertions**

Keep `checkTasklists()` unchanged, but make the update helper explicit about additive lists already coexisting with markdown-generated lists:

```typescript
	if (updateOptions.addTasklists)
		await checkTasklists(organizationId, updatedCard.cardCommonId, updateOptions.addTasklists, true);
```

This line already exists. Leave it as-is. Only the `create()` helper needs to be changed for the new POST semantics.

- [ ] **Step 4: Re-run the API tests and confirm they still fail only on product behavior**

Run:

```bash
/bin/zsh -lc 'cd Test && ./test.sh -g "API Cards.*Markdown round-trip"'
```

Expected: FAIL only on the actual POST/PUT sequencing behavior, not on helper assertion shape.

- [ ] **Step 5: Commit the test-only setup**

```bash
git add Test/src/api/apitest_cards.ts Test/src/api/methods/apitest_cardmethods.ts
git commit -m "test: lock markdown api tasklist append contract"
```

---

### Task 2: Implement POST/PUT Markdown Sequencing

**Files:**
- Modify: `MainApp/server/api/cards/api_cards.ts`
- Test: `Test/src/api/apitest_cards.ts`

- [ ] **Step 1: Use the failing API contract from Task 1 as the red test**

Do not add new tests here. Reuse the failing tests from Task 1.

- [ ] **Step 2: Run the API tests to keep the failure visible**

Run:

```bash
/bin/zsh -lc 'cd Test && ./test.sh -g "API Cards.*Markdown round-trip"'
```

Expected: FAIL on the POST/PUT combined markdown plus task-list cases.

- [ ] **Step 3: Implement markdown-first, tasklist-after sequencing in `api_cards.ts`**

In `createCards()` inside `MainApp/server/api/cards/api_cards.ts`, replace the current markdown/tasklist block:

```typescript
		if (descriptionFormat === "markdown" && detailedDescription !== undefined) {
			let createdCard = await Collection_Cards.findOneAsync(cardId, {
				fields: { "common.key": 1 },
			});
			await CollaborationCard.recreateDocumentFromMarkdown(context.workspaceId, context.user._id, createdCard.common.key, detailedDescription);
		} else if (detailedDescription && detailedDescription.trim()) {
			await Meteor.callAsync("setDetailedDescription", cardId, detailedDescription);
		}

		if (dependencies) {
			for (let dep of dependencies)
				await Meteor.callAsync("createCardDependencies", [cardId], dep.cardId, dep.isBefore);
		}

		await ApiCardShared.setAssignments(cardId, assignmentIds);
		if (descriptionFormat !== "markdown" || detailedDescription === undefined)
			await ApiTaskListShared.addTaskLists(cardId, tasklists, context.user._id);
```

with:

```typescript
		let shouldAppendTasklistsAfterMarkdown = descriptionFormat === "markdown" && detailedDescription !== undefined;

		if (descriptionFormat === "markdown" && detailedDescription !== undefined) {
			let createdCard = await Collection_Cards.findOneAsync(cardId, {
				fields: { "common.key": 1 },
			});
			await CollaborationCard.recreateDocumentFromMarkdown(context.workspaceId, context.user._id, createdCard.common.key, detailedDescription);
		} else if (detailedDescription && detailedDescription.trim()) {
			await Meteor.callAsync("setDetailedDescription", cardId, detailedDescription);
		}

		if (dependencies) {
			for (let dep of dependencies)
				await Meteor.callAsync("createCardDependencies", [cardId], dep.cardId, dep.isBefore);
		}

		await ApiCardShared.setAssignments(cardId, assignmentIds);
		if (shouldAppendTasklistsAfterMarkdown && tasklists?.length)
			await ApiTaskListShared.addTaskLists(cardId, tasklists, context.user._id);
		else if (!shouldAppendTasklistsAfterMarkdown)
			await ApiTaskListShared.addTaskLists(cardId, tasklists, context.user._id);
```

In the `PUT /api/v1/cards/:cardId` callback, move the `addTasklists` call to after markdown reconstruction:

```typescript
				await ApiCardShared.setAssignments(cardId, addAssignmentIds, removeAssignmentIds);

				if (addTags.length || removeTags.length || addTagIds.length || removeTagIds.length) {
					...
				}

				let { startDate, dueDate } = context.body;
				await ApiCardShared.setStartDueDate(card, startDate, dueDate);

				let shouldAppendTasklistsAfterMarkdown = descriptionFormat === "markdown" && detailedDescription !== undefined;
				if (!shouldAppendTasklistsAfterMarkdown)
					await ApiTaskListShared.addTaskLists(cardId, addTasklists, context.user._id);

				if (descriptionFormat === "markdown" && detailedDescription !== undefined) {
					await CollaborationCard.recreateDocumentFromMarkdown(context.workspaceId, context.user._id, card.common.key, detailedDescription);
				} else if (detailedDescription) {
					await CollaborationCard.recreateDocumentFromDescription(context.workspaceId, context.user._id, card.common.key, detailedDescription);
				}

				if (shouldAppendTasklistsAfterMarkdown && addTasklists?.length)
					await ApiTaskListShared.addTaskLists(cardId, addTasklists, context.user._id);
```

This preserves the existing non-markdown flow while enforcing the reconciled markdown-first ordering.

- [ ] **Step 4: Run the API tests to verify the new contract passes**

Run:

```bash
/bin/zsh -lc 'cd Test && ./test.sh -g "API Cards.*Markdown round-trip"'
```

Expected: PASS for the new POST/PUT combination tests and existing markdown round-trip tests that are still valid.

- [ ] **Step 5: Commit**

```bash
git add MainApp/server/api/cards/api_cards.ts Test/src/api/apitest_cards.ts Test/src/api/methods/apitest_cardmethods.ts
git commit -m "feat: append api tasklists after markdown document rebuild"
```

---

### Task 3: Preserve Legacy Lookalike Content During Checklist Round-Trip

**Files:**
- Modify: `MainApp/lib/collaboration/server/mongosync/mongosync.ts`
- Modify: `MainApp/lib/collaboration/server/favro_markdown.ts`
- Modify: `MainApp/lib/collaboration/collaboration_card.server.ts`
- Modify: `MainApp/lib/collaboration/server/unittests/favro_markdown.app-test.ts`
- Modify: `Test/src/api/apitest_cards.ts`

- [ ] **Step 1: Write the failing unit and API regressions**

Add `makeBulletListDoc()` and `makeParagraphDoc()` near the existing top-level helpers in `MainApp/lib/collaboration/server/unittests/favro_markdown.app-test.ts`.

```typescript
function makeBulletListDoc(items: string[]): ProseMirrorModel.Node {
	let listItems = items.map(function(text): ProseMirrorModel.Node {
		return ProseMirrorShared.schema.nodes.list_item.createAndFill(
			null,
			ProseMirrorShared.schema.nodes.paragraph.createAndFill(null, ProseMirrorShared.schema.text(text)),
		);
	});

	return ProseMirrorShared.schema.nodes.doc.createAndFill(null, [
		ProseMirrorShared.schema.nodes.bullet_list.createAndFill(null, listItems),
	]);
}

function makeParagraphDoc(text: string): ProseMirrorModel.Node {
	return ProseMirrorShared.schema.nodes.doc.createAndFill(null, [
		ProseMirrorShared.schema.nodes.paragraph.createAndFill(null, ProseMirrorShared.schema.text(text)),
	]);
}
```

Add the new `it(...)` cases inside the existing `describe("markdownToDocument - checkboxes", function(): void { ... })` block.
`parseMarkdown()` is block-scoped inside that describe, so these tests must stay in that block unless the helper is moved.

```typescript

	it("should keep legacy compact -[ ] paragraph format as plain paragraph", function(): void {
		let doc = parseMarkdown("-[ ] Task C");
		let topNode = doc.firstChild;
		assert.equal(topNode.type.name, "paragraph");
		assert.equal(topNode.textContent, "-[ ] Task C");
	});

	it("should escape ordinary bullet-list text that only looks like a checkbox", function(): void {
		let doc = makeBulletListDoc(["[X] Literal item"]);
		let markdown = serializeDoc(doc);
		assert.ok(markdown.includes("* \\[X] Literal item"), `Expected escaped bullet item in: ${markdown}`);

		let roundTripped = parseMarkdown(markdown);
		assert.equal(roundTripped.firstChild.type.name, "bullet_list");
		assert.equal(roundTripped.firstChild.firstChild.textContent, "[X] Literal item");
	});

	it("should escape legacy compact paragraph lookalikes on export", function(): void {
		let doc = makeParagraphDoc("-[ ] Literal paragraph");
		let markdown = serializeDoc(doc);
		assert.ok(markdown.includes("-\\[ ] Literal paragraph"), `Expected escaped paragraph in: ${markdown}`);

		let roundTripped = parseMarkdown(markdown);
		assert.equal(roundTripped.firstChild.type.name, "paragraph");
		assert.equal(roundTripped.firstChild.textContent, "-[ ] Literal paragraph");
	});

	it("should preserve checklist structure across parse, serialize, and parse again", function(): void {
		let original = parseMarkdown("- [ ] Task A\n- [x] Task B");
		let markdown = serializeDoc(original);
		let roundTripped = parseMarkdown(markdown);

		let checklist = roundTripped.firstChild;
		assert.equal(checklist.type.name, "favro_checklist");
		assert.equal(checklist.childCount, 2);
		assert.equal(checklist.child(0).attrs.completed, false);
		assert.equal(checklist.child(0).textContent, "Task A");
		assert.equal(checklist.child(1).attrs.completed, true);
		assert.equal(checklist.child(1).textContent, "Task B");
	});
```

Add the API regression inside the existing `describe("Markdown round-trip", function(): void { ... })` block in `Test/src/api/apitest_cards.ts`:

```typescript
		it("should preserve existing lookalike checklist content on GET then PUT markdown round-trip", async function(): Promise<void> {
			let lookalikeCard = await API.Card.create({
				widgetCommonId: backlogCommonId,
				name: "LookalikeRoundTripCard",
				detailedDescription: "- [X] Literal bullet content\n\n-[ ] Literal paragraph content",
			}, API.user, organizationId);
			createdCardIds.push(lookalikeCard.cardId);

			let markdownCard = await API.Card.get(lookalikeCard.cardId, API.user, organizationId, null, { descriptionFormat: "markdown" });
			assert.ok(markdownCard.detailedDescription.includes("* \\[X] Literal bullet content"));
			assert.ok(markdownCard.detailedDescription.includes("-\\[ ] Literal paragraph content"));

			let updated = await API.Card.update(
				lookalikeCard.cardId,
				{ detailedDescription: markdownCard.detailedDescription },
				API.user,
				organizationId,
				undefined,
				"markdown",
			);
			assert.equal(updated.tasksTotal, 0);
		});
```

- [ ] **Step 2: Run the focused tests and confirm they fail**

Run:

```bash
MOCHA_GREP="markdownToDocument - checkboxes|serializer - checkboxes" ./startdebug_unittest.sh --once
```

Expected: FAIL because `-[ ]` still becomes a checklist and plain lookalike content is not escaped on export.

Run after the user has started `./startdebug_test.sh`:

```bash
/bin/zsh -lc 'cd Test && ./test.sh -g "API Cards.*LookalikeRoundTripCard|API Cards.*Markdown round-trip"'
```

Expected: FAIL because GET markdown does not escape the lookalike prefixes and PUT markdown can still create checklist state from them.

- [ ] **Step 3: Implement the paired import/export fix**

First, remove legacy compact paragraph conversion from `MainApp/lib/collaboration/server/mongosync/mongosync.ts`.

Delete:

```typescript
function isLegacyCheckboxParagraph(node: ProseMirrorModel.Node): boolean { ... }
function legacyParagraphsToChecklist(paragraphs: ProseMirrorModel.Node[]): ProseMirrorModel.Node { ... }
```

Rewrite `convertCheckboxListsInDoc()` to only convert bullet lists:

```typescript
export function convertCheckboxListsInDoc(doc: ProseMirrorModel.Node): ProseMirrorModel.Node {
	let newChildren: ProseMirrorModel.Node[] = [];
	let changed = false;

	doc.forEach(function(node: ProseMirrorModel.Node): void {
		if (node.type === ProseMirrorShared.schema.nodes.bullet_list && isBulletCheckboxList(node)) {
			newChildren.push(bulletListToChecklist(node));
			changed = true;
		} else {
			newChildren.push(node);
		}
	});

	if (!changed)
		return doc;

	return ProseMirrorShared.schema.nodes.doc.createAndFill(null, newChildren);
}
```

Second, add a round-trip-safe export preparation helper in `MainApp/lib/collaboration/server/favro_markdown.ts`:

```typescript
type ProseMirrorNodeJson = ProseMirrorModel.NodeJSON & { content?: ProseMirrorNodeJson[] };

function escapeListItemLookalike(text: string): string {
	return text.replace(/^\[([ xX])\] /, "\\[$1] ");
}

function escapeParagraphLookalike(text: string): string {
	return text.replace(/^-\[([ xX])\](\s*)/, "-\\[$1]$2");
}

function escapeLeadingText(node: ProseMirrorNodeJson, escape: (text: string) => string): void {
	let firstChild = node.content?.[0];
	if (!firstChild || firstChild.type !== "text")
		return;

	let escapedText = escape(firstChild.text || "");
	if (escapedText !== firstChild.text)
		firstChild.text = escapedText;
}

function prepareNodeJsonForMarkdownRoundTrip(node: ProseMirrorNodeJson, parentType?: string): void {
	if (node.type === "paragraph" && parentType !== "favro_checklistitem")
		escapeLeadingText(node, escapeParagraphLookalike);

	if (node.type === "list_item" && (parentType === "bullet_list" || parentType === "ordered_list")) {
		let firstParagraph = node.content?.[0];
		if (firstParagraph?.type === "paragraph")
			escapeLeadingText(firstParagraph, escapeListItemLookalike);
	}

	for (let child of node.content || [])
		prepareNodeJsonForMarkdownRoundTrip(child, node.type);
}

export function prepareDocForMarkdownRoundTrip(doc: ProseMirrorModel.Node): ProseMirrorModel.Node {
	let json = doc.toJSON() as ProseMirrorNodeJson;
	prepareNodeJsonForMarkdownRoundTrip(json);
	return ProseMirrorShared.schema.nodeFromJSON(json);
}
```

Then use that helper in `MainApp/lib/collaboration/collaboration_card.server.ts`:

```typescript
	let doc = ProseMirrorShared.schema.nodeFromJSON(latestDoc.doc);
	doc = FavroMarkdown.prepareDocForMarkdownRoundTrip(doc);
	await FavroMarkdown.preResolveSerializerData(doc, options);
```

Finally, update the unit-test serializer helper in `MainApp/lib/collaboration/server/unittests/favro_markdown.app-test.ts` so it exercises the same export path:

```typescript
function serializeDoc(doc: ProseMirrorModel.Node): string {
	doc = FavroMarkdown.prepareDocForMarkdownRoundTrip(doc);
	let state = FavroMarkdown.createSerializerState();
	doc.forEach(function(node, _offset, index): void {
		state.render(node, doc, index);
	});
	return state.out.trim();
}
```

- [ ] **Step 4: Run the focused tests to verify the round-trip safety fix**

Run:

```bash
MOCHA_GREP="markdownToDocument - checkboxes|serializer - checkboxes" ./startdebug_unittest.sh --once
```

Expected: PASS, including the new “keep legacy compact paragraph as plain paragraph” and export-escaping tests.

Run:

```bash
/bin/zsh -lc 'cd Test && ./test.sh -g "API Cards.*Markdown round-trip"'
```

Expected: PASS, including the new lookalike-content regression.

- [ ] **Step 5: Commit**

```bash
git add MainApp/lib/collaboration/server/mongosync/mongosync.ts MainApp/lib/collaboration/server/favro_markdown.ts MainApp/lib/collaboration/collaboration_card.server.ts MainApp/lib/collaboration/server/unittests/favro_markdown.app-test.ts Test/src/api/apitest_cards.ts
git commit -m "fix: preserve lookalike checklist content during markdown round-trip"
```

---

### Task 4: Implement The Table Header Heuristic

**Files:**
- Modify: `MainApp/lib/collaboration/server/favro_markdown.ts`
- Modify: `MainApp/lib/collaboration/server/unittests/favro_markdown.app-test.ts`
- Modify: `Test/src/api/apitest_cards.ts`

- [ ] **Step 1: Write the failing unit and API tests for table headers**

Add `makeTableCell()` near the other top-level test helpers in `MainApp/lib/collaboration/server/unittests/favro_markdown.app-test.ts`.

```typescript
function makeTableCell(text: string, marks?: ProseMirrorModel.Mark[]): ProseMirrorModel.Node {
	let content = text ? ProseMirrorShared.schema.text(text, marks) : null;
	return ProseMirrorShared.schema.nodes.table_cell.createAndFill(
		null,
		ProseMirrorShared.schema.nodes.paragraph.createAndFill(null, content),
	);
}
```

Add the import-specific test inside the existing `describe("markdownToDocument - tables", function(): void { ... })` block:

```typescript

	it("should import GFM table headers as bold text in the first row", function(): void {
		let markdown = "| Head A | Head B |\n| --- | --- |\n| c | d |";
		let doc = MongoSync.markdownToDocument(markdown);

		let tableNode: ProseMirrorModel.Node;
		doc.forEach(function(node): void {
			if (node.type.name === "table")
				tableNode = node;
		});

		let firstRow = tableNode.firstChild;
		let firstCellParagraph = firstRow.firstChild.firstChild;
		assert.equal(firstCellParagraph.firstChild.marks[0].type.name, "bold");
		assert.equal(firstCellParagraph.textContent, "Head A");
	});
```

Add the serializer-specific tests in a new sibling block `describe("favro_markdown serializer - tables", function(): void { ... })` rather than mixing them into the import block:

```typescript

describe("favro_markdown serializer - tables", function(): void {
	it("should export a bold-only first row as a GFM header row", function(): void {
		let bold = [ProseMirrorShared.schema.mark("bold")];
		let headerRow = ProseMirrorShared.schema.nodes.table_row.create(null, [
			makeTableCell("Head A", bold),
			makeTableCell("Head B", bold),
		]);
		let dataRow = ProseMirrorShared.schema.nodes.table_row.create(null, [
			makeTableCell("a"),
			makeTableCell("b"),
		]);
		let doc = ProseMirrorShared.schema.nodes.doc.create(null, [
			ProseMirrorShared.schema.nodes.table.create(null, [headerRow, dataRow]),
		]);

		let markdown = serializeDoc(doc);
		assert.ok(markdown.includes("| Head A | Head B |"), `Expected header row in: ${markdown}`);
		assert.ok(markdown.includes("| --- | --- |") || markdown.includes("|---|---|"), `Expected separator row in: ${markdown}`);
	});

	it("should not export a partially bold first row as a GFM header row", function(): void {
		let headerRow = ProseMirrorShared.schema.nodes.table_row.create(null, [
			makeTableCell("Head A", [ProseMirrorShared.schema.mark("bold")]),
			makeTableCell("Head B"),
		]);
		let dataRow = ProseMirrorShared.schema.nodes.table_row.create(null, [
			makeTableCell("a"),
			makeTableCell("b"),
		]);
		let doc = ProseMirrorShared.schema.nodes.doc.create(null, [
			ProseMirrorShared.schema.nodes.table.create(null, [headerRow, dataRow]),
		]);

		let markdown = serializeDoc(doc);
		assert.ok(markdown.startsWith("|||") || markdown.startsWith("| | |") || markdown.includes("|-|-|"), `Expected fallback non-header table export in: ${markdown}`);
	});

	it("should not export a first row with empty header cells as a GFM header row", function(): void {
		let bold = [ProseMirrorShared.schema.mark("bold")];
		let headerRow = ProseMirrorShared.schema.nodes.table_row.create(null, [
			makeTableCell("Head A", bold),
			makeTableCell(""),
		]);
		let dataRow = ProseMirrorShared.schema.nodes.table_row.create(null, [
			makeTableCell("a"),
			makeTableCell("b"),
		]);
		let doc = ProseMirrorShared.schema.nodes.doc.create(null, [
			ProseMirrorShared.schema.nodes.table.create(null, [headerRow, dataRow]),
		]);

		let markdown = serializeDoc(doc);
		assert.ok(markdown.startsWith("|||") || markdown.startsWith("| | |") || markdown.includes("|-|-|"), `Expected fallback non-header table export in: ${markdown}`);
	});
});
```

Add the API regression inside the existing `describe("Markdown round-trip", function(): void { ... })` block in `Test/src/api/apitest_cards.ts`:

```typescript
		it("should round-trip markdown table headers using the bold-first-row heuristic", async function(): Promise<void> {
			let markdown = "| Header 1 | Header 2 |\n| --- | --- |\n| value 1 | value 2 |";
			await API.Card.update(
				roundTripCard.cardId,
				{ detailedDescription: markdown },
				API.user,
				organizationId,
				undefined,
				"markdown",
			);

			let card = await API.Card.get(roundTripCard.cardId, API.user, organizationId, null, { descriptionFormat: "markdown" });
			assert.ok(card.detailedDescription.includes("| Header 1 | Header 2 |"));
			assert.ok(card.detailedDescription.includes("| --- | --- |") || card.detailedDescription.includes("|---|---|"));
			assert.ok(card.detailedDescription.includes("| value 1 | value 2 |") || card.detailedDescription.includes("|value 1|value 2|"));
		});
```

- [ ] **Step 2: Run the focused tests to verify they fail**

Run:

```bash
MOCHA_GREP="markdownToDocument - tables" ./startdebug_unittest.sh --once
```

Expected: FAIL because imported header cells are not bold and export still writes a synthetic empty header row.

Run:

```bash
/bin/zsh -lc 'cd Test && ./test.sh -g "API Cards.*table headers|API Cards.*Markdown round-trip"'
```

Expected: FAIL on the new API header-round-trip assertion.

- [ ] **Step 3: Implement the header heuristic in `favro_markdown.ts`**

In `normalizeTableTokens()` inside `MainApp/lib/collaboration/server/favro_markdown.ts`, track whether the current cell came from `th` and wrap inline children in `strong_open` / `strong_close` so header cells import as bold:

```typescript
function cloneToken(token: MarkdownIt.Token): MarkdownIt.Token {
	return Object.assign(Object.create(Object.getPrototypeOf(token)), token);
}

function createInlineMarkToken(token: MarkdownIt.Token, type: "strong_open" | "strong_close", nesting: 1 | -1): MarkdownIt.Token {
	let cloned = cloneToken(token);
	cloned.type = type;
	cloned.tag = "strong";
	cloned.nesting = nesting;
	cloned.content = "";
	cloned.children = null;
	return cloned;
}

function normalizeTableTokens(tokens: MarkdownIt.Token[]): MarkdownIt.Token[] {
	let result: MarkdownIt.Token[] = [];
	let insideTd = false;
	let insideHeaderCell = false;

	for (let token of tokens) {
		if (token.type === "thead_open" || token.type === "thead_close" ||
			token.type === "tbody_open" || token.type === "tbody_close")
			continue;

		if (token.type === "th_open" || token.type === "td_open") {
			let cloned = cloneToken(token);
			cloned.type = "td_open";
			cloned.tag = "td";
			result.push(cloned);
			insideTd = true;
			insideHeaderCell = token.type === "th_open";
		} else if (token.type === "th_close" || token.type === "td_close") {
			let cloned = cloneToken(token);
			cloned.type = "td_close";
			cloned.tag = "td";
			result.push(cloned);
			insideTd = false;
			insideHeaderCell = false;
		} else if (insideTd && token.type === "inline") {
			let inlineToken = cloneToken(token);
			if (insideHeaderCell && inlineToken.children)
				inlineToken.children = [createInlineMarkToken(token, "strong_open", 1), ...inlineToken.children, createInlineMarkToken(token, "strong_close", -1)];

			let pOpen = cloneToken(token);
			pOpen.type = "paragraph_open";
			pOpen.tag = "p";
			pOpen.nesting = 1;
			pOpen.content = "";
			pOpen.children = null;
			result.push(pOpen);
			result.push(inlineToken);
			let pClose = cloneToken(token);
			pClose.type = "paragraph_close";
			pClose.tag = "p";
			pClose.nesting = -1;
			pClose.content = "";
			pClose.children = null;
			result.push(pClose);
		} else {
			result.push(token);
		}
	}

	return result;
}
```

Then update the table serializer in the same file with explicit helpers:

```typescript
function isBoldOnlyTableCell(cell: ProseMirrorModel.Node): boolean {
	if (cell.childCount !== 1)
		return false;

	let paragraph = cell.firstChild;
	if (paragraph.type !== ProseMirrorShared.schema.nodes.paragraph || paragraph.childCount !== 1)
		return false;

	let textNode = paragraph.firstChild;
	return textNode.isText && textNode.marks.length === 1 && textNode.marks[0].type === ProseMirrorShared.schema.marks.bold;
}

function isBoldOnlyHeaderRow(row: ProseMirrorModel.Node): boolean {
	if (row.childCount === 0)
		return false;

	for (let i = 0; i < row.childCount; i++) {
		if (!isBoldOnlyTableCell(row.child(i)))
			return false;
	}

	return true;
}

function writeTableSeparator(state: FavroMarkdownSerializerState, columnCount: number): void {
	state.write("| " + Array(columnCount).fill("---").join(" | ") + " |\n");
}

	table: function(state: FavroMarkdownSerializerState, node: ProseMirrorModel.Node): void {
		let firstRow = node.firstChild as ProseMirrorModel.Node;
		let useHeaderRow = !!firstRow && isBoldOnlyHeaderRow(firstRow);

		state.options.inTable = true;

		if (useHeaderRow) {
			state.render(firstRow, node, 0);
			writeTableSeparator(state, firstRow.childCount);
			for (let i = 1; i < node.childCount; i++)
				state.render(node.child(i), node, i);
		} else {
			state.write("|" + state.repeat("|", firstRow.content.childCount) + "\n");
			state.write("|" + state.repeat("-|", firstRow.content.childCount) + "\n");
			state.renderContent(node);
		}

		delete state.options.inTable;
	},
```

- [ ] **Step 4: Run the unit and API tests to verify header behavior**

Run:

```bash
MOCHA_GREP="markdownToDocument - tables" ./startdebug_unittest.sh --once
```

Expected: PASS, including new import/export header cases.

Run:

```bash
/bin/zsh -lc 'cd Test && ./test.sh -g "API Cards.*Markdown round-trip"'
```

Expected: PASS, including the new table-header round-trip assertion.

- [ ] **Step 5: Commit**

```bash
git add MainApp/lib/collaboration/server/favro_markdown.ts MainApp/lib/collaboration/server/unittests/favro_markdown.app-test.ts Test/src/api/apitest_cards.ts
git commit -m "feat: add markdown table header heuristic"
```

---

### Task 5: Refresh Repo-Local Docs And Run Final Verification

**Files:**
- Modify: `/Users/vu/.assistant-preferences/local-docs/Favro/knowledge-references/markdown-card-description-current-behavior.md`
- Review: `/Users/vu/.assistant-preferences/local-docs/Favro/knowledge-references/2026-03-30-markdown-compat-master-vs-branch-summary-matrix.md`
- Review: `/Users/vu/.assistant-preferences/local-docs/Favro/knowledge-references/2026-03-30-markdown-compat-branch-progress-report.md`

- [ ] **Step 1: Update the repo-local behavior note**

Update `/Users/vu/.assistant-preferences/local-docs/Favro/knowledge-references/markdown-card-description-current-behavior.md` so it matches the implemented phase 1 behavior. Make these concrete edits:

```markdown
- `POST` and `PUT` with `descriptionFormat=markdown` build the base document from markdown first.
- If `tasklists` / `addTasklists` are also supplied, they are appended afterwards at the end of the document.
- Task list names render as bold text on export but are not part of the guaranteed round-trip metadata contract.
- Legacy compact `-[ ]` paragraph syntax is not treated as supported markdown checklist input.
- Existing lookalike content is escaped on markdown export so GET/PUT round-trip does not silently reinterpret it as checklist state.
- Table headers use a bold-text heuristic rather than a dedicated schema type.
```

- [ ] **Step 2: Run the focused verification commands**

Run:

```bash
make typecheck-MainApp
```

Expected: PASS.

Run:

```bash
MOCHA_GREP="favro_markdown" ./startdebug_unittest.sh --once
```

Expected: PASS.

Run after the user has started `./startdebug_test.sh`:

```bash
/bin/zsh -lc 'cd Test && ./test.sh -g "API Cards.*Markdown round-trip"'
```

Expected: PASS.

- [ ] **Step 3: Run the full repo check**

Run:

```bash
make check
```

Expected: PASS.

- [ ] **Step 4: Review the summary docs for drift**

Open these docs and update only if they now misstate the implementation:

```text
/Users/vu/.assistant-preferences/local-docs/Favro/knowledge-references/2026-03-30-markdown-compat-master-vs-branch-summary-matrix.md
/Users/vu/.assistant-preferences/local-docs/Favro/knowledge-references/2026-03-30-markdown-compat-branch-progress-report.md
```

Specific drift to remove if still present:

- markdown ignores `tasklists`
- legacy `-[ ]` remains supported API checklist input
- tables have no usable header heuristic

- [ ] **Step 5: Commit**

```bash
git add /Users/vu/.assistant-preferences/local-docs/Favro/knowledge-references/markdown-card-description-current-behavior.md /Users/vu/.assistant-preferences/local-docs/Favro/knowledge-references/2026-03-30-markdown-compat-master-vs-branch-summary-matrix.md /Users/vu/.assistant-preferences/local-docs/Favro/knowledge-references/2026-03-30-markdown-compat-branch-progress-report.md
git commit -m "docs: align markdown compatibility notes with reconciled phase 1 behavior"
```

---

## Self-Review

### Spec Coverage

- Decision 2 and Decision 3 are covered by Task 1 and Task 2.
- Decision 5 is covered by Task 3.
- Decision 4 is covered by Task 4.
- Decision 1 is reflected in Task 1 assertions, Task 2 API behavior, and Task 5 doc wording.

No phase 1 reconciliation requirement is left without an implementation task.

### Placeholder Scan

No `TODO`, `TBD`, or “write tests later” placeholders remain. Each task includes exact files, code blocks, commands, and expected outcomes.

### Type Consistency

- The new export helper is consistently named `prepareDocForMarkdownRoundTrip`.
- The sequencing flag is consistently named `shouldAppendTasklistsAfterMarkdown`.
- Table-header helpers use `isBoldOnlyTableCell` and `isBoldOnlyHeaderRow` consistently.
