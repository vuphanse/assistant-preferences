# Assistant Preferences

A portable, git-backed personal preferences system that works across multiple AI coding assistants (Claude Code and Codex). It maintains one canonical preference store with shared profiles and per-machine local overrides, and renders a managed section into each assistant's instruction file.

## Installation

```bash
git clone <your-repo-url> /path/to/assistant-preferences
cd /path/to/assistant-preferences
./scripts/bootstrap-machine.sh
node ./scripts/render-preferences.mjs
```

Bootstrap will:

1. Create `~/.assistant-preferences` as a symlink to the current checkout
2. Copy `preferences.local.example.json` to `preferences.local.json` if missing
3. Symlink the shared skill into detected assistant skill directories

The default selected profile is `personal`.

## Running Tests

```bash
node --test tests/*.test.mjs
```

## License

MIT
