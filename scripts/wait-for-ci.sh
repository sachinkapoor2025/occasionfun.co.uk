#!/usr/bin/env bash
# Wait until the CI workflow has succeeded for this exact commit.
set -euo pipefail

if [ -z "${GH_TOKEN:-}" ] && [ -z "${GITHUB_TOKEN:-}" ]; then
  echo "GitHub token is unavailable, so CI status cannot be checked."
  exit 1
fi
export GH_TOKEN="${GH_TOKEN:-$GITHUB_TOKEN}"

sha="${GITHUB_SHA:?GITHUB_SHA is required}"
workflow="${CI_WORKFLOW_FILE:-ci.yml}"
attempts="${CI_WAIT_ATTEMPTS:-120}"
sleep_seconds="${CI_WAIT_SLEEP_SECONDS:-15}"

for ((attempt = 1; attempt <= attempts; attempt++)); do
  json="$(gh run list --workflow "$workflow" --commit "$sha" --limit 20 --json databaseId,status,conclusion,createdAt,event,headSha,url)"
  latest="$(printf '%s' "$json" | jq -c 'sort_by(.createdAt) | last // empty')"
  if [ -z "$latest" ] || [ "$latest" = "null" ]; then
    echo "Waiting for CI to start for ${sha} (${attempt}/${attempts})."
    sleep "$sleep_seconds"
    continue
  fi
  status="$(printf '%s' "$latest" | jq -r '.status')"
  conclusion="$(printf '%s' "$latest" | jq -r '.conclusion // empty')"
  url="$(printf '%s' "$latest" | jq -r '.url // empty')"
  echo "CI status=${status} conclusion=${conclusion} ${url}"
  if [ "$status" != "completed" ]; then
    sleep "$sleep_seconds"
    continue
  fi
  if [ "$conclusion" = "success" ]; then
    echo "CI passed for ${sha}."
    exit 0
  fi
  echo "CI did not pass (conclusion=${conclusion}). Deployment stopped."
  exit 1
done

echo "Timed out waiting for CI."
exit 1
