# Requirements Document

## Introduction

This feature modernizes the existing slot machine application's AWS SAM template. The infrastructure includes an Amplify Hosting app (replacing S3 static hosting) with a custom domain parameter, a Cognito Identity Pool for unauthenticated frontend access, a Lambda function upgraded to nodejs22.x with AWS SDK v3, and a DynamoDB table with seed data populated via a custom resource. The project uses a SAM template at the root for infrastructure definition, supports local development with `sam local invoke` using Finch as the container runtime, and includes a GitHub Actions deployment pipeline placeholder.

## Glossary

- **SAM_Template**: The AWS SAM template file (`template.yaml`) at the project root that defines all infrastructure resources for the slot machine application using the `AWS::Serverless-2016-10-31` transform
- **Amplify_App**: The AWS Amplify Hosting application that serves the static frontend content
- **Identity_Pool**: The Amazon Cognito Identity Pool that provides temporary AWS credentials to unauthenticated users
- **Slot_Lambda**: The AWS Lambda function that reads random slot positions from the DynamoDB table and returns slot machine results
- **Slot_Table**: The DynamoDB table named "SlotPositionTable" that stores slot position records mapping numeric positions to card image filenames
- **Seed_Resource**: A CloudFormation custom resource defined in the SAM_Template that populates the Slot_Table with initial data during deployment, backed by a Lambda function in the `seed-data/` directory
- **Custom_Domain_Parameter**: A SAM template parameter that accepts the custom domain name for Amplify hosting
- **SAM_Config**: The `samconfig.toml` file at the project root that stores SAM CLI deployment configuration (stack name, region, capabilities, parameter overrides)

## Requirements

### Requirement 1: SAM Project Structure

**User Story:** As a developer, I want the project organized with a SAM template at the root and clear separation of concerns, so that the infrastructure is defined declaratively and supports both local development and CI/CD deployment.

#### Acceptance Criteria

1. THE SAM_Template SHALL be defined in a `template.yaml` file at the project root using the `AWS::Serverless-2016-10-31` transform
2. THE project SHALL include a `samconfig.toml` file at the project root containing SAM CLI deployment configuration including stack name, region, and capabilities
3. THE project SHALL keep the Lambda function source code in a `src/` directory at the project root
4. THE project SHALL keep the static frontend assets in a `static/` directory at the project root
5. THE project SHALL include a `.github/workflows/` directory at the project root for CI/CD pipeline definitions
6. THE project SHALL include a `seed-data/` directory at the project root containing the DynamoDB seed data definition and the custom resource Lambda function code
7. THE project SHALL include a `docker-compose.yml` file at the project root for running DynamoDB Local during local development

### Requirement 2: DynamoDB Table

**User Story:** As a developer, I want a DynamoDB table provisioned via the SAM template, so that the Lambda function can read slot position data.

#### Acceptance Criteria

1. THE SAM_Template SHALL create a DynamoDB table resource with the table name set to "SlotPositionTable"
2. THE SAM_Template SHALL define the Slot_Table with a partition key named "slotPosition" of type Number and no sort key
3. THE SAM_Template SHALL configure the Slot_Table with on-demand billing mode (PAY_PER_REQUEST)
4. THE SAM_Template SHALL set a DeletionPolicy of Delete on the Slot_Table so that the table is removed when the stack is deleted

### Requirement 3: DynamoDB Seed Data

**User Story:** As a developer, I want the DynamoDB table automatically populated with slot position records during deployment, so that the application is functional immediately after deployment without manual data loading.

#### Acceptance Criteria

1. WHEN the SAM_Template is deployed, THE Seed_Resource SHALL populate the Slot_Table with exactly 11 records mapping positions 0 through 10 to card image filenames, where each "imageFile" value follows the pattern "{suit}_{rank}.png" matching an image present in the static assets
2. THE Seed_Resource SHALL be implemented as a CloudFormation custom resource backed by a Lambda function located in the `seed-data/` directory
3. WHEN the Seed_Resource Lambda executes, THE Seed_Resource SHALL write each record with a "slotPosition" numeric attribute as the partition key and an "imageFile" string attribute with a maximum length of 50 characters
4. IF the Seed_Resource Lambda fails to write any record to the Slot_Table, THEN THE Seed_Resource SHALL report the failure to CloudFormation with a FAILED status and an error message indicating which position failed, causing the stack deployment to roll back
5. IF the Seed_Resource Lambda executes successfully but performs no write operations, THEN THE Seed_Resource SHALL report a FAILED status to CloudFormation with an error message indicating that no records were written, causing the stack deployment to roll back
6. IF the Slot_Table already contains records at the target positions when the Seed_Resource executes, THEN THE Seed_Resource SHALL overwrite existing records with the defined seed data values

