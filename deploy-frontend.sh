#!/bin/bash
set -euo pipefail

STACK_NAME="${1:-slot-machine-stack}"
REGION="${AWS_REGION:-eu-west-1}"
BUILD_DIR="dist"

echo "Fetching stack outputs from ${STACK_NAME}..."

IDENTITY_POOL_ID=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --region "$REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='IdentityPoolId'].OutputValue" \
  --output text)

SLOT_FUNCTION_NAME=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --region "$REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='SlotFunctionName'].OutputValue" \
  --output text)

AMPLIFY_URL=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --region "$REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='AmplifyDefaultUrl'].OutputValue" \
  --output text)

AMPLIFY_APP_ID=$(echo "$AMPLIFY_URL" | sed -E 's|https://main\.([^.]+)\.amplifyapp\.com|\1|')

echo "  IdentityPoolId:    ${IDENTITY_POOL_ID}"
echo "  SlotFunctionName:  ${SLOT_FUNCTION_NAME}"
echo "  AmplifyAppId:      ${AMPLIFY_APP_ID}"
echo "  Region:            ${REGION}"

# Build frontend bundle
echo "Building frontend..."
cd frontend

# Replace placeholders in source before building
cp src/app.js src/app.build.js
sed -i "s|{{AWS_REGION}}|${REGION}|g" src/app.build.js
sed -i "s|{{IDENTITY_POOL_ID}}|${IDENTITY_POOL_ID}|g" src/app.build.js
sed -i "s|{{SLOT_FUNCTION_NAME}}|${SLOT_FUNCTION_NAME}|g" src/app.build.js

# Bundle with esbuild (run via PowerShell to use Windows binary)
powershell.exe -Command "cd '$PWD'; npx esbuild src/app.build.js --bundle --minify --outfile=../static/app.bundle.js --format=iife --platform=browser --target=es2020"

# Cleanup temp file
rm src/app.build.js
cd ..

# Package for deployment
echo "Packaging..."
rm -rf "$BUILD_DIR"
cp -r static "$BUILD_DIR"
rm -f "$BUILD_DIR/index-local.html"

cd "$BUILD_DIR"
powershell.exe -Command "Compress-Archive -Path '*' -DestinationPath '../frontend.zip' -Force"
cd ..

# Deploy to Amplify
echo "Deploying to Amplify..."
DEPLOYMENT=$(aws amplify create-deployment \
  --app-id "$AMPLIFY_APP_ID" \
  --branch-name main \
  --region "$REGION" \
  --output json)

JOB_ID=$(echo "$DEPLOYMENT" | python3 -c "import sys,json; print(json.load(sys.stdin)['jobId'])")
UPLOAD_URL=$(echo "$DEPLOYMENT" | python3 -c "import sys,json; print(json.load(sys.stdin)['zipUploadUrl'])")

curl -T frontend.zip "$UPLOAD_URL"

aws amplify start-deployment \
  --app-id "$AMPLIFY_APP_ID" \
  --branch-name main \
  --job-id "$JOB_ID" \
  --region "$REGION"

# Cleanup
rm -rf "$BUILD_DIR" frontend.zip

echo ""
echo "Frontend deployed successfully!"
echo "URL: https://main.${AMPLIFY_APP_ID}.amplifyapp.com"
