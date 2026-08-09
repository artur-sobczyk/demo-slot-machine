#!/bin/bash
set -euo pipefail

# Build SAM backend
cd backend && sam build
cd ..

# Query CloudFormation stack outputs for frontend config
STACK_OUTPUTS=$(aws cloudformation describe-stacks --stack-name "$SAM_STACK_NAME" --query "Stacks[0].Outputs")
export AWS_REGION_VALUE=$(echo "$STACK_OUTPUTS" | python3 -c "import sys,json; outputs=json.load(sys.stdin); print(next(o['OutputValue'] for o in outputs if o['OutputKey']=='AwsRegion'), end='')" 2>/dev/null || echo "eu-west-1")
export IDENTITY_POOL_ID_VALUE=$(echo "$STACK_OUTPUTS" | python3 -c "import sys,json; outputs=json.load(sys.stdin); print(next(o['OutputValue'] for o in outputs if o['OutputKey']=='IdentityPoolId'), end='')")
export SLOT_FUNCTION_NAME_VALUE=$(echo "$STACK_OUTPUTS" | python3 -c "import sys,json; outputs=json.load(sys.stdin); print(next(o['OutputValue'] for o in outputs if o['OutputKey']=='SlotFunctionName'), end='')")

# Replace placeholders in frontend source
sed -i "s|{{AWS_REGION}}|$AWS_REGION_VALUE|g" frontend/src/app.js
sed -i "s|{{IDENTITY_POOL_ID}}|$IDENTITY_POOL_ID_VALUE|g" frontend/src/app.js
sed -i "s|{{SLOT_FUNCTION_NAME}}|$SLOT_FUNCTION_NAME_VALUE|g" frontend/src/app.js

# Bundle frontend with esbuild
cd frontend && npm ci && npx esbuild src/app.js --bundle --outfile=static/app.bundle.js
cd ..

# Package frontend static assets (excluding index-local.html) into a zip
cd frontend/static && zip -r ../../frontend-deploy.zip . -x "index-local.html"
cd ../..
