#!/bin/zsh
set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${0:A}")" && pwd)"
repo_root="$(cd -- "$script_dir/.." && pwd)"
skill_source="$repo_root/skills/personal-preferences"

if [ -d "$HOME/.codex" ]; then
	# Codex is detected via ~/.codex, but the shared skill is discovered from ~/.agents/skills.
	mkdir -p "$HOME/.agents/skills"
	ln -sfn "$skill_source" "$HOME/.agents/skills/personal-preferences"
fi

if [ -d "$HOME/.claude" ]; then
	mkdir -p "$HOME/.claude/skills"
	ln -sfn "$skill_source" "$HOME/.claude/skills/personal-preferences"
fi
