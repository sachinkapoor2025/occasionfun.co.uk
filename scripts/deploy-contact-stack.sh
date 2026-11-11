#!/usr/bin/env bash
# Create a CloudFormation change set, inspect the aggregated JSON, then execute it.
# "No changes to deploy" is the only successful no-op. An empty Changes array is refused.
# This script does not update Secrets Manager and does not use a guided deployment.
set -euo pipefail
export MSYS_NO_PATHCONV=1
export MSYS2_ARG_CONV_EXCL="*"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

run_node() {
  local script="$1"
  shift
  if command -v cygpath >/dev/null 2>&1; then
    script="$(cygpath -m "$script")"
  fi
  MSYS_NO_PATHCONV=1 node "$script" "$@"
}
ENVIRONMENT=""
STACK_NAME=""
PARAMETERS_FILE=""
ALLOW_CREATE=""
EXPECTED_TABLE=""
EXPECTED_CONTACT_FUNCTION=""
EXPECTED_RETRY_FUNCTION=""
EXPECTED_CONTACT_LOG_GROUP=""
EXPECTED_RETRY_LOG_GROUP=""
EXPECTED_API_ID=""
EXPECTED_ENDPOINT=""
CHECK_ONLY="false"
REQUESTED_ROLE_ARN=""
ROLE_ARN=""
DEMO_CLOUDFORMATION_ROLE_ARN="arn:aws:iam::796174527529:role/occasionfun-cloudformation-demo"
PRODUCTION_CLOUDFORMATION_ROLE_ARN="arn:aws:iam::796174527529:role/occasionfun-cloudformation-production"

while [ "$#" -gt 0 ]; do
  case "$1" in
    --environment) ENVIRONMENT="$2"; shift 2 ;;
    --stack-name) STACK_NAME="$2"; shift 2 ;;
    --parameters-file) PARAMETERS_FILE="$2"; shift 2 ;;
    --allow-create) ALLOW_CREATE="$2"; shift 2 ;;
    --expected-table) EXPECTED_TABLE="$2"; shift 2 ;;
    --expected-contact-function) EXPECTED_CONTACT_FUNCTION="$2"; shift 2 ;;
    --expected-retry-function) EXPECTED_RETRY_FUNCTION="$2"; shift 2 ;;
    --expected-contact-log-group) EXPECTED_CONTACT_LOG_GROUP="$2"; shift 2 ;;
    --expected-retry-log-group) EXPECTED_RETRY_LOG_GROUP="$2"; shift 2 ;;
    --expected-api-id) EXPECTED_API_ID="$2"; shift 2 ;;
    --expected-endpoint) EXPECTED_ENDPOINT="$2"; shift 2 ;;
    --role-arn) REQUESTED_ROLE_ARN="$2"; shift 2 ;;
    --check-only) CHECK_ONLY="true"; shift ;;
    *)
      echo "Unknown argument: $1"
      exit 1
      ;;
  esac
done

if [ "$ENVIRONMENT" = "demo" ]; then
  if [ -n "$REQUESTED_ROLE_ARN" ] && [ "$REQUESTED_ROLE_ARN" != "$DEMO_CLOUDFORMATION_ROLE_ARN" ]; then
    echo "Demo deployment rejected a different CloudFormation execution role."
    echo "Expected: $DEMO_CLOUDFORMATION_ROLE_ARN"
    exit 1
  fi
  ROLE_ARN="$DEMO_CLOUDFORMATION_ROLE_ARN"
  echo "Demo change sets use CloudFormation role ${ROLE_ARN}."
elif [ "$ENVIRONMENT" = "prod" ]; then
  if [ "$REQUESTED_ROLE_ARN" = "$DEMO_CLOUDFORMATION_ROLE_ARN" ]; then
    echo "Production cannot use the demo CloudFormation execution role."
    exit 1
  fi
  if [ -n "$REQUESTED_ROLE_ARN" ] && [ "$REQUESTED_ROLE_ARN" != "$PRODUCTION_CLOUDFORMATION_ROLE_ARN" ]; then
    echo "Production deployment rejected a different CloudFormation execution role."
    echo "Expected: $PRODUCTION_CLOUDFORMATION_ROLE_ARN"
    exit 1
  fi
  ROLE_ARN="$PRODUCTION_CLOUDFORMATION_ROLE_ARN"
  echo "Production change sets use CloudFormation role ${ROLE_ARN}."
fi

export AWS_REGION="eu-west-2"
export AWS_DEFAULT_REGION="eu-west-2"

if [ "$CHECK_ONLY" = "true" ]; then
  account="796174527529"
else
  if [ -z "${AWS_ACCESS_KEY_ID:-}" ] || [ -z "${AWS_SECRET_ACCESS_KEY:-}" ]; then
    echo "AWS credentials are unavailable."
    exit 1
  fi
  account="$(aws sts get-caller-identity --query Account --output text)"
