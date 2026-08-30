#!/usr/bin/env sh
# Runs after the tag is pushed. Publishing happens in CI (OIDC trusted
# publishing cannot run from a laptop), so without this the release command
# reports success whether or not the package ever reaches npm -- which is how
# widget-linechart 1.7.5 and widget-statehistory 1.0.19 sat unpublished.
set -eu

command -v gh >/dev/null 2>&1 || {
    echo "release: gh not installed, skipping the CI check; verify the run yourself" >&2
    exit 0
}

version=$(node -p "require('./package.json').version")
# remote.origin.url explicitly: some of these repos carry an unrelated
# 'upstream' remote, and a bare `gh run list` resolves to the wrong repo.
repo=$(git config --get remote.origin.url | sed 's#.*github\.com[:/]##; s#\.git$##')

echo "release: waiting for the $version workflow on $repo"
run=""
i=0
while [ "$i" -lt 30 ]; do
    run=$(gh run list -R "$repo" --branch "$version" --limit 1 \
        --json databaseId --jq '.[0].databaseId' 2>/dev/null || true)
    [ -n "$run" ] && break
    i=$((i + 1))
    sleep 2
done
[ -n "$run" ] || {
    echo "release: no workflow run appeared for $version; check https://github.com/$repo/actions" >&2
    exit 1
}

gh run watch "$run" -R "$repo" --exit-status --interval 5 >/dev/null || {
    echo "release: the $version workflow FAILED -- $version is NOT on npm" >&2
    echo "release: gh run view $run -R $repo --log-failed" >&2
    exit 1
}

echo "release: $version published"
