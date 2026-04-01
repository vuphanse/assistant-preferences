# Semantic Commit Cleanup Strategy

**Date:** 2026-04-01

**Purpose:** Reusable guidance for cleaning up branch history before a pull request while preserving all intended branch content.

## Goal

Optimize branch history for human review, not for the smallest possible commit count.

The target outcome is:

- each final commit has one clear purpose
- each final commit is independently understandable from its message and diff
- each final commit is internally complete, including the implementation and the tests needed to review it
- the rewritten branch preserves all intended code and docs from a protected backup reference

## Core Principles

### 1. Semantic reviewability first

The right question is not "which commits should be squashed?".

The right question is "what are the meaningful review units this branch should present to another engineer?".

### 2. Commit count is a secondary effect

If two commits only make sense together, merge them.

If a commit is already a clean review unit, keep it separate even if that means the branch keeps more commits.

### 3. No code loss relative to backup

Before rewriting history, create a backup branch or tag.

That backup is the preservation baseline. History may change. Intended branch content must not disappear unless there is an explicit decision to drop it.

### 4. Fixups do not deserve permanent history

Follow-up commits that only repair the immediately preceding work should usually be folded into the commit that introduced the behavior.

Examples:

- assertion-only fixes
- type-only fixes caused by the same feature work
- cleanup of a no-op helper introduced by the same change
- indentation or formatting repairs inside the same review unit

### 5. Mixed commits should be split

If a commit changes two unrelated review units, it should be split during history cleanup.

This is especially important for:

- test commits that cover multiple features
- cleanup commits that touch unrelated areas
- commits whose subject line already contains "and"

## Reusable Workflow

### Step 1. Protect the current branch state

Create a backup reference before any history rewrite.

Recommended forms:

- backup branch
- backup tag

Keep the backup until the pull request is merged.

### Step 2. Use the real PR base

Classify commits against the branch that reviewers will compare against, usually `origin/master`, not a stale local `master`.

### Step 3. Define target review units

Before rebasing, write down the intended final commit story.

Each target commit should answer:

- what behavior or concern does this commit change?
- what tests belong with that behavior?
- can a reviewer understand and validate it in isolation?

### Step 4. Classify current commits

For each current commit, decide one of these outcomes:

- keep as-is
- fold into an earlier or later semantic commit
- split into multiple semantic commits
- keep as docs-only

Default rule: do not drop content unless there is an explicit decision to remove it.

### Step 5. Rewrite history to match the story

Use interactive rebase to:

- reorder commits by logical dependency
- fold fixups into the semantic commit they belong to
- split mixed commits
- eliminate raw `[wip]` commits as permanent history

### Step 6. Prove preservation against the backup

Do not rely on visual confidence alone.

Use a preservation check after rewriting:

- inspect `git diff` between backup and rewritten branch
- inspect `git range-diff` from PR base to backup vs PR base to rewritten branch
- run relevant tests

If there are differences, classify them explicitly:

- expected history-only rewrite
- intended content change
- accidental content loss

Do not push until accidental content loss is ruled out.

### Step 7. Push safely

If the branch was already pushed, use `git push --force-with-lease`.

Do not use plain force-push.

## Decision Rules

### Keep commits separate when

- a reviewer can validate one without needing the other
- one commit changes product behavior and another changes docs or supporting rationale
- one commit is a compatibility contract change that deserves its own review focus
- separating them reduces the chance that a reviewer misses a risky semantic change

### Fold commits together when

- one commit is an obvious fixup for another
- tests were added later but only validate that earlier change
- a helper or type adjustment only exists to support the same logical feature
- the later commit would be noise if reviewed on its own

### Split commits when

- one commit touches two distinct review units
- the commit subject describes more than one purpose
- parts of the commit belong to different final commit messages

## Safety Standard

"No code loss" means all intended content from the backup survives in the rewritten branch unless there is an explicit reviewed decision to remove something.

This standard requires:

- backup reference retained
- preservation diff checked
- `range-diff` checked
- tests rerun

## Branch-Specific Plan: `fav-162947`

**PR base:** `origin/master`

**Current branch shape:** 21 commits ahead of `origin/master`

**Recommended target shape:** 6 semantic commits

### Final Commit 1

**Suggested title:** `feat: support markdown checklist round-trip in Favro markdown`

**Purpose:**

- serialize Favro checklist items as standard markdown checkboxes
- parse standard markdown checkboxes back into Favro checklist nodes
- keep checklist-related unit coverage with the feature

**Current commits to fold here:**

- `8a69403b5e` `fix: serialize Favro checklists as standard - [ ] / - [x] markdown`
- `5fedc1f7ad` `feat: parse standard - [ ] / - [x] markdown as Favro checklist nodes`
- checklist round-trip / inline-mark coverage portion of `ae07b281e2`

**Reasoning:**

These changes form one reviewable behavior: checklist markdown round-trip support.

### Final Commit 2

**Suggested title:** `feat: support markdown table parsing and header heuristics`

**Purpose:**

- parse GFM tables into Favro table nodes
- normalize table cell structure for schema compatibility
- add the header import/export heuristic
- keep table-related tests and assertion updates with the table behavior

