# Architecture

## Repository Model

- Shared tracked base: `preferences.json`
- Shared tracked profiles: `profiles/minimal.json`, `profiles/personal.json`
- Untracked machine-local file: `preferences.local.json`
- Stable runtime path: `~/.assistant-preferences`
- Real repository location: any user-chosen checkout path

## File Structure

```
/path/to/assistant-preferences/
├── preferences.json                          # Shared base (policy and defaults)
├── preferences.local.example.json            # Template for the local machine file
├── profiles/
│   ├── minimal.json                          # Smallest useful starter profile
│   └── personal.json                         # Richer reusable profile
├── scripts/
│   ├── bootstrap-machine.sh                  # Set up symlink, local file, skill links
│   ├── link-skills.sh                        # Create symlinks for skill discovery
│   ├── memorize-preference.mjs               # Add/replace preferences (auto-renders after)
│   ├── render-preferences.mjs                # Render sentinel section into instruction files
│   ├── seed-from-existing-instructions.mjs   # Validate all expected rules are present
│   └── lib/
│       └── project-paths.mjs                 # Shared path helpers and merge logic
├── skills/
│   └── personal-preferences/
│       └── SKILL.md                          # Shared skill for preference handling
└── tests/
    ├── helpers/
    │   └── test-paths.mjs
    ├── bootstrap-machine.test.mjs
    ├── memorize-preference.test.mjs
    ├── preferences-schema.test.mjs
    ├── render-preferences.test.mjs
    └── seed-from-existing-instructions.test.mjs
```

## Merge Order

Effective preferences are built by merging three layers:

1. `preferences.json` (shared base)
2. Selected profile from `profiles/<name>.json`
3. `preferences.local.json` (machine-local overrides)

Within each preference category, items merge by `id`. If the same `id` appears in a later layer, it replaces the earlier entry.

## Rendering

The renderer writes only between sentinel markers in each instruction file:

```
<!-- BEGIN PERSONAL-PREFERENCES (generated — do not edit manually) -->
...generated policy and rules...
<!-- END PERSONAL-PREFERENCES -->
```

Content outside the markers is never touched. If markers don't exist yet, they're appended at the end.

The renderer auto-detects which assistants are installed:

- If `~/.codex` exists, writes to `~/.codex/instructions.md`
- If `~/.claude` exists, writes to `~/.claude/CLAUDE.md`

## Memorization

The `memorize-preference.mjs` script appends a new preference entry to `preferences.local.json` (the machine-local file) and automatically re-renders instruction files. The assistant invokes this after the user confirms a new preference.

## Customization

Edit `preferences.local.json` to add machine-specific rules. Example:

```json
{
  "selectedProfile": "personal",
  "preferences": {
    "conditional": [
      {
        "id": "favro-local-generated-docs-root",
        "category": "documentation_workflow",
        "scope": "repo:Favro",
        "appliesWhen": [
          "repo-favro",
          "local-generated-docs-relevant"
        ],
        "rule": "For Favro work, use ~/.assistant-preferences/local-docs/Favro/ as the machine-local docs root for generated non-committed documents.",
        "source": "local-machine",
        "createdAt": "2026-04-01T00:00:00.000Z"
      }
    ]
  }
}
```

Important:

- Secrets must never be committed to tracked files
- Work-specific rules must stay in `preferences.local.json`
- Users can customize beyond `minimal` and `personal` by editing the local file

## Data Model

Preferences are categorized as:

- **hard** — always-on rules (e.g., "describe approach before coding")
- **conditional** — apply when specific conditions match (e.g., policy rules about contradiction handling)
- **repeatableActions** — default commands for common tasks (e.g., preferred typecheck command per repo)
- **conflictResolutions** — memorized decisions for when personal and project rules conflict in the same category

Each entry has an `id`, `category`, `scope` (`global`, `repo:<name>`, or `task:<slug>`), and for conditional/repeatable entries, `appliesWhen` tags that the assistant evaluates at runtime.

## Tech Stack

- Node.js built-in modules only (no dependencies)
- JSON for the canonical store
- Markdown for rendered output and skill definition
- Shell symlinks for cross-platform skill discovery
