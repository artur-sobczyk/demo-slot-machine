$ErrorActionPreference = "Stop"

$StackName = if ($args[0]) { $args[0] } else { "slot-machine-stack" }
$Region = if ($env:AWS_REGION) { $env:AWS_REGION } else { "eu-west-1" }

Write-Host "Fetching stack outputs from $StackName..."

$IdentityPoolId = aws cloudformation describe-stacks `
  --stack-name $StackName `
  --region $Region `
  --query "Stacks[0].Outputs[?OutputKey=='IdentityPoolId'].OutputValue" `
  --output text

$SlotFunctionName = aws cloudformation describe-stacks `
  --stack-name $StackName `
  --region $Region `
  --query "Stacks[0].Outputs[?OutputKey=='SlotFunctionName'].OutputValue" `
  --output text

$AmplifyUrl = aws cloudformation describe-stacks `
  --stack-name $StackName `
  --region $Region `
  --query "Stacks[0].Outputs[?OutputKey=='AmplifyDefaultUrl'].OutputValue" `
  --output text

$AmplifyAppId = ($AmplifyUrl -replace 'https://main\.([^.]+)\.amplifyapp\.com', '$1')

Write-Host "  IdentityPoolId:    $IdentityPoolId"
Write-Host "  SlotFunctionName:  $SlotFunctionName"
Write-Host "  AmplifyAppId:      $AmplifyAppId"
Write-Host "  Region:            $Region"

# Build frontend
Write-Host "Building frontend..."
Copy-Item src/app.js src/app.build.js
(Get-Content src/app.build.js) `
  -replace '\{\{AWS_REGION\}\}', $Region `
  -replace '\{\{IDENTITY_POOL_ID\}\}', $IdentityPoolId `
  -replace '\{\{SLOT_FUNCTION_NAME\}\}', $SlotFunctionName |
  Set-Content src/app.build.js

npx esbuild src/app.build.js --bundle --minify --outfile=static/app.bundle.js --format=iife --platform=browser --target=es2020

Remove-Item src/app.build.js

# Package
Write-Host "Packaging..."
if (Test-Path dist) { Remove-Item dist -Recurse -Force }
Copy-Item -Recurse static dist
Remove-Item dist/index-local.html -ErrorAction SilentlyContinue

Compress-Archive -Path dist/* -DestinationPath frontend.zip -Force

# Deploy to Amplify
Write-Host "Deploying to Amplify..."
$DeploymentJson = aws amplify create-deployment `
  --app-id $AmplifyAppId `
  --branch-name main `
  --region $Region `
  --output json

$Deployment = $DeploymentJson | ConvertFrom-Json
$JobId = $Deployment.jobId
$UploadUrl = $Deployment.zipUploadUrl

curl.exe -T frontend.zip $UploadUrl

aws amplify start-deployment `
  --app-id $AmplifyAppId `
  --branch-name main `
  --job-id $JobId `
  --region $Region

# Cleanup
Remove-Item dist -Recurse -Force
Remove-Item frontend.zip

Write-Host ""
Write-Host "Frontend deployed successfully!"
Write-Host "URL: https://main.$AmplifyAppId.amplifyapp.com"
