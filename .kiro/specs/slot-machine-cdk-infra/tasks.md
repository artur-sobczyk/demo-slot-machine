# Implementation Plan: Slot Machine CDK Infrastructure Modernization

## Overview

Modernize the slot machine application's AWS infrastructure from a legacy SAM template (nodejs14.x, SDK v2, S3 static hosting) to a current-generation SAM template using nodejs22.x, AWS SDK v3, Amplify Hosting, and automated DynamoDB seed data via a custom resource. Implementation proceeds incrementally: project structure and configuration first, then core Lambda functions, then infrastructure resources, then local development support, and finally CI/CD.

## Tasks

- [x] 1. Set up project structure, configuration, and core SAM template
  - [x] 1.1 Create the new `template.yaml` SAM template at the project root with `AWS::Serverless-2016-10-31` transform, `CustomDomain` parameter (type String, default empty), and placeholder Resources/Outputs sections. Create `samconfig.toml` with stack name, region, and capabilities. Remove or rename the legacy `template.yml`.
    - Define the SAM template header, transform, description, and parameter
    - Create `samconfig.toml` with `[default.deploy.parameters]` section including `stack_name = "slot-machine-stack"`, `region = "eu-west-1"`, `capabilities = "CAPABILITY_IAM CAPABILITY_NAMED_IAM"`, `parameter_overrides = "CustomDomain="`
    - _Requirements: 1.1, 1.2_

  - [x] 1.2 Create the `seed-data/` directory with a placeholder `index.js` file and create the `.github/workflows/` directory structure
    - Create `seed-data/index.js` with a module export stub
    - Create `.github/workflows/` directory
    - _Requirements: 1.5, 1.6_

- [x] 2. Implement the Slot Lambda function with SDK v3
  - [x] 2.1 Rewrite `src/app.js` using ES module syntax, AWS SDK v3 `@aws-sdk/client-dynamodb`, reading `TABLE_NAME` and optional `DYNAMODB_ENDPOINT` environment variables, implementing the slot pull logic with error handling
    - Use `import { DynamoDBClient, GetItemCommand } from '@aws-sdk/client-dynamodb'`
    - Create DynamoDB client with conditional endpoint override from `DYNAMODB_ENDPOINT` env var
    - Throw error with message "Required TABLE_NAME configuration is missing" if `TABLE_NAME` is not set
    - Implement `getRandomSlotPosition()` async helper that calls GetItem for a random position 0-10
    - Implement `handler` that calls 3 random slot positions, determines winner (all three identical), returns response in backward-compatible format `{ isWinner, leftWheelImage: { file: { S } }, ... }`
    - Return `{ error: "Could not retrieve slot data" }` if DynamoDB is unreachable
    - _Requirements: 4.3, 4.8, 8.7, 9.1, 9.2, 9.3, 9.4, 9.5_

  - [ ]* 2.2 Write property test: Winner determination is correct
    - **Property 1: Winner determination is correct**
    - Use fast-check to generate 3 arbitrary image filename strings
    - Extract winner determination logic into a testable function
    - Assert: result is `true` if and only if all three strings are equal
    - **Validates: Requirements 4.8, 9.4**

  - [ ]* 2.3 Write property test: DynamoDB client endpoint configuration
    - **Property 3: DynamoDB client endpoint configuration**
    - Use fast-check to generate arbitrary valid URL strings
    - Construct DynamoDB client with `DYNAMODB_ENDPOINT` set to generated URL
    - Assert: client config contains the generated endpoint; when absent, uses default
    - **Validates: Requirements 8.7**

  - [ ]* 2.4 Write unit tests for Slot Lambda
    - Test that handler throws when `TABLE_NAME` is not set
    - Test that handler returns error response when DynamoDB is unreachable (mock client)
    - Test winner detection: three identical images → `isWinner: true`
    - Test non-winner: at least one different image → `isWinner: false`
    - Test response structure matches backward-compatible format
    - Use Node.js built-in test runner (`node:test`) with `node:assert`
    - _Requirements: 4.8, 9.4, 9.5_

