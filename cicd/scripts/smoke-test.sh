#!/bin/bash
set -euo pipefail

# Install puppeteer (includes bundled Chromium)
npm init -y && npm install puppeteer

# Retrieve Amplify URL from CloudFormation stack outputs
export AMPLIFY_URL=$(aws cloudformation describe-stacks \
  --stack-name "$SAM_STACK_NAME" \
  --query "Stacks[0].Outputs[?OutputKey=='AmplifyDefaultUrl'].OutputValue" \
  --output text)
echo "Amplify URL: $AMPLIFY_URL"

# Run the smoke test script
node cicd/scripts/smoke-test.js
