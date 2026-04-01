# Assistant Preferences

A machine-local personal preferences system that works across multiple AI coding assistants (Claude Code and Codex). It maintains one canonical preference store and renders a managed section into each assistant's instruction file.

## Background

Both Claude Code (`~/.claude/CLAUDE.md`) and Codex (`~/.codex/instructions.md`) support global instruction files that shape assistant behavior. Maintaining identical rules across both files manually led to drift — typo differences, wording mismatches, and no way to handle contradictions with project-scoped rules.

This system was created to:

1. **Centralize** personal workflow preferences in a single canonical JSON store
2. **Render** a managed section into both instruction files via sentinel markers, preserving any non-preference content
3. **Handle contradictions** between personal preferences and project/plugin/skill rules at the category level, with memorized resolutions to avoid repeated prompting
4. **Memorize** new preferences incrementally through a CLI that the assistant invokes on your behalf after confirmation

## Architecture

```
~/.assistant-preferences/
├── preferences.json                          # Canonical preference store (source of truth)
├── scripts/
│   ├── memorize-preference.mjs               # Add/replace preferences (auto-renders after)
│   ├── render-preferences.mjs                # Render sentinel section into instruction files
│   ├── seed-from-existing-instructions.mjs   # Validate all expected rules are present
│   └── link-skills.sh                        # Create symlinks for skill discovery
├── skills/
│   └── personal-preferences/
│       └── SKILL.md                          # Shared skill for preference handling
├── tests/
│   ├── memorize-preference.test.mjs
│   ├── preferences-schema.test.mjs
│   ├── render-preferences.test.mjs
│   └── seed-from-existing-instructions.test.mjs
└── README.md
```

### How rendering works

The renderer writes only between sentinel markers in each instruction file:

```
<!-- BEGIN PERSONAL-PREFERENCES (generated — do not edit manually) -->
...generated policy and rules...
<!-- END PERSONAL-PREFERENCES -->
```

Content outside the markers is never touched. If markers don't exist yet, they're appended at the end.

### How memorization works

The `memorize-preference.mjs` script appends a new preference entry to `preferences.json` and automatically re-renders both instruction files. The assistant invokes this after the user confirms a new preference — no manual CLI work required.

### Symlinks

The shared `personal-preferences` skill is symlinked into both assistant skill directories so each platform discovers it through its native skill mechanism:

- `~/.agents/skills/personal-preferences` → `~/.assistant-preferences/skills/personal-preferences`
- `~/.claude/skills/personal-preferences` → `~/.assistant-preferences/skills/personal-preferences`

## Data model

Preferences are categorized as:

- **hard** — always-on rules (e.g., "describe approach before coding")
- **conditional** — apply when specific conditions match (e.g., policy rules about contradiction handling)
- **repeatableActions** — default commands for common tasks (e.g., preferred typecheck command per repo)
- **conflictResolutions** — memorized decisions for when personal and project rules conflict in the same category

Each entry has an `id`, `category`, `scope` (`global`, `repo:<name>`, or `task:<slug>`), and for conditional/repeatable entries, `appliesWhen` tags that the assistant evaluates at runtime.

## Running tests

```bash
node --test ~/.assistant-preferences/tests/*.test.mjs
```

## Tech stack

- Node.js built-in modules only (no dependencies)
- JSON for the canonical store
- Markdown for rendered output and skill definition
- Shell symlinks for cross-platform skill discovery