**Current commits to fold here:**

- `34136cc1be` `feat: parse GFM markdown tables into Favro table nodes`
- `1b5393bbad` `fix: wrap table cell inline content in paragraph tokens for prosemirror-markdown`
- `874b9456a3` `feat: add markdown table header heuristic`
- table-assertion portion of `4aa91228a2`
- table API assertion portion of `0629e85ac8`

**Reasoning:**

The table parser, table normalization, header heuristic, and related test corrections are one semantic review unit.

### Final Commit 3

**Suggested title:** `feat: use markdown as the source of truth for API PUT and POST descriptions`

**Purpose:**

- rebuild the card document from markdown for API markdown requests
- wire the markdown parser into API `POST` and `PUT`
- keep the API tests and helper fixes that are required to validate this behavior

**Current commits to fold here:**

- `2a672a1883` `feat: add recreateDocumentFromMarkdown for API markdown PUT/POST`
- `ee618fc4c3` `feat: use markdown parser for API PUT/POST when descriptionFormat=markdown`
- `6164540392` `fix: use undefined checks instead of falsy checks in test helpers for position and detailedDescription`
- `c1a44d518e` `fix: use undefined checks in test helpers for position and detailedDescription, clean up test cards`
- empty-markdown-POST test portion of `ae07b281e2`

**Reasoning:**

This is the main API contract change. The helper fixes and empty-markdown test are support work for that contract.

### Final Commit 4

**Suggested title:** `feat: append explicit API tasklists after markdown document rebuild`

**Purpose:**

- preserve compatibility when markdown description and explicit API task list payloads are sent together
- keep the contract tests with the behavior

**Current commits to fold here:**

- `5236b475a4` `test: lock markdown api tasklist append contract`
- `3b37548359` `feat: append api tasklists after markdown document rebuild`
- API conditional cleanup portion of `22a51eb907`

**Reasoning:**

This is a distinct API compatibility decision and is clearer as its own review unit instead of being buried inside the broader markdown API commit.

### Final Commit 5

**Suggested title:** `fix: preserve plain-text checklist lookalikes during markdown round-trip`

**Purpose:**

- prevent plain text that looks like checklist syntax from turning into real checklist structure on markdown round-trip
- use zero-width-space escaping that survives serializer behavior
- keep round-trip coverage with the fix

**Current commits to fold here:**

- `f97ab19d15` `fix: preserve lookalike checklist content during markdown round-trip`
- `84e4f8057e` `fix: replace nonexistent ProseMirrorModel.NodeJSON with inline interface`
- lookalike-escaping portion of `4aa91228a2`
- lookalike API assertion portion of `0629e85ac8`
- no-op helper removal portion of `22a51eb907`
- lookalike round-trip test portion of `ae07b281e2`

**Reasoning:**

This is a distinct correctness fix for ambiguous markdown-like content and should stay separate from the broader API and table changes.

### Final Commit 6

**Suggested title:** `docs: reconcile markdown compatibility phase 1 notes and implementation references`

**Purpose:**

- preserve the useful planning and reconciliation material from the branch
- remove raw `[wip]` framing from permanent history

**Current commits to fold here:**

- `d3a7374279` `[wip] Add design specs`
- `8783efb526` `[wip] specs reconciliation`
- `9ba00a465b` `docs: align markdown compatibility notes with reconciled phase 1 behavior`
- `97991a4ae7` `[wip] Add markdown API phase 1 reconciliation plan [ci-skip]`

**Reasoning:**

These docs are reviewable as one documentation/reference update. The content should remain if it is part of the branch deliverable, but the `[wip]` commits should not survive as-is.

## Commits That Must Be Split During Rebase

### `4aa91228a2`

This commit mixes:

- the real lookalike-escaping fix
- table-header assertion adjustments

Split it so table assertion changes land in Final Commit 2 and escaping behavior lands in Final Commit 5.

### `22a51eb907`

This commit mixes:

- removal of the no-op `prepareDocForMarkdownRoundTrip(...)` helper path
- API tasklist conditional simplification
- test indentation cleanup

Split it so:

- the API conditional cleanup lands in Final Commit 4
- the no-op helper removal lands in Final Commit 5
- indentation cleanup follows whichever split chunk it belongs to

### `ae07b281e2`

This commit mixes:

- checklist inline-mark round-trip coverage
- plain-text lookalike round-trip coverage
- empty markdown `POST` coverage

Split it so:

- checklist-mark coverage lands in Final Commit 1
- empty-markdown `POST` coverage lands in Final Commit 3
- lookalike round-trip coverage lands in Final Commit 5

## Execution Notes For The Future Cleanup

When executing this cleanup, the safest sequence is:

1. create a backup branch or tag from current `fav-162947`
2. start an interactive rebase from the merge-base with `origin/master`
3. reorder commits into the six semantic review units above
4. mark mixed commits for `edit` and split them
5. fold fixups into their final semantic commit
6. compare the rewritten branch to the backup with diff and `range-diff`
7. rerun the relevant tests
8. push with `--force-with-lease` only after preservation is confirmed

## Short Name For This Workflow

**Semantic rebase with preservation proof**
