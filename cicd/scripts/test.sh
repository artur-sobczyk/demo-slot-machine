#!/bin/bash
set -euo pipefail

# Upgrade to Node.js 20 (CodeBuild standard:7.0 ships with Node 18)
n 20
hash -r

# Install backend dependencies (including AWS SDK needed for tests)
cd backend/draw-lambda && npm install @aws-sdk/client-dynamodb
cd ../..
cd backend/seed-lambda && npm install @aws-sdk/client-dynamodb
cd ../..

# Install frontend dependencies
cd frontend && npm ci
cd ..

# Run backend tests with JUnit reporter
cd backend/draw-lambda && node --test --test-reporter=spec --test-reporter-destination=stdout --test-reporter=junit --test-reporter-destination=../../backend-results.xml
cd ../..
cd backend/seed-lambda && node --test --test-reporter=spec --test-reporter-destination=stdout --test-reporter=junit --test-reporter-destination=../../backend-seed-results.xml
cd ../..

# Run frontend tests with JUnit reporter
cd frontend && npx vitest run --reporter=junit --outputFile=../frontend-results.xml
cd ..
