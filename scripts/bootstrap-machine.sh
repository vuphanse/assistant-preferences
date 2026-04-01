#!/bin/zsh
set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${0:A}")" && pwd)"
repo_root="$(cd -- "$script_dir/.." && pwd)"
runtime_path="$HOME/.assistant-preferences"
example_path="$repo_root/preferences.local.example.json"
local_path="$repo_root/preferences.local.json"

if [ -L "$runtime_path" ]; then
	current_target="$(readlink "$runtime_path")"
	if [ "$current_target" != "$repo_root" ]; then
		echo "Refusing to replace existing ~/.assistant-preferences symlink: $current_target" >&2
		exit 1
	fi
elif [ -e "$runtime_path" ]; then
	echo "Refusing to replace existing non-symlink path: $runtime_path" >&2
	exit 1
else
	ln -s "$repo_root" "$runtime_path"
fi

if [ ! -e "$local_path" ]; then
	cp "$example_path" "$local_path"
fi

"$repo_root/scripts/link-skills.sh"
echo "Bootstrap complete for $repo_root"
