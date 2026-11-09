#!/usr/bin/env bash
# Sets GitHub Actions secrets for S3 deploy. Requires: gh auth login
# Usage (do NOT commit real values):
#   export AWS_ACCESS_KEY_ID=...
#   export AWS_SECRET_ACCESS_KEY=...
#   export AWS_SESSION_TOKEN=...   # required for temporary STS credentials
#   ./scripts/set-github-aws-secrets.sh

set -euo pipefail
REPO="${GITHUB_REPO:-sachinkapoor2025/occasionfun.co.uk}"

: "${AWS_ACCESS_KEY_ID:?Set AWS_ACCESS_KEY_ID}"
: "${AWS_SECRET_ACCESS_KEY:?Set AWS_SECRET_ACCESS_KEY}"

gh auth status >/dev/null
printf '%s' "$AWS_ACCESS_KEY_ID" | gh secret set AWS_ACCESS_KEY_ID --repo "$REPO"
printf '%s' "$AWS_SECRET_ACCESS_KEY" | gh secret set AWS_SECRET_ACCESS_KEY --repo "$REPO"
if [[ -n "${AWS_SESSION_TOKEN:-}" ]]; then
  printf '%s' "$AWS_SESSION_TOKEN" | gh secret set AWS_SESSION_TOKEN --repo "$REPO"
fi
echo "Secrets updated on $REPO"
gh secret list --repo "$REPO"
