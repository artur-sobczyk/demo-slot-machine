#!/bin/bash
set -euo pipefail

# Install backend dependencies
cd backend/draw-lambda && npm install
cd ../..
cd backend/seed-lambda && npm install
cd ../..

# Install frontend dependencies
cd frontend && npm ci
cd ..

# Run backend tests with JUnit reporter
cd backend/draw-lambda && node --test --test-reporter=junit --test-reporter-destination=../../backend-results.xml
cd ../..
cd backend/seed-lambda && node --test --test-reporter=junit --test-reporter-destination=../../backend-seed-results.xml
cd ../..

# Run frontend tests with JUnit reporter
cd frontend && npx vitest run --reporter=junit --outputFile=../frontend-results.xml
cd ..
