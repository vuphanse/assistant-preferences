---
name: personal-preferences
description: Use when applying user-specific workflow preferences, handling contradictions with project or plugin rules, or deciding whether to memorize repeatable feedback
---

# Personal Preferences

## Priority

- Apply personal preferences first when relevant.
- If there is no contradiction, apply both the personal preference and the project or skill rule.
- Define contradiction at the category level, not globally.
- If there is a contradiction with project, plugin, or skill instructions in the same category, ask the user before acting.
- If an applicable preference or conflict resolution is already memorized, apply it without asking again.
- Never override system or platform safety rules.

## Memorization Workflow

1. Detect whether the user's feedback is durable and reusable.
2. Rewrite it as a generalized rule with category and scope.
3. Ask for confirmation before memorizing.
4. After confirmation, persist it in the canonical preference store and rerender generated files.

## Conflict Resolution

1. Detect contradictions only within the active category.
2. Before asking, check whether a memorized conflict resolution already matches the current category and `appliesWhen` conditions.
3. If one matches, apply its `chosenSide` without asking again.
4. If none matches, ask the user which side should win.
5. If the answer appears reusable, ask whether to memorize it with an optional rationale.

## Examples

### Non-contradiction (apply both)
- Personal preference: extract repeated code in review comments
- Project rule: use tabs in TypeScript
- These are in different categories — no contradiction. Apply both.

### Contradiction (ask before acting)
- Personal preference: break repetition into helpers (category: `code_review`)
- Project rule: keep logic inline in this subsystem (category: `code_review`)
- Same category, conflicting direction. Ask the user which rule should govern.

### Memorized contradiction resolution (apply without asking)
- Category: `code_review`
- The same kind of conflict has already been memorized with matching `appliesWhen` conditions
- Apply the memorized `chosenSide` without asking again.

## Important

- Do not repeatedly ask for the same already-memorized preference.
- Check for an existing memorized category-level conflict resolution before asking the user.
