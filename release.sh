#!/bin/bash
# JanuNet release script — usage: ./release.sh 2.1 "What changed in this release"

set -e  # exit on any error

NEW_VERSION="$1"
NOTES="$2"

if [ -z "$NEW_VERSION" ] || [ -z "$NOTES" ]; then
  echo "Usage: ./release.sh <version> \"<release notes>\""
  echo "Example: ./release.sh 2.1 \"Fixed autocomplete bug, added dark mode\""
  exit 1
fi

echo "→ Releasing v$NEW_VERSION"

# 1. Bump extension/manifest.json
python3 -c "
import json
p = 'extension/manifest.json'
m = json.load(open(p))
m['version'] = '$NEW_VERSION'
json.dump(m, open(p, 'w'), indent=2)
print('  ✓ manifest.json → $NEW_VERSION')
"

# 2. Update public/version.json
cat > public/version.json << JSON_EOF
{
  "latest": "$NEW_VERSION",
  "minimum": "2.0",
  "downloadUrl": "/GenZ-DNS-Extension.zip",
  "releaseNotes": "$NOTES",
  "releasedAt": "$(date +%Y-%m-%d)"
}
JSON_EOF
echo "  ✓ version.json → $NEW_VERSION"

# 3. Rebuild ZIP
rm -f public/GenZ-DNS-Extension.zip
zip -rq public/GenZ-DNS-Extension.zip extension/ --exclude "*.DS_Store" "*__MACOSX*"
echo "  ✓ ZIP rebuilt ($(du -h public/GenZ-DNS-Extension.zip | cut -f1))"

# 4. Commit and push
git add extension/manifest.json public/version.json public/GenZ-DNS-Extension.zip
git commit -m "release: v$NEW_VERSION - $NOTES"
git push
echo "  ✓ Pushed to GitHub → Vercel deploying"

echo ""
echo "═══════════════════════════════════════════"
echo "  Released v$NEW_VERSION"
echo "  Users will see update banners in ~30 sec"
echo "═══════════════════════════════════════════"
