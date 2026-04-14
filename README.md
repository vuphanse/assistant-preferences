# ai-pref-nsync

A portable, git-backed personal preferences system that works across multiple AI coding assistants (Claude Code and Codex). It maintains one canonical preference store with shared profiles and per-machine local overrides, and renders a managed section into each assistant's instruction file.

## What It Does

AI coding assistants like Claude Code and Codex read instruction files (`CLAUDE.md`, `~/.codex/instructions.md`) to shape their behavior. This project lets you manage those instructions as structured data — versioned in git, composable across machines, and editable without touching the instruction files directly.

The core workflow:

1. **Define preferences** in JSON (shared base, reusable profiles, machine-local overrides)
2. **Render them** into each assistant's instruction file via a sentinel block
3. **Memorize new preferences** through a script that appends to the local store and re-renders automatically

Preferences come in four types:
- **hard** — always-on rules (e.g., "describe approach before coding")
- **conditional** — rules that apply only when specific conditions match (e.g., a docs-path rule when working on a particular repo)
- **repeatableActions** — default commands for common tasks per repo
- **conflictResolutions** — memorized decisions for when personal and project rules conflict

### Concrete Example

Say you always want the assistant to write a failing test before fixing a bug, and you work across two machines. You add this to `profiles/personal.json`:

```json
{
  "id": "reproduce-bug-with-test",
  "category": "debugging",
  "scope": "global",
  "rule": "When there is a bug, start by writing a test that reproduces it, then fix it until the test passes.",
  "source": "shared-profile"
}
```

Run `node ./scripts/render-preferences.mjs` and the assistant's instruction file gets a generated block like:

```markdown
<!-- BEGIN PERSONAL-PREFERENCES (generated — do not edit manually) -->
...
- When there is a bug, start by writing a test that reproduces it, then fix it until the test passes.
...
<!-- END PERSONAL-PREFERENCES -->
```

On your work laptop, you also want a machine-specific rule pointing generated docs to a local path only that machine knows about. Add it to `preferences.local.json` (git-ignored) and re-render — it merges in on top of the shared profile without touching the git-tracked files.

When the assistant observes you giving the same correction repeatedly, it can invoke `memorize-preference.mjs` to append a new entry to your local store and re-render immediately, so you never have to repeat yourself.

## Installation

```bash
git clone <your-repo-url> /path/to/ai-pref-nsync
cd /path/to/ai-pref-nsync
./scripts/bootstrap-machine.sh
node ./scripts/render-preferences.mjs
```

Bootstrap will:

1. Create `~/.ai-pref-nsync` as a symlink to the current checkout
2. Copy `preferences.local.example.json` to `preferences.local.json` if missing
3. Symlink the shared skill into detected assistant skill directories

The default selected profile is `personal`.

## Running Tests

```bash
node --test tests/*.test.mjs
```

## License

MIT