- [x] 3. Implement the Seed Data custom resource Lambda
  - [x] 3.1 Implement `seed-data/index.js` as the CloudFormation custom resource handler using AWS SDK v3 that writes 11 seed records to DynamoDB on Create/Update, performs no-op on Delete, and reports SUCCESS/FAILED to CloudFormation via the response URL
    - Define `SLOT_DATA` constant array with 11 records (positions 0-10 mapped to card image filenames)
    - Use `BatchWriteItemCommand` or individual `PutItemCommand` calls to write records
    - On Create/Update: write all 11 records, report FAILED if any write fails (include which position failed), report FAILED if no records written
    - On Delete: send SUCCESS immediately without writing
    - Use Node.js built-in `https` module to PUT response to `event.ResponseURL`
    - Read table name from `TABLE_NAME` environment variable
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [ ]* 3.2 Write property test: Seed data records satisfy schema constraints
    - **Property 2: Seed data records satisfy schema constraints**
    - For each record in the SLOT_DATA array, assert: `slotPosition` is integer in [0, 10], `imageFile` is non-empty string ≤ 50 chars matching `{suit}_{rank}.png` pattern
    - **Validates: Requirements 3.1, 3.3**

  - [ ]* 3.3 Write unit tests for Seed Data Lambda
    - Test that on Create event all 11 records are written to DynamoDB (mock client)
    - Test that on Delete event SUCCESS is sent without any DynamoDB writes
    - Test that on write failure FAILED is sent with position-specific error message
    - Test that when no records are written FAILED is sent with "no records written" message
    - Use Node.js built-in test runner (`node:test`) with `node:assert`
    - _Requirements: 3.4, 3.5_

- [x] 4. Checkpoint - Verify Lambda implementations
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Define DynamoDB table and Seed custom resource in SAM template
  - [x] 5.1 Add the DynamoDB table resource to `template.yaml` with table name "SlotPositionTable", partition key "slotPosition" (Number), on-demand billing, and DeletionPolicy Delete
    - Use `AWS::DynamoDB::Table` resource type (not SimpleTable)
    - Set `BillingMode: PAY_PER_REQUEST`
    - Set `DeletionPolicy: Delete`
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 5.2 Add the Seed Data Lambda function and custom resource to `template.yaml`
    - Define `SeedDataFunction` as `AWS::Serverless::Function` with runtime nodejs22.x, CodeUri `seed-data/`, handler `index.handler`, and DynamoDB write policy scoped to SlotPositionTable
    - Pass `TABLE_NAME` environment variable referencing the table resource
    - Define `SeedDataCustomResource` as `AWS::CloudFormation::CustomResource` with ServiceToken referencing SeedDataFunction ARN
    - Add DependsOn to ensure table is created before seed runs
    - _Requirements: 3.1, 3.2_

- [x] 6. Define Slot Lambda function resource in SAM template
  - [x] 6.1 Add the SlotPositionFunction resource to `template.yaml` with nodejs22.x runtime, CodeUri `src/`, handler `app.handler`, 128 MB memory, 10 second timeout, DynamoDBReadPolicy, and TABLE_NAME environment variable
    - Use `AWS::Serverless::Function` resource type
    - Set `MemorySize: 128`, `Timeout: 10`
    - Use `DynamoDBReadPolicy` SAM policy template scoped to table resource
    - Set `TABLE_NAME` environment variable via `!Ref` to the DynamoDB table
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 9.1, 9.3_

- [x] 7. Define Cognito Identity Pool and IAM role in SAM template
  - [x] 7.1 Add the Cognito Identity Pool, unauthenticated IAM role, and IdentityPoolRoleAttachment resources to `template.yaml`
    - Create `AWS::Cognito::IdentityPool` with `AllowUnauthenticatedIdentities: true`
    - Create IAM role with trust policy for `cognito-identity.amazonaws.com` federated principal, `sts:AssumeRoleWithWebIdentity` action, and condition restricting `cognito-identity.amazonaws.com:aud` to the identity pool ID
    - Set identity policy allowing only `lambda:InvokeFunction` on the SlotPositionFunction ARN
    - Create `AWS::Cognito::IdentityPoolRoleAttachment` mapping unauthenticated role
    - _Requirements: 5.1, 5.2, 5.3, 5.5_

