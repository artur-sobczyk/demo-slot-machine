# Implementation Plan: AWS CodePipeline CI/CD

## Overview

This plan implements an AWS CDK application in `cicd/` that provisions a CodePipeline for the slot machine application. The pipeline automates source checkout, testing, building, manual approval, deployment (SAM backend + Amplify frontend), and post-deployment smoke testing. Tasks are ordered so each step builds on the previous, ending with full integration wiring.

## Tasks

- [x] 1. Set up CDK project structure and configuration
  - [x] 1.1 Initialize CDK project in `cicd/` directory
    - Create `cicd/` directory with `package.json` declaring `aws-cdk-lib`, `constructs`, `typescript`, `ts-node`, `@types/node`, and `jest`/`@types/jest` as dependencies
    - Create `tsconfig.json` with strict type checking enabled
    - Create `cdk.json` with app entry point `npx ts-node bin/pipeline.ts` and context including `samStackName: "slot-machine-stack"` and `@aws-cdk/core:newStyleStackSynthesis: true`
    - _Requirements: 1.1, 1.2, 1.6, 1.7_

  - [x] 1.2 Create CDK app entry point and empty pipeline stack
    - Create `cicd/bin/pipeline.ts` that instantiates the CDK app and the `SlotMachinePipelineStack` targeting `eu-west-1`
    - Create `cicd/lib/pipeline-stack.ts` with an empty stack class that reads `samStackName` from context and throws if missing
    - _Requirements: 1.3, 1.4, 1.5_

- [x] 2. Implement Source and Test stages
  - [x] 2.1 Add CodeStar Connection and Source stage
    - In `pipeline-stack.ts`, define a `CfnConnection` resource for GitHub with provider type `GitHub`
    - Create a `CodePipelineSource.connection()` source pointing to the repository's `main` branch with `triggerOnPush: true`
    - Instantiate `pipelines.CodePipeline` with the source and a synth step (`cdk synth` from `cicd/`)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [x] 2.2 Add Test stage as a pre-deployment wave step
    - Create a `CodeBuildStep` that installs dependencies for `backend/draw-lambda/`, `backend/seed-lambda/`, and `frontend/`
    - Run backend tests with `node --test --test-reporter=junit --test-reporter-destination=backend-results.xml`
    - Run frontend tests with `npx vitest run --reporter=junit --outputFile=frontend-results.xml`
    - Configure CodeBuild report groups for JUnit XML reports
    - Add this step as a pre-step in the pipeline wave before build
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [x] 3. Implement Build stage
  - [x] 3.1 Add Build step producing SAM and frontend artifacts
    - Create a `CodeBuildStep` that runs `sam build` in the `backend/` directory
    - Query CloudFormation for stack outputs (IdentityPoolId, SlotFunctionName, region) using the `samStackName` context parameter
    - Perform sed/envsubst replacement of `{{AWS_REGION}}`, `{{IDENTITY_POOL_ID}}`, `{{SLOT_FUNCTION_NAME}}` in `frontend/src/app.js`
    - Run esbuild to produce `static/app.bundle.js`
    - Package `frontend/static/` (excluding `index-local.html`) into a zip
    - Output both the SAM `.aws-sam/build/` directory and the frontend zip as primary outputs
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [x] 4. Checkpoint - Verify synthesis
  - Ensure `cdk synth` succeeds from the `cicd/` directory, ask the user if questions arise.

- [x] 5. Implement Deploy stage and Approval gate
  - [x] 5.1 Create the deployment stage construct
    - Create `cicd/lib/deploy-stage.ts` defining a `cdk.Stage` that will hold deploy actions
    - Add the stage to the pipeline via `pipeline.addStage()` with a `ManualApprovalStep` as a pre-step
    - _Requirements: 5.1, 5.2_

  - [x] 5.2 Add Backend Deploy step
    - Create a `ShellStep` that runs `sam deploy --stack-name "$SAM_STACK_NAME" --config-file backend/samconfig.toml --no-confirm-changeset --no-fail-on-empty-changeset` with `CAPABILITY_IAM CAPABILITY_NAMED_IAM`
    - Inject `SAM_STACK_NAME` as an environment variable from the CDK context parameter
    - Target region `eu-west-1`
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [x] 5.3 Add Frontend Deploy step
    - Create a `ShellStep` that retrieves the Amplify App ID from CloudFormation stack outputs using the `samStackName` parameter
    - Call `aws amplify create-deployment` to get upload URL and job ID
    - Upload the frontend zip to the pre-signed URL
    - Call `aws amplify start-deployment` with the job ID, deploying to branch `main`
    - _Requirements: 7.1, 7.2, 7.3_

