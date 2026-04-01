#!/bin/zsh
set -euo pipefail

mkdir -p /Users/vu/.agents/skills
mkdir -p /Users/vu/.claude/skills

ln -sfn /Users/vu/.assistant-preferences/skills/personal-preferences /Users/vu/.agents/skills/personal-preferences
ln -sfn /Users/vu/.assistant-preferences/skills/personal-preferences /Users/vu/.claude/skills/personal-preferences
