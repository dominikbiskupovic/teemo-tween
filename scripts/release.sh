#!/usr/bin/env bash
# Called by the Release workflow (changesets/action) when no changesets are pending.
# Stages the current version on npm through trusted publishing (OIDC); a maintainer then approves
# it with 2FA on npmjs.com (Staged Packages) or with `npm stage approve <id>`.
set -euo pipefail

name=$(node -p "require('./package.json').name")
version=$(node -p "require('./package.json').version")

if npm view "$name@$version" version >/dev/null 2>&1; then
  echo "$name@$version is already published. Nothing to do."
  exit 0
fi
# The git tag is created right after staging, so it means "already staged, awaiting approval".
if git ls-remote --exit-code --tags origin "refs/tags/v$version" >/dev/null 2>&1; then
  echo "$name@$version is already staged (tag v$version exists). Approve it on npmjs.com."
  exit 0
fi

npm run build
npm stage publish
echo "Staged $name@$version. Approve it on npmjs.com → Staged Packages, or: npm stage approve <id>"
# Tag the release; changesets/action pushes the tag and creates the GitHub release.
npx changeset git-tag