- [x] 6. Implement Smoke Test stage
  - [x] 6.1 Add Smoke Test step as a post-deployment step
    - Create a `CodeBuildStep` using a runtime environment with Chromium available
    - Retrieve `AmplifyDefaultUrl` from CloudFormation outputs using the `samStackName` parameter
    - Write a Puppeteer script that navigates to the Amplify URL, waits up to 10s for `#slot_handle` visibility, simulates mousedown + mouseup, then polls up to 15s until `#slot_L`, `#slot_M`, `#slot_R` src attributes no longer contain `slotpullanimation.gif` and aren't empty
    - Set CodeBuild step timeout to 60 seconds
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

- [ ] 7. Configure IAM permissions and observability
  - [x] 7.1 Configure least-privilege IAM roles for each CodeBuild project
    - Ensure the test role has S3 (artifact bucket), CodeBuild reports, and CloudWatch Logs permissions
    - Ensure the build role has S3, CloudFormation DescribeStacks, and CloudWatch Logs permissions
    - Ensure the deploy role has CloudFormation, Lambda, DynamoDB, Cognito, IAM (create/pass roles), Amplify (create-deployment, start-deployment), S3, and CloudWatch Logs — scoped to the `samStackName` resource ARN patterns
    - Ensure the smoke test role has only CloudFormation DescribeStacks, read-only Amplify, and CloudWatch Logs
    - No wildcard resource ARNs for Lambda, DynamoDB, or Cognito permissions
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

  - [x] 7.2 Configure CloudWatch Logs retention
    - Set 30-day retention on all CodeBuild log groups
    - _Requirements: 10.1, 10.2_

- [x] 8. Checkpoint - Full synthesis validation
  - Ensure `cdk synth` succeeds and produces a valid CloudFormation template, ask the user if questions arise.

- [ ] 9. Write CDK unit tests
  - [ ]* 9.1 Write CDK snapshot and assertion tests
    - Create `cicd/test/pipeline-stack.test.ts` using Jest with CDK assertions
    - Verify pipeline resource exists with correct stage count
    - Verify CodeStar Connection resource with correct provider type
    - Verify CodeBuild projects use Node.js 22 runtime image
    - Verify IAM roles have no wildcard resource ARNs for Lambda/DynamoDB/Cognito
    - Verify CloudWatch Logs log groups have 30-day retention
    - Verify manual approval action exists in the correct stage position
    - Verify build step produces expected output artifacts
    - _Requirements: 1.7, 9.4, 10.1_

  - [ ]* 9.2 Write smoke test script unit tests
    - Create tests for the Puppeteer polling logic (retry with timeout)
    - Test URL extraction from CloudFormation output parsing
    - Test assertion conditions (src attribute checks)
    - Use mocked Puppeteer/page objects
    - _Requirements: 8.2, 8.4, 8.5_

- [ ] 10. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation via `cdk synth`
- The CDK project uses TypeScript as specified in the design
- After initial deployment, the CodeStar Connection requires a one-time manual OAuth handshake in the AWS Console to reach AVAILABLE status
- The pipeline is self-mutating — changes to `cicd/` trigger automatic pipeline updates

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2"] },
    { "id": 2, "tasks": ["2.1"] },
    { "id": 3, "tasks": ["2.2", "3.1"] },
    { "id": 4, "tasks": ["5.1"] },
    { "id": 5, "tasks": ["5.2", "5.3"] },
    { "id": 6, "tasks": ["6.1"] },
    { "id": 7, "tasks": ["7.1", "7.2"] },
    { "id": 8, "tasks": ["9.1", "9.2"] }
  ]
}
```
