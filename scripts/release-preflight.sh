#!/usr/bin/env sh
# Guards for the `preversion` lifecycle hook, so they run before anything is
# bumped, committed or tagged. Every exit path here leaves the repo as it was.
set -eu

fail() {
    echo "release: $1" >&2
    exit 1
}

has_script() {
    [ "$(node -p "require('./package.json').scripts['$1'] ? 'yes' : 'no'")" = yes ]
}

branch=$(git symbolic-ref --short HEAD 2>/dev/null) || fail "detached HEAD; check out main"
[ "$branch" = "main" ] || fail "on '$branch', but releases are cut from main"

git diff --quiet && git diff --cached --quiet ||
    fail "working tree is dirty; commit or stash before releasing"

git fetch --quiet origin main || fail "cannot reach origin"
git merge-base --is-ancestor origin/main HEAD ||
    fail "HEAD is behind origin/main; pull, then release"

# Generated files are tracked, so a stale copy would ship inside the tag.
# The tree was clean a moment ago, so regenerating must leave it clean too --
# any diff means a source (e.g. definition-schema.json) was edited without
# rerunning its generator.
for gen in types catalog; do
    has_script "$gen" && npm run --silent "$gen"
done
git diff --quiet ||
    fail "generated files are stale: $(git diff --name-only | tr '\n' ' ')-- rerun the generator, commit, then release"

# Build gate. CI builds again from the tag, but failing here costs no version.
npm run build
