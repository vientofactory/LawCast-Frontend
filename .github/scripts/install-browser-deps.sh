#!/usr/bin/env bash
set -euo pipefail

if [[ $# -eq 0 ]]; then
  echo 'At least one supported browser is required' >&2
  exit 2
fi
for browser in "$@"; do
  case "$browser" in
    chromium|firefox|webkit) ;;
    *) echo 'Unsupported browser argument' >&2; exit 2 ;;
  esac
done

: "${RUNNER_TEMP:?RUNNER_TEMP must identify the runner temporary directory}"
if [[ "$RUNNER_TEMP" != /* || "$RUNNER_TEMP" == *\"* || "$RUNNER_TEMP" == *\\* || "$RUNNER_TEMP" == *$'\n'* ]]; then
  echo 'RUNNER_TEMP must be an absolute path without APT configuration delimiters' >&2
  exit 2
fi

cache_dir="$RUNNER_TEMP/lawcast-apt-archives"
mkdir -p "$cache_dir"
apt_config=$(mktemp "$RUNNER_TEMP/lawcast-apt.XXXXXX")
trap 'rm -f "$apt_config"' EXIT
printf 'Dir::Cache::archives "%s";\nAPT::Keep-Downloaded-Packages "true";\nBinary::apt-get::APT::Keep-Downloaded-Packages "true";\n' "$cache_dir" > "$apt_config"

# Cache signed package downloads, not installed libraries or the dpkg database.
# Running the dependency installer as root preserves APT_CONFIG in its apt children.
sudo env "PATH=$PATH" "APT_CONFIG=$apt_config" npx --no-install playwright install-deps "$@"
sudo chown -R "$(id -u):$(id -g)" "$cache_dir"
shopt -s nullglob
archives=("$cache_dir"/*.deb)
printf 'APT package archives retained: %s\n' "${#archives[@]}"