fi

config_args=(
  --environment "$ENVIRONMENT"
  --stack-name "$STACK_NAME"
  --parameters-file "$PARAMETERS_FILE"
  --allow-create "$ALLOW_CREATE"
  --account-id "$account"
  --region "$AWS_REGION"
  --expected-table "$EXPECTED_TABLE"
  --expected-contact-function "$EXPECTED_CONTACT_FUNCTION"
  --expected-retry-function "$EXPECTED_RETRY_FUNCTION"
  --expected-contact-log-group "$EXPECTED_CONTACT_LOG_GROUP"
  --expected-retry-log-group "$EXPECTED_RETRY_LOG_GROUP"
)
if [ -n "$EXPECTED_API_ID" ]; then
  config_args+=(--expected-api-id "$EXPECTED_API_ID")
fi
if [ -n "$EXPECTED_ENDPOINT" ]; then
  config_args+=(--expected-endpoint "$EXPECTED_ENDPOINT")
fi
run_node "$ROOT/scripts/assert-deploy-config.mjs" "${config_args[@]}"
echo "AWS account matches."

if [ "$CHECK_ONLY" = "true" ]; then
  echo "Configuration check only. No change set was created."
  exit 0
fi

physical_id() {
  aws cloudformation describe-stack-resource \
    --stack-name "$STACK_NAME" \
    --logical-resource-id "$1" \
    --region "$AWS_REGION" \
    --query StackResourceDetail.PhysicalResourceId \
    --output text
}

require_physical() {
  local actual
  actual="$(physical_id "$1")"
  if [ "$actual" != "$2" ]; then
    echo "Resource $1 does not have the expected physical name."
    echo "Expected: $2"
    echo "Actual: $actual"
    exit 1
  fi
}

require_names() {
  require_physical LeadsTable "$EXPECTED_TABLE"
  require_physical ContactFunction "$EXPECTED_CONTACT_FUNCTION"
  require_physical ContactRetryFunction "$EXPECTED_RETRY_FUNCTION"
  require_physical ContactLogGroup "$EXPECTED_CONTACT_LOG_GROUP"
  require_physical ContactRetryLogGroup "$EXPECTED_RETRY_LOG_GROUP"
  if [ -n "$EXPECTED_API_ID" ]; then
    require_physical ContactHttpApi "$EXPECTED_API_ID"
  fi
}

stack_endpoint() {
  aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$AWS_REGION" \
    --query "Stacks[0].Outputs[?OutputKey=='ContactEndpoint'].OutputValue | [0]" \
    --output text
}

require_endpoint() {
  local endpoint
  endpoint="$(stack_endpoint)"
  if [ "$ENVIRONMENT" = "demo" ]; then
    if [ "$endpoint" != "$EXPECTED_ENDPOINT" ]; then
      echo "Deployed API endpoint is not the existing demo endpoint."
      echo "Expected: $EXPECTED_ENDPOINT"
      echo "Actual: $endpoint"
      exit 1
    fi
  fi
  if [ "$ENVIRONMENT" = "prod" ]; then
    case "$endpoint" in
      *0e6zpkvbkj*)
        echo "Production endpoint points at the demo API. The change was refused."
        exit 1
        ;;
      https://*.execute-api.eu-west-2.amazonaws.com/contact) ;;
      *)
        echo "Production endpoint is not an eu-west-2 execute-api contact URL."
        echo "Actual: $endpoint"
        exit 1
        ;;
    esac
  fi
  echo "Contact endpoint check passed."
}

describe_stderr="$(mktemp)"
describe_reason="$(mktemp)"
set +e
stack_status="$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$AWS_REGION" --query "Stacks[0].StackStatus" --output text 2>"$describe_stderr")"
describe_status=$?
classification="$(run_node "$ROOT/scripts/classify-stack-describe.mjs" --exit-status "$describe_status" --stack-name "$STACK_NAME" --stderr-file "$describe_stderr" 2>"$describe_reason")"
classify_status=$?
set -e
if [ "$classify_status" -ne 0 ]; then
  echo "Could not determine whether stack ${STACK_NAME} exists (${classification:-$(cat "$describe_reason")}). No change set was created."
  echo "aws cloudformation describe-stacks --stack-name ${STACK_NAME} --region ${AWS_REGION} exited ${describe_status}."
  if [ -s "$describe_stderr" ]; then
    echo "AWS CLI stderr:"
    cat "$describe_stderr"
  fi
  exit 1
fi

case "$classification" in
  exists)
    case "$stack_status" in
      CREATE_COMPLETE|UPDATE_COMPLETE|UPDATE_ROLLBACK_COMPLETE)
        require_names
        require_endpoint
        change_mode="update"
        ;;
      *)
        echo "Stack ${STACK_NAME} is ${stack_status:-unavailable}. Refusing to create a change set."
        exit 1
        ;;
    esac
    ;;
  missing)
    if [ "$ALLOW_CREATE" != "true" ]; then
      echo "Stack ${STACK_NAME} does not exist. Refusing to create it."
      exit 1
    fi
    change_mode="create"
    ;;
  *)
    echo "Could not determine whether stack ${STACK_NAME} exists. No change set was created."
    exit 1
    ;;
