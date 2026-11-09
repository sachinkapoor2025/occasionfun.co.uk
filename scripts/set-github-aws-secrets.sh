#!/usr/bin/env bash
# Sets GitHub Actions secrets for S3 deploy. Requires: gh auth login
# Usage (do NOT commit real values):
#   export AWS_ACCESS_KEY_ID=...
#   export AWS_SECRET_ACCESS_KEY=...
#   ./scripts/set-github-aws-secrets.sh
#
# Secret names must be exactly:
#   AWS_ACCESS_KEY_ID
#   AWS_SECRET_ACCESS_KEY

set -euo pipefail
REPO="${GITHUB_REPO:-sachinkapoor2025/occasionfun.co.uk}"

: "${AWS_ACCESS_KEY_ID:?Set AWS_ACCESS_KEY_ID}"
: "${AWS_SECRET_ACCESS_KEY:?Set AWS_SECRET_ACCESS_KEY}"

gh auth status >/dev/null
printf '%s' "$AWS_ACCESS_KEY_ID" | gh secret set AWS_ACCESS_KEY_ID --repo "$REPO"
printf '%s' "$AWS_SECRET_ACCESS_KEY" | gh secret set AWS_SECRET_ACCESS_KEY --repo "$REPO"
echo "Secrets updated on $REPO"
gh secret list --repo "$REPO"
