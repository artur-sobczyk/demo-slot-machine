#!/bin/bash
set -euo pipefail

# Upgrade to Node.js 20
n 20
hash -r

# Query CloudFormation for AmplifyDefaultUrl from the SAM stack outputs
AMPLIFY_URL=$(aws cloudformation describe-stacks \
  --stack-name "$SAM_STACK_NAME" \
  --query "Stacks[0].Outputs[?OutputKey=='AmplifyDefaultUrl'].OutputValue" \
  --output text)
echo "Amplify URL: $AMPLIFY_URL"

# Extract the Amplify App ID from the URL (format: https://<branch>.<app-id>.amplifyapp.com)
APP_ID=$(echo "$AMPLIFY_URL" | sed -n 's|https://[^.]*\.\([^.]*\)\.amplifyapp\.com.*|\1|p')
echo "Amplify App ID: $APP_ID"

# Build frontend assets for deployment
cd frontend && npm ci && npx esbuild src/app.js --bundle --outfile=static/app.bundle.js
cd ..
cd frontend/static && zip -r ../../frontend-deploy.zip . -x "index-local.html"
cd ../..

# Create Amplify deployment to get upload URL and job ID
DEPLOYMENT=$(aws amplify create-deployment --app-id "$APP_ID" --branch-name main)
UPLOAD_URL=$(echo "$DEPLOYMENT" | python3 -c "import sys,json; print(json.load(sys.stdin)['zipUploadUrl'])")
JOB_ID=$(echo "$DEPLOYMENT" | python3 -c "import sys,json; print(json.load(sys.stdin)['jobId'])")
echo "Job ID: $JOB_ID"

# Upload the frontend zip to the pre-signed URL
curl --fail -T frontend-deploy.zip "$UPLOAD_URL"

# Start the Amplify deployment
aws amplify start-deployment --app-id "$APP_ID" --branch-name main --job-id "$JOB_ID"
