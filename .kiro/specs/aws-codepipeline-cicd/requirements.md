# Requirements Document

## Introduction

This document defines the requirements for an AWS-native CI/CD pipeline that replaces the existing GitHub Actions placeholder. The pipeline uses AWS CodePipeline provisioned via AWS CDK, triggered by commits to the `main` branch of the GitHub repository. It automates testing, building, manual approval, deployment of both the SAM backend and Amplify frontend, and post-deployment smoke testing of the slot machine application.

## Glossary

- **Pipeline**: The AWS CodePipeline instance that orchestrates the CI/CD stages from source through deployment
- **CDK_Project**: The AWS CDK application located in the `cicd/` directory that defines the pipeline infrastructure as code
- **Source_Stage**: The first pipeline stage that pulls source code from GitHub on commits to `main`
- **Test_Stage**: The pipeline stage that executes backend and frontend unit tests and publishes test reports
- **Build_Stage**: The pipeline stage that creates deployment artifacts for the SAM backend and frontend bundle
- **Approval_Stage**: The pipeline stage that pauses execution until a manual approval is granted
- **Deploy_Stage**: The pipeline stage that deploys the SAM backend stack and the frontend assets to Amplify Hosting
- **Smoke_Test_Stage**: The final pipeline stage that verifies the deployed application works end-to-end using a headless browser
- **GitHub_Connection**: An AWS CodeStar Connections resource that authenticates with the GitHub repository
- **SAM_Backend**: The serverless backend defined in `backend/template.yaml` deployed via SAM CLI
- **Frontend_Bundle**: The esbuild-bundled JavaScript application and static assets deployed to Amplify Hosting
- **Amplify_App**: The AWS Amplify Hosting application that serves the frontend static assets
- **Test_Report**: A CodeBuild test report that captures unit test results in a viewable format

## Requirements

### Requirement 1: CDK Project Structure

**User Story:** As a developer, I want the CI/CD infrastructure defined as a CDK project in a dedicated directory, so that pipeline changes are version-controlled and reproducible.

#### Acceptance Criteria

1. THE CDK_Project SHALL reside in a `cicd/` directory at the repository root
2. THE CDK_Project SHALL use TypeScript as the programming language and SHALL include a `tsconfig.json` that enables strict type checking
3. THE CDK_Project SHALL define a single CDK stack containing the pipeline and its deployment stages as the only stack synthesized by the application
4. THE CDK_Project SHALL target the `eu-west-1` region for all deployed resources
5. THE CDK_Project SHALL use the `aws-cdk-lib/pipelines` module for pipeline construction
6. THE CDK_Project SHALL include a `cdk.json` file at the `cicd/` directory root that specifies the application entry point
7. THE CDK_Project SHALL include a `package.json` declaring `aws-cdk-lib`, `constructs`, and `typescript` as dependencies, and SHALL produce a successful synthesis when `cdk synth` is executed from the `cicd/` directory

### Requirement 2: Source Stage Configuration

**User Story:** As a developer, I want the pipeline triggered automatically when code is pushed to the `main` branch, so that deployments happen without manual intervention.

#### Acceptance Criteria

1. THE Source_Stage SHALL use a GitHub_Connection in AVAILABLE status to authenticate with the GitHub repository
2. WHEN a commit is pushed to the `main` branch, THE Pipeline SHALL trigger a new execution automatically via the CodeStar Connection webhook detection mechanism
3. THE Source_Stage SHALL retrieve all files at the HEAD of the `main` branch as the source output artifact, excluding git history
4. THE CDK_Project SHALL define the GitHub_Connection as a CodeStar Connections resource
5. THE Source_Stage SHALL be configured to trigger exclusively on changes to the `main` branch and not on changes to other branches
6. IF the GitHub_Connection is not in AVAILABLE status when a push event occurs, THEN THE Pipeline SHALL not trigger and the connection status SHALL be verifiable through the CodeStar Connections console

### Requirement 3: Test Stage Execution

**User Story:** As a developer, I want the pipeline to run all unit tests and report results, so that broken code does not proceed to deployment.

#### Acceptance Criteria

1. WHEN the Test_Stage executes, THE Pipeline SHALL install dependencies for each backend Lambda function directory (draw-lambda, seed-lambda) using npm
2. WHEN the Test_Stage executes, THE Pipeline SHALL install dependencies for the frontend using npm
3. WHEN backend dependencies are installed, THE Pipeline SHALL run backend unit tests using the Node.js test runner with JUnit XML reporter output
4. WHEN frontend dependencies are installed, THE Pipeline SHALL run frontend unit tests using Vitest with JUnit XML reporter output
5. WHEN the Test_Stage executes, THE Pipeline SHALL publish backend and frontend test results as a Test_Report in CodeBuild using the JUnit XML report format
6. IF any test fails, THEN THE Pipeline SHALL mark the stage as failed and prevent subsequent pipeline stages from executing