esac

template="$ROOT/infra/contact-api/.aws-sam/build/template.yaml"
if [ ! -f "$template" ]; then
  echo "SAM build output is missing. Run sam build before deployment."
  exit 1
fi

log="$(mktemp)"
sam_args=(
  deploy
  --template-file "$template"
  --stack-name "$STACK_NAME"
  --region "$AWS_REGION"
  --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM CAPABILITY_AUTO_EXPAND
  --resolve-s3
  --s3-prefix "$ENVIRONMENT"
  --no-execute-changeset
  --no-confirm-changeset
  --no-fail-on-empty-changeset
  --parameter-overrides "file://${PARAMETERS_FILE}"
)
if [ "$ENVIRONMENT" = "demo" ]; then
  sam_args+=(--role-arn "$DEMO_CLOUDFORMATION_ROLE_ARN")
elif [ "$ENVIRONMENT" = "prod" ]; then
  sam_args+=(--role-arn "$PRODUCTION_CLOUDFORMATION_ROLE_ARN")
fi
set +e
sam "${sam_args[@]}" \
  | tee "$log"
deploy_status="${PIPESTATUS[0]}"
set -e
if [ "$deploy_status" -ne 0 ]; then
  echo "Change set creation failed. No change set was executed."
  exit "$deploy_status"
fi

bucket="$(sed -n 's/.*Deployment s3 bucket[^:]*:[[:space:]]*//p' "$log" | head -n 1 | tr -d '\r')"
case "$bucket" in
  "" )
    echo "Deployment artifact bucket was not reported. No change set was executed."
    exit 1
    ;;
  occasionfun.co.uk|www.occasionfun.co.uk)
    echo "Refusing to store deployment artifacts in a website bucket."
    exit 1
    ;;
esac

if grep -q "No changes to deploy" "$log"; then
  echo "CloudFormation reported no changes. Existing resources were left in place."
  require_names
  require_endpoint
  exit 0
fi

arn="$(sed -n 's/.*\(arn:aws:cloudformation:[^ ]*changeSet[^ ]*\).*/\1/p' "$log" | tail -n 1 | tr -d '\r')"
if [ -z "$arn" ]; then
  echo "Change set ARN was not found. No change set was executed."
  exit 1
fi

for _ in $(seq 1 60); do
  description="$(aws cloudformation describe-change-set --change-set-name "$arn" --region "$AWS_REGION" --output json)"
  status="$(printf '%s' "$description" | jq -r '.Status')"
  case "$status" in
    CREATE_COMPLETE) break ;;
    FAILED)
      echo "Change set failed and was not executed."
      printf '%s' "$description" | jq -r '.StatusReason // "No reason reported."'
      exit 1
      ;;
    CREATE_PENDING|CREATE_IN_PROGRESS) sleep 5 ;;
    *)
      echo "Unexpected change set status: ${status}. It was not executed."
      exit 1
      ;;
  esac
done
if [ "${status:-}" != "CREATE_COMPLETE" ]; then
  echo "Change set was not ready. It was not executed."
  exit 1
fi

changes="$(mktemp --suffix=.json)"
printf '%s' "$description" | jq '{Changes: (.Changes // [])}' > "$changes"
token="$(printf '%s' "$description" | jq -r '.NextToken // empty')"
while [ -n "$token" ]; do
  page="$(aws cloudformation describe-change-set --change-set-name "$arn" --region "$AWS_REGION" --next-token "$token" --output json)"
  jq -s '{Changes: (.[0].Changes + (.[1].Changes // []))}' "$changes" <(printf '%s' "$page" | jq '{Changes: (.Changes // [])}') > "${changes}.next"
  mv "${changes}.next" "$changes"
  token="$(printf '%s' "$page" | jq -r '.NextToken // empty')"
done

if ! run_node "$ROOT/scripts/assert-safe-change-set.mjs" --mode "$change_mode" --file "$changes"; then
  echo "Deleting the unexecuted change set."
  aws cloudformation delete-change-set --change-set-name "$arn" --region "$AWS_REGION" || true
  exit 1
fi

aws cloudformation execute-change-set --change-set-name "$arn" --region "$AWS_REGION"
if [ "$change_mode" = "create" ]; then
  aws cloudformation wait stack-create-complete --stack-name "$STACK_NAME" --region "$AWS_REGION"
else
  aws cloudformation wait stack-update-complete --stack-name "$STACK_NAME" --region "$AWS_REGION"
fi

require_names
require_endpoint
echo "Stack ${STACK_NAME} update completed without replacing protected resources."
