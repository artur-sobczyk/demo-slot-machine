# Slot Machine Application

A serverless slot machine game deployed on AWS using SAM, with DynamoDB for data storage, Cognito for unauthenticated access, and Amplify Hosting for the frontend.

## Architecture

- **Backend**: AWS Lambda (nodejs22.x, SDK v3) reading slot positions from DynamoDB
- **Frontend**: Static HTML/CSS/JS bundled with AWS SDK v3 via esbuild
- **Auth**: Cognito Identity Pool providing temporary unauthenticated credentials
- **Hosting**: Amplify Hosting with optional custom domain
- **IaC**: SAM template defining all infrastructure

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) (with Docker Compose)
- [Node.js 22.x](https://nodejs.org/)
- [AWS SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html)

## Local Development

The local environment uses [Floci](https://github.com/floci-io/floci) — a free, open-source AWS emulator running DynamoDB locally on port 4566.

### Quick Start

```bash
# 1. Start Floci (local AWS emulator)
docker compose up -d

# 2. Install dependencies
npm install
cd frontend && npm install && cd ..

# 3. Seed the local database
npm run seed-local

# 4. Start the dev server
npm run dev
```

Open http://localhost:3000 — the full slot machine app is running locally.

### How It Works

- **Floci** (`localhost:4566`) emulates DynamoDB locally
- **Dev server** (`localhost:3000`) serves the frontend and invokes the Lambda handler directly
- DynamoDB operations from the Lambda handler go through Floci
- The local frontend (`index-local.html`) uses `fetch('/pull')` — no AWS credentials needed locally

### View Floci Logs

```bash
docker compose logs -f floci
```

### Stop Local Environment

```bash
docker compose down
```

## Frontend Build

The frontend uses AWS SDK v3, bundled with esbuild into a single `app.bundle.js` file.

### Source

`frontend/src/app.js` — uses `@aws-sdk/client-lambda` and `@aws-sdk/credential-providers` to:
1. Get temporary credentials from Cognito Identity Pool (unauthenticated)
2. Invoke the slot Lambda function
3. Display the results

### Build

```bash
cd frontend
npm install
npm run build
```

This produces `static/app.bundle.js`. The build is run automatically by `deploy-frontend.sh` with stack-specific values injected.

### Placeholders

The source uses placeholders that are replaced at build/deploy time:
- `{{AWS_REGION}}` — AWS region (e.g., `eu-west-1`)
- `{{IDENTITY_POOL_ID}}` — Cognito Identity Pool ID
- `{{SLOT_FUNCTION_NAME}}` — Lambda function name

## Deployment

### 1. Deploy infrastructure

```bash
sam build
sam deploy
```

With custom domain:

```bash
sam deploy --parameter-overrides "CustomDomain=your-domain.com"
```

### 2. Deploy frontend

```bash
npm run deploy-frontend
```

This script:
1. Reads stack outputs (Identity Pool ID, Lambda name, Amplify App ID)
2. Replaces placeholders in the frontend source
3. Bundles with esbuild
4. Uploads and deploys to Amplify Hosting

### 3. DNS setup (custom domain)

If using a custom domain, add CNAME records in your DNS provider. For Route 53:

```bash
aws amplify get-domain-association --app-id YOUR_APP_ID --domain-name your-domain.com --region eu-west-1
```

Add the certificate verification CNAME and the domain CNAME from the output.

### Destroy

```bash
sam delete --region eu-west-1
```

## Project Structure

```
├── src/                    # Slot Lambda function (nodejs22.x, SDK v3)
├── seed-data/              # Seed data Lambda and local seed script
├── frontend/               # Frontend source (SDK v3 + esbuild)
│   ├── src/app.js          # Main frontend code with placeholders
│   └── package.json        # Frontend dependencies and build script
├── static/                 # Static assets (deployed to Amplify)
│   ├── index.html          # Production HTML (loads app.bundle.js)
│   ├── index-local.html    # Local dev HTML (uses fetch /pull)
│   └── app.bundle.js       # Built bundle (gitignored)
├── .github/workflows/      # CI/CD pipeline
├── dev-server.js           # Local development server
├── deploy-local.js         # Deploys Lambda + table to Floci
├── deploy-frontend.sh      # Builds and deploys frontend to Amplify
├── template.yaml           # SAM template (production infrastructure)
├── samconfig.toml          # SAM CLI configuration
├── docker-compose.yml      # Floci (local AWS emulator)
└── package.json            # Root project config
```