### Requirement 4: Lambda Function

**User Story:** As a developer, I want a Lambda function deployed via SAM that reads slot positions from DynamoDB, so that the frontend can invoke it to get slot machine results.

#### Acceptance Criteria

1. THE SAM_Template SHALL create the Slot_Lambda with the runtime set to nodejs22.x
2. THE SAM_Template SHALL deploy the Slot_Lambda with the CodeUri pointing to the `src/` directory
3. THE SAM_Template SHALL configure the Slot_Lambda handler as "app.handler"
4. THE SAM_Template SHALL grant the Slot_Lambda read-only access to the Slot_Table using a SAM policy template (DynamoDBReadPolicy) scoped to the Slot_Table resource
5. THE SAM_Template SHALL set the Slot_Lambda memory to 128 MB
6. THE SAM_Template SHALL set the Slot_Lambda timeout to 10 seconds
7. THE SAM_Template SHALL pass the Slot_Table name to the Slot_Lambda as an environment variable named "TABLE_NAME"
8. IF the Slot_Lambda is invoked and the Slot_Table is unreachable, THEN the Slot_Lambda SHALL return an error response indicating that slot data could not be retrieved

### Requirement 5: Cognito Identity Pool

**User Story:** As a developer, I want a Cognito Identity Pool with unauthenticated access, so that the static frontend can obtain temporary AWS credentials to invoke the Lambda function without requiring user sign-in.

#### Acceptance Criteria

1. THE SAM_Template SHALL create the Identity_Pool with unauthenticated access enabled
2. THE SAM_Template SHALL create an IAM role for unauthenticated identities with a trust policy that allows the `cognito-identity.amazonaws.com` federated principal to perform `sts:AssumeRoleWithWebIdentity`, and an identity policy that permits only the `lambda:InvokeFunction` action on the Slot_Lambda resource ARN
3. THE SAM_Template SHALL attach the unauthenticated IAM role to the Identity_Pool as the default unauthenticated role via an IdentityPoolRoleAttachment resource
4. THE SAM_Template SHALL output the Identity_Pool ID as a stack output named "IdentityPoolId"
5. THE SAM_Template SHALL restrict the unauthenticated IAM role trust policy with a condition that limits the `cognito-identity.amazonaws.com:aud` claim to the created Identity_Pool ID

### Requirement 6: Amplify Hosting

**User Story:** As a developer, I want an Amplify Hosting app that serves the static frontend, so that the slot machine UI is accessible via a custom domain over HTTPS without managing an S3 bucket policy or CloudFront distribution manually.

#### Acceptance Criteria

1. THE SAM_Template SHALL create the Amplify_App configured for manual deployment with no repository connection and platform type set to WEB
2. WHEN the domain configuration is valid and complete, THE SAM_Template SHALL deploy the contents of the `static/` directory to the Amplify_App main branch as a single deployment artifact
3. IF the Custom_Domain_Parameter is provided as a non-empty string but the domain configuration is invalid or incomplete, THEN THE SAM_Template SHALL fail deployment with a clear error indicating the domain configuration issue
3. THE SAM_Template SHALL define the Custom_Domain_Parameter as a template parameter of type String with a default value of empty string
4. IF the Custom_Domain_Parameter value is a non-empty string, THEN THE SAM_Template SHALL associate that domain with the Amplify_App
5. IF the Custom_Domain_Parameter value is empty or not provided, THEN THE SAM_Template SHALL skip domain association and deploy the Amplify_App with only its default URL
6. THE SAM_Template SHALL output the Amplify_App default URL as a stack output with the key "AmplifyDefaultUrl"

### Requirement 7: Stack Outputs

**User Story:** As a developer, I want key resource identifiers exported as CloudFormation outputs, so that I can reference them for frontend configuration and operational visibility.

#### Acceptance Criteria

1. THE SAM_Template SHALL output the Identity_Pool ID with a descriptive output key
2. THE SAM_Template SHALL output the Slot_Lambda function name with a descriptive output key
3. THE SAM_Template SHALL output the Amplify_App default domain URL with a descriptive output key
4. THE SAM_Template SHALL output the Slot_Table name with a descriptive output key

