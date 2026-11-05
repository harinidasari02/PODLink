#!/usr/bin/env bash
# Builds the submission ZIP: TDD (Word) + deployment.md.
# Usage: scripts/build-submission.sh <GITHUB_URL> [LIVE_APP_URL]
# Needs: pandoc, zip. The sources in docs/ and deployment.md are never modified;
# the URLs are substituted in a temporary copy.
set -euo pipefail

GITHUB_URL="${1:?Usage: $0 <GITHUB_URL> [LIVE_APP_URL]}"
LIVE_URL="${2:-}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/dist"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

mkdir -p "$OUT"
cp -r "$ROOT/docs/." "$TMP/"
cp "$ROOT/deployment.md" "$TMP/deployment.md"

# GitHub URL goes at the top of the TDD and into the clone command.
sed -i "s|<<ADD YOUR PUBLIC GITHUB URL HERE BEFORE SUBMITTING>>|$GITHUB_URL|" "$TMP/TDD.md"
sed -i "s|<GITHUB_URL>|$GITHUB_URL|" "$TMP/deployment.md"
if [ -n "$LIVE_URL" ]; then
  sed -i "s|^\*\*Live app:\*\*.*|**Live app:** $LIVE_URL|" "$TMP/TDD.md"
fi

(cd "$TMP" && pandoc TDD.md -o "$OUT/PODLink-TDD.docx" --resource-path=. )
cp "$TMP/deployment.md" "$OUT/deployment.md"

rm -f "$OUT/submission.zip"
(cd "$OUT" && zip -q submission.zip PODLink-TDD.docx deployment.md)
echo "Built $OUT/submission.zip ($(du -h "$OUT/submission.zip" | cut -f1))"
