#!/usr/bin/env bash
set -Eeuo pipefail

repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

debug_build=false
if [[ "${1:-}" == "--debug" ]]; then
  debug_build=true
elif [[ $# -gt 0 ]]; then
  echo "Usage: $0 [--debug]" >&2
  exit 2
fi

if ! command -v pnpm >/dev/null 2>&1; then
  echo "Error: pnpm is required. Install Node.js and pnpm first." >&2
  exit 1
fi

build_args=(tauri build)
profile=release
if $debug_build; then
  build_args+=(--debug)
  profile=debug
fi

echo "==> Build: pnpm ${build_args[*]}"
pnpm "${build_args[@]}"

bundle_dir="$repo_root/src-tauri/target/$profile/bundle/nsis"
shopt -s nullglob
installers=("$bundle_dir"/*-setup.exe)
shopt -u nullglob
if [[ ${#installers[@]} -eq 0 ]]; then
  echo "Error: no NSIS installer found in $bundle_dir" >&2
  exit 1
fi

installer="${installers[0]}"
for candidate in "${installers[@]:1}"; do
  if [[ "$candidate" -nt "$installer" ]]; then
    installer="$candidate"
  fi
done

version="$(node -p "require('./src-tauri/tauri.conf.json').version")"
timestamp="$(date +%Y%m%d-%H%M%S)"
snapshot_dir="$repo_root/.local-cicd/releases/$version-$timestamp"
mkdir -p "$snapshot_dir"
snapshot_installer="$snapshot_dir/$(basename -- "$installer")"
cp -- "$installer" "$snapshot_installer"

echo "==> Deploy: silent install $snapshot_installer //S"
# Git Bash/MSYS can rewrite slash-prefixed arguments unless path conversion is disabled.
MSYS_NO_PATHCONV=1 "$snapshot_installer" //S

echo "Deployment complete. Installer snapshot: $snapshot_installer"