### Requirement 8: Local Development with Finch

**User Story:** As a developer, I want to run DynamoDB Local via docker-compose and invoke the Lambda function locally using SAM CLI with Finch, so that I can test and iterate on the application without deploying to AWS.

#### Acceptance Criteria

1. THE project SHALL include a `docker-compose.yml` file at the project root that defines a DynamoDB Local service compatible with Finch
2. THE project SHALL include a seed script that populates the local DynamoDB Local instance with the same 11 slot position records used in production
3. THE SAM_Template SHALL support invoking the Slot_Lambda locally using `sam local invoke` with the environment variable `SAM_CLI_CONTAINER_RUNTIME=finch` to use Finch as the container runtime
4. THE `docker-compose.yml` SHALL expose DynamoDB Local on port 8000, with automatic fallback to an alternative available port when port 8000 is already occupied
5. THE seed script SHALL create the "SlotPositionTable" table with the correct schema before inserting records
6. THE project SHALL include documentation in a README file explaining how to start the local environment using `finch compose up`, seed the database, and invoke the Lambda function locally with `sam local invoke`
7. THE Slot_Lambda source code SHALL support an optional `DYNAMODB_ENDPOINT` environment variable that overrides the default DynamoDB endpoint, enabling the function to connect to DynamoDB Local when running locally

### Requirement 9: Lambda Runtime and SDK Upgrade

**User Story:** As a developer, I want the Lambda function to use nodejs22.x with AWS SDK v3, so that the application runs on a maintained and secure platform with the current AWS SDK.

#### Acceptance Criteria

1. THE Slot_Lambda SHALL use the nodejs22.x runtime as specified in the SAM_Template function definition
2. THE Slot_Lambda source code SHALL use the AWS SDK v3 DynamoDB client (`@aws-sdk/client-dynamodb`) for all DynamoDB operations and SHALL NOT import or require the AWS SDK v2 (`aws-sdk`) package. Lambda functions that perform no DynamoDB operations MAY omit the SDK v3 client dependency entirely.
3. THE SAM_Template SHALL define a "TABLE_NAME" environment variable on the Slot_Lambda whose value references the DynamoDB table resource name
4. THE Slot_Lambda source code SHALL read the DynamoDB table name exclusively from the "TABLE_NAME" environment variable (`process.env.TABLE_NAME`) instead of using a hardcoded table name
5. IF the "TABLE_NAME" environment variable is not set, THEN THE Slot_Lambda SHALL fail with an error indicating that the required TABLE_NAME configuration is missing

### Requirement 10: GitHub Actions Pipeline

**User Story:** As a developer, I want a GitHub Actions workflow placeholder, so that I have the foundation for automated deployment via CI/CD.

#### Acceptance Criteria

1. THE project SHALL include a GitHub Actions workflow file at `.github/workflows/deploy.yml`
2. THE workflow SHALL define a deployment job that uses `sam build` and `sam deploy` commands
3. THE workflow SHALL use OIDC-based AWS credential assumption (configure-aws-credentials action with role-to-assume) instead of long-lived access keys
4. THE workflow SHALL trigger on push to the main branch

### Requirement 11: Frontend AWS SDK v3 Upgrade

**User Story:** As a developer, I want the frontend to use AWS SDK v3 bundled with esbuild, so that the application uses a supported and maintained SDK with smaller bundle size and modern JavaScript patterns.

#### Acceptance Criteria

1. THE frontend source code SHALL use `@aws-sdk/client-lambda` for Lambda invocations and `@aws-sdk/credential-providers` for Cognito Identity Pool credentials, and SHALL NOT use the AWS SDK v2 CDN bundle (`aws-sdk-2.x.min.js`)
2. THE frontend source code SHALL be located in a `frontend/src/` directory with its own `package.json` defining dependencies and a build script
3. THE frontend build SHALL use esbuild to produce a single bundled and minified JavaScript file (`static/app.bundle.js`) targeting ES2020 browsers
4. THE frontend source SHALL use placeholder tokens (`{{AWS_REGION}}`, `{{IDENTITY_POOL_ID}}`, `{{SLOT_FUNCTION_NAME}}`) that are replaced at build/deploy time with stack-specific values
5. THE `deploy-frontend.sh` script SHALL read CloudFormation stack outputs, replace placeholders in the frontend source, bundle with esbuild, and deploy the result to Amplify Hosting