- [x] 8. Define Amplify Hosting resources in SAM template
  - [x] 8.1 Add the Amplify App, Branch, and conditional Domain resources to `template.yaml`
    - Create `AWS::Amplify::App` with `Platform: WEB` and no repository connection
    - Create `AWS::Amplify::Branch` for main branch
    - Use a CloudFormation condition to create `AWS::Amplify::Domain` only when `CustomDomain` parameter is non-empty
    - _Requirements: 6.1, 6.3, 6.4, 6.5_

- [x] 9. Define stack outputs in SAM template
  - [x] 9.1 Add all required stack outputs to `template.yaml`: IdentityPoolId, SlotFunctionName, AmplifyDefaultUrl, SlotTableName
    - Output the Identity Pool ID with key "IdentityPoolId"
    - Output the Lambda function name with key "SlotFunctionName"
    - Output the Amplify app default URL with key "AmplifyDefaultUrl"
    - Output the DynamoDB table name with key "SlotTableName"
    - _Requirements: 5.4, 7.1, 7.2, 7.3, 7.4_

- [x] 10. Checkpoint - Validate SAM template
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Set up local development environment
  - [x] 11.1 Create `docker-compose.yml` at project root with DynamoDB Local service exposed on port 8000
    - Use `amazon/dynamodb-local:latest` image
    - Set `command: "-jar DynamoDBLocal.jar -sharedDb"`
    - Map port `8000:8000`
    - _Requirements: 1.7, 8.1, 8.4_

  - [x] 11.2 Create `seed-data/seed-local.js` script that creates the SlotPositionTable on DynamoDB Local and populates it with the 11 seed records
    - Use AWS SDK v3 DynamoDB client pointing to `http://localhost:8000`
    - Create table with partition key `slotPosition` (Number) and PAY_PER_REQUEST billing
    - Insert all 11 records matching production seed data
    - Handle table-already-exists gracefully (delete and recreate, or skip creation)
    - _Requirements: 8.2, 8.5_

  - [x] 11.3 Create a `README.md` file documenting local development setup with Finch, including instructions for `finch compose up`, seeding the database, and invoking the Lambda locally with `sam local invoke` using `SAM_CLI_CONTAINER_RUNTIME=finch`
    - Document prerequisite: Finch installed
    - Document step-by-step: start DynamoDB Local, run seed script, invoke Lambda
    - Include example `sam local invoke` command with environment variable override for `DYNAMODB_ENDPOINT=http://host.docker.internal:8000`
    - _Requirements: 8.3, 8.6_

- [ ] 12. Create GitHub Actions deployment workflow
  - [ ] 12.1 Create `.github/workflows/deploy.yml` with a deployment job triggered on push to main that uses OIDC-based AWS credential assumption, `sam build`, and `sam deploy`
    - Trigger on `push` to `main` branch
    - Use `aws-actions/configure-aws-credentials` with `role-to-assume` (OIDC)
    - Run `sam build` then `sam deploy --no-confirm-changeset --no-fail-on-empty-changeset`
    - Include placeholder for the IAM role ARN
    - _Requirements: 10.1, 10.2, 10.3, 10.4_

- [ ] 13. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The Slot Lambda response format preserves backward compatibility with the existing frontend `displayPull()` function
- The seed data Lambda uses Node.js built-in `https` module for CloudFormation response (no external dependencies)
- The GitHub Actions workflow includes a placeholder IAM role ARN that must be replaced with the actual OIDC role after AWS setup

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["2.1", "3.1"] },
    { "id": 2, "tasks": ["2.2", "2.3", "2.4", "3.2", "3.3"] },
    { "id": 3, "tasks": ["5.1", "11.1"] },
    { "id": 4, "tasks": ["5.2", "6.1", "11.2"] },
    { "id": 5, "tasks": ["7.1", "8.1", "11.3", "12.1"] },
    { "id": 6, "tasks": ["9.1"] }
  ]
}
```