### Requirement 4: Build Stage Artifact Creation

**User Story:** As a developer, I want the pipeline to produce deployment-ready artifacts, so that the deploy stage has everything it needs without rebuilding.

#### Acceptance Criteria

1. WHEN the Build_Stage executes, THE Pipeline SHALL run `sam build` to produce the SAM backend artifact
2. WHEN the Build_Stage executes, THE Pipeline SHALL build the frontend bundle using esbuild with the stack output values injected (region, identity pool ID, Lambda function name)
3. WHEN the Build_Stage executes, THE Pipeline SHALL package the frontend static assets and bundle into a deployable zip artifact
4. THE Build_Stage SHALL output both the SAM build directory and the frontend zip as stage artifacts

### Requirement 5: Manual Approval Gate

**User Story:** As a team lead, I want a manual approval step before deployment, so that a human verifies the pipeline should proceed to production.

#### Acceptance Criteria

1. THE Approval_Stage SHALL pause pipeline execution until a designated approver grants approval via the CodePipeline console
2. IF the approval is rejected or times out, THEN THE Pipeline SHALL halt execution and mark the pipeline as failed

### Requirement 6: Backend Deployment

**User Story:** As a developer, I want the pipeline to deploy the SAM backend automatically after approval, so that infrastructure and Lambda functions are updated.

#### Acceptance Criteria

1. WHEN the Deploy_Stage executes, THE Pipeline SHALL deploy the SAM_Backend using `sam deploy` with the configuration from `backend/samconfig.toml`
2. THE Deploy_Stage SHALL deploy to the `eu-west-1` region
3. THE Deploy_Stage SHALL use IAM capabilities required by the SAM template (CAPABILITY_IAM, CAPABILITY_NAMED_IAM)
4. IF the SAM deployment fails, THEN THE Pipeline SHALL halt execution and mark the stage as failed

### Requirement 7: Frontend Deployment

**User Story:** As a developer, I want the pipeline to deploy the frontend to Amplify Hosting after the backend is deployed, so that the frontend uses the latest backend configuration.

#### Acceptance Criteria

1. WHEN the Deploy_Stage executes, THE Pipeline SHALL retrieve stack outputs (IdentityPoolId, SlotFunctionName, AmplifyDefaultUrl) from the deployed SAM_Backend stack
2. WHEN the Deploy_Stage executes, THE Pipeline SHALL upload the frontend zip artifact to the Amplify_App using the Amplify create-deployment and start-deployment APIs
3. THE Deploy_Stage SHALL deploy the frontend to the `main` branch of the Amplify_App

### Requirement 8: Post-Deployment Smoke Test

**User Story:** As a developer, I want an automated smoke test after deployment, so that I know the deployed application is functional end-to-end.

#### Acceptance Criteria

1. WHEN the Smoke_Test_Stage executes, THE Pipeline SHALL launch a headless browser and navigate to the deployed Amplify_App URL obtained from the CloudFormation stack output
2. WHEN the page navigation completes, THE Pipeline SHALL wait up to 10 seconds for the element with id "slot_handle" to be visible in the DOM before proceeding with interaction
3. WHEN the Smoke_Test_Stage interacts with the slot machine, THE Pipeline SHALL simulate a mousedown event followed by a mouseup event on the element with id "slot_handle"
4. WHEN the handle interaction is triggered, THE Pipeline SHALL poll for up to 15 seconds until the src attribute of all 3 slot image elements (ids "slot_L", "slot_M", "slot_R") no longer contains "slotpullanimation.gif" and is not empty
5. IF the page fails to load within 10 seconds or any slot image element src still contains "slotpullanimation.gif" after the 15-second polling period, THEN THE Pipeline SHALL mark the stage as failed
6. THE Smoke_Test_Stage SHALL complete within 60 seconds

### Requirement 9: Pipeline IAM Permissions

**User Story:** As a security engineer, I want the pipeline to operate with least-privilege permissions, so that the CI/CD process does not have unnecessary access.

#### Acceptance Criteria

1. THE Pipeline SHALL use a dedicated IAM role for each CodeBuild project
2. THE Pipeline SHALL grant the deploy role permissions to deploy CloudFormation stacks, manage Lambda functions, DynamoDB tables, Cognito resources, Amplify apps, and IAM roles required by the SAM template
3. THE Pipeline SHALL grant the smoke test role only permissions to read Amplify app configuration
4. THE Pipeline SHALL not use wildcard resource ARNs for Lambda invoke, DynamoDB, or Cognito permissions

### Requirement 10: Pipeline Observability

**User Story:** As an operations engineer, I want visibility into pipeline execution status, so that failures are detected and diagnosed quickly.

#### Acceptance Criteria

1. THE Pipeline SHALL retain CodeBuild logs in CloudWatch Logs for a minimum of 30 days
2. THE Pipeline execution history SHALL be viewable through the CodePipeline console
