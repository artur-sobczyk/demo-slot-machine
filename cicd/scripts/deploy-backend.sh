#!/bin/bash
set -euo pipefail

sam deploy \
  --stack-name "$SAM_STACK_NAME" \
  --config-file backend/samconfig.toml \
  --no-confirm-changeset \
  --no-fail-on-empty-changeset \
  --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM
