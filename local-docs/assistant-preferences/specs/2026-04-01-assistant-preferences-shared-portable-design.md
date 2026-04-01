# Assistant Preferences Shared Portable Repo Design

**Date:** 2026-04-01
**Status:** Proposed design for planning only. No implementation or migration work performed yet.

## Goal

Turn `assistant-preferences` into a shareable git-backed project that:

- works across multiple machines and users
- keeps `~/.assistant-preferences` as the stable runtime path
- avoids tracked machine-specific paths and secrets
- supports `Codex` and `Claude` independently
- requires minimal change to the current machine

## Problem Statement

The current setup is optimized for one machine and one user:

- the project lives directly at `~/.assistant-preferences`
- several scripts and tests contain `/Users/vu/...` assumptions
- `preferences.json` mixes general preferences with Favro/work-only machine-local rules
- the repo structure is not yet designed for reuse by another machine or another person

The target is not “git for its own sake.” The target is a portable shared base plus safe local customization.

## Scope

### In Scope

- shared git repository structure
- stable runtime path via symlink or installer-managed home-folder path
- tracked shared profiles `minimal` and `personal`
- one untracked local machine file
- auto-detection of `Codex` and `Claude`
- removing hard-coded machine paths from scripts and tests
- README-driven setup for another user

### Out Of Scope

- public/open-source packaging standards
- support for assistants beyond `Codex` and `Claude`
- multi-profile switching CLI
- cloud sync for secrets or local overlays
- migrating Favro/work data into tracked files

## Key Decisions

### 1. Real Repo Location Vs Runtime Location

- The real repository can live in any checkout location chosen by the user.
- The stable runtime path remains `~/.assistant-preferences`.
- Bootstrap creates `~/.assistant-preferences` as a symlink to the chosen checkout.

Reasoning:

- preserves the current runtime path used by scripts and assistants
- minimizes change on the current machine
- lets another user clone anywhere they want

### 2. Shared Profiles

The tracked repo contains:

- a shared base file: `preferences.json`
- `profiles/minimal.json`
- `profiles/personal.json`

Meaning:

- `preferences.json` contains generic rules and policy that should apply for all users
- `profiles/minimal.json` contains the smallest useful starter profile
- `profiles/personal.json` contains the initial non-Favro subset of the current preferences

### 3. Local Machine File

One untracked machine-local file holds all machine-specific state:

- selected shared profile
- secrets
- machine paths
- work-only preferences
- local-only preference additions or overrides

Chosen filename:

- `preferences.local.json`

Chosen structure:

```json
{
  "selectedProfile": "personal",
  "preferences": {
    "hard": [],
    "conditional": [],
    "repeatableActions": [],
    "conflictResolutions": []
  }
}
```

### 4. Merge Order

Effective preferences are built in this order:

1. `preferences.json`
2. selected tracked profile from `profiles/<name>.json`
3. `preferences.local.json`

Within each preference category, items merge by `id`:

- if an `id` appears only once, include it
- if the same `id` appears in a later layer, the later layer replaces the earlier entry

This keeps overlays predictable and lets a local machine replace a tracked shared rule without editing tracked files.

### 5. Supported Assistant Targets

First version supports:

- `Codex`
- `Claude`

Both are optional on a machine.

Detection model:

- if `~/.codex` exists, treat `Codex` as installed
- if `~/.claude` exists, treat `Claude` as installed
- configure only the detected targets

Effects:

- render `Codex` output only when `~/.codex` exists
- render `Claude` output only when `~/.claude` exists
- create skill symlinks only for detected targets

Codex note:

- installation is detected via `~/.codex`
- the shared skill is still linked into `~/.agents/skills` because that is the Codex-discovered skill location in the current setup

### 6. Bootstrap Safety

Bootstrap is conservative:

- if `~/.assistant-preferences` does not exist, create the symlink
- if it already points to the current checkout, reuse it
- if it exists as a different path or a real directory, refuse to overwrite it

This protects existing setups and keeps migration explicit.

## Target Repository Layout

```text
/path/to/assistant-preferences/
├── .gitignore
├── preferences.json
├── preferences.local.example.json
├── profiles/
│   ├── minimal.json
│   └── personal.json
├── README.md
├── scripts/
│   ├── bootstrap-machine.sh
│   ├── link-skills.sh
│   ├── memorize-preference.mjs
│   ├── render-preferences.mjs
│   ├── seed-from-existing-instructions.mjs
│   └── lib/
│       └── project-paths.mjs
├── skills/
│   └── personal-preferences/
│       └── SKILL.md
├── tests/
│   ├── helpers/
│   │   └── test-paths.mjs
│   ├── memorize-preference.test.mjs
│   ├── preferences-schema.test.mjs
│   ├── render-preferences.test.mjs
│   └── seed-from-existing-instructions.test.mjs
└── local-docs/                     # untracked
```

## File Responsibilities

### `preferences.json`

- shared generic defaults and policy
- no secrets
- no machine paths
- no work-project rules

### `profiles/minimal.json`

- very small starter preference set
- useful for a new user who wants minimal opinionated behavior

### `profiles/personal.json`

- initial richer profile derived from the current non-Favro preferences
- still user-agnostic enough to be shareable

### `preferences.local.example.json`

- documents the local file schema
- shows `selectedProfile: "personal"` as the default example
- contains no real secrets or machine paths

### `preferences.local.json`

- untracked
- machine-specific
- the only place where work-only/Favro rules belong on the current machine

### `scripts/bootstrap-machine.sh`

- makes `~/.assistant-preferences` point at the current checkout
- creates `preferences.local.json` from the example if missing
- runs skill linking
- never silently replaces an unrelated existing setup

### `scripts/render-preferences.mjs`

- loads merged preferences
- auto-detects supported assistant homes
- writes only for detected targets

### `scripts/link-skills.sh`

- links the shared skill to detected assistant skill locations
- uses `$HOME` and repo-relative paths only
- documents why Codex detection uses `~/.codex` while the Codex skill symlink target lives under `~/.agents/skills`

### `scripts/memorize-preference.mjs`

- writes into the effective local machine file by default
- does not mutate tracked shared profiles unless explicitly extended in a future design

### `scripts/seed-from-existing-instructions.mjs`

- validates the tracked shared defaults/profile seed, not machine-specific local data

## Merge Model Details

The loader should normalize missing sections so every merged result has:

```json
{
  "preferences": {
    "hard": [],
    "conditional": [],
    "repeatableActions": [],
    "conflictResolutions": []
  }
}
```

Recommended helper behavior:

- derive repo root inside the helper from the helper module’s own `import.meta.url`
- derive home directory from `$HOME` unless a CLI flag overrides it
- load base file, then selected profile, then local file
- merge arrays by `id`
- return a fresh merged object instead of mutating any loaded layer in place
- fail clearly if `selectedProfile` names a missing tracked profile

## Initial Migration Rules For Current Data

### Move Into `profiles/personal.json`

- current non-Favro reusable preferences
- current generic workflow/test/review preferences

### Keep In Shared Base `preferences.json`

- contradiction policy rules
- generic policy metadata
- only the lowest-common-denominator shared defaults

### Move Into `preferences.local.json`

- Favro/work-only rules
- machine-local docs paths
- any machine-specific command or path
- any secret

## README Expectations

The README should explain:

- what the repo is for
- difference between shared tracked files and the untracked local file
- clone-anywhere plus stable runtime symlink model
- bootstrap steps
- how to choose `minimal` vs `personal`
- how to add local-only rules safely
- that Favro/work-only rules must stay local

## Risks

- if merge precedence is unclear, users will accidentally shadow tracked rules in confusing ways
- if bootstrap is destructive, existing setups can be broken
- if `personal` contains your private or work-specific assumptions, the repo stops being shareable immediately
- if `memorize-preference` writes to tracked files by default, users can accidentally commit local state

## Recommended Implementation Order

1. Introduce tracked profiles and local file schema
2. Implement loader/merge behavior
3. Refactor renderer/linker/bootstrap around repo-relative paths and auto-detection
4. Refactor tests to be checkout-relative
5. Rewrite README around the new model
6. Migrate current data into base/profile/local buckets

## Success Criteria

- a user can clone the repo anywhere and bootstrap it into `~/.assistant-preferences`
- the repo contains no tracked secrets, Favro rules, or hard-coded `/Users/vu/...` paths
- a machine with only `Codex`, only `Claude`, or both works without manual script edits
- local machine configuration stays untracked
- your current machine can adopt the new repo with minimal runtime-path disruption
