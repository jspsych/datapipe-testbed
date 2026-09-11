#!/usr/bin/env bash
# Rebuild the committed plugin-pipe bundle from a local jspsych-contrib checkout.
#
#   scripts/refresh-plugin.sh [path-to-jspsych-contrib]
#
# Defaults to ../jspsych-contrib. Builds whatever that checkout has checked
# out, copies the browser bundle into site/vendor/plugin-pipe/, and rewrites
# SOURCE.md with the commit it came from -- so the page is always traceable to
# an exact plugin revision. Refuses to run if plugin-pipe has uncommitted
# changes, because then the recorded commit would not describe the bundle.
set -euo pipefail

here="$(cd "$(dirname "$0")/.." && pwd)"
contrib="${1:-$here/../jspsych-contrib}"
pkg="$contrib/packages/plugin-pipe"
out="$here/site/vendor/plugin-pipe"

[[ -d "$pkg" ]] || { echo "No plugin-pipe at $pkg" >&2; exit 1; }
if [[ -n "$(git -C "$contrib" status --porcelain -- packages/plugin-pipe)" ]]; then
  echo "plugin-pipe has uncommitted changes; commit them first so SOURCE.md is accurate." >&2
  exit 1
fi

(cd "$pkg" && npm run build >/dev/null)
cp "$pkg/dist/index.browser.min.js" "$out/"

sha="$(git -C "$contrib" rev-parse HEAD)"
branch="$(git -C "$contrib" rev-parse --abbrev-ref HEAD)"
sum="$(shasum -a 256 "$out/index.browser.min.js" | cut -c1-16)"
version="$(node -p "require('$pkg/package.json').version")"
built="$(date -u +"%Y-%m-%d %H:%M UTC")"

python3 - "$out/SOURCE.md" "$sha" "$branch" "$sum" "$version" "$built" <<'PY'
import re, sys
path, sha, branch, digest, version, built = sys.argv[1:]
s = open(path).read()
s = re.sub(r"\| Branch \| .* \|", f"| Branch | `{branch}` |", s)
s = re.sub(r"\| Commit \| .* \|", f"| Commit | `{sha}` |", s)
s = re.sub(r"\| Built \| .* \|", f"| Built | {built} with `npm run build` |", s)
s = re.sub(r"\| SHA-256 \(first 16\) \| .* \|", f"| SHA-256 (first 16) | `{digest}` |", s)
s = re.sub(r"reports version `[^`]*`", f"reports version `{version}`", s)
open(path, "w").write(s)
PY

echo "Refreshed from $branch @ ${sha:0:7} ($sum). Review and commit site/vendor/plugin-pipe/."
