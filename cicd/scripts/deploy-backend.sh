#!/bin/bash
set -euo pipefail

cd backend
sam deploy \
  --stack-name "$SAM_STACK_NAME" \
  --config-file samconfig.toml \
  --no-confirm-changeset \
  --no-fail-on-empty-changeset \
  --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM
