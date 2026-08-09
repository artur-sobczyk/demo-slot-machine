import {
  LambdaClient,
  CreateFunctionCommand,
  UpdateFunctionCodeCommand,
  GetFunctionCommand,
} from '@aws-sdk/client-lambda';
import {
  DynamoDBClient,
  CreateTableCommand,
  DescribeTableCommand,
  DeleteTableCommand,
} from '@aws-sdk/client-dynamodb';
import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ENDPOINT = 'http://localhost:4566';
const REGION = 'eu-west-1';
const TABLE_NAME = 'SlotPositionTable';
const FUNCTION_NAME = 'SlotPositionFunction';

const credentials = { accessKeyId: 'test', secretAccessKey: 'test' };

const lambdaClient = new LambdaClient({ endpoint: ENDPOINT, region: REGION, credentials });
const dynamoClient = new DynamoDBClient({ endpoint: ENDPOINT, region: REGION, credentials });

async function ensureTable() {
  try {
    await dynamoClient.send(new DescribeTableCommand({ TableName: TABLE_NAME }));
    console.log(`Table "${TABLE_NAME}" already exists.`);
  } catch (err) {
    if (err.name === 'ResourceNotFoundException') {
      console.log(`Creating table "${TABLE_NAME}"...`);
      await dynamoClient.send(new CreateTableCommand({
        TableName: TABLE_NAME,
        KeySchema: [{ AttributeName: 'slotPosition', KeyType: 'HASH' }],
        AttributeDefinitions: [{ AttributeName: 'slotPosition', AttributeType: 'N' }],
        BillingMode: 'PAY_PER_REQUEST',
      }));
      console.log(`Table "${TABLE_NAME}" created.`);
    } else {
      throw err;
    }
  }
}

async function createZip() {
  const zipPath = path.join(__dirname, 'src-lambda.zip');
  // Zip the src/ directory contents
  execSync(`tar -a -cf "${zipPath}" -C src .`, { stdio: 'inherit' });
  return readFileSync(zipPath);
}

async function deployLambda(zipBuffer) {
  try {
    await lambdaClient.send(new GetFunctionCommand({ FunctionName: FUNCTION_NAME }));
    // Function exists — update it
    console.log(`Updating function "${FUNCTION_NAME}"...`);
    await lambdaClient.send(new UpdateFunctionCodeCommand({
      FunctionName: FUNCTION_NAME,
      ZipFile: zipBuffer,
    }));
  } catch (err) {
    if (err.name === 'ResourceNotFoundException') {
      // Create new function
      console.log(`Creating function "${FUNCTION_NAME}"...`);
      await lambdaClient.send(new CreateFunctionCommand({
        FunctionName: FUNCTION_NAME,
        Runtime: 'nodejs22.x',
        Handler: 'app.handler',
        Role: 'arn:aws:iam::000000000000:role/lambda-role',
        Code: { ZipFile: zipBuffer },
        Environment: {
          Variables: {
            TABLE_NAME: TABLE_NAME,
            DYNAMODB_ENDPOINT: 'http://host.docker.internal:4566',
          },
        },
        Timeout: 10,
        MemorySize: 128,
      }));
    } else {
      throw err;
    }
  }
  console.log(`Function "${FUNCTION_NAME}" deployed.`);
}

async function main() {
  try {
    await ensureTable();

    console.log('Packaging Lambda...');
    const zipBuffer = await createZip();

    await deployLambda(zipBuffer);

    console.log('\nLocal deployment complete!');
    console.log(`Lambda: ${FUNCTION_NAME}`);
    console.log(`DynamoDB table: ${TABLE_NAME}`);
    console.log(`\nDon't forget to seed: npm run seed-local`);
  } catch (err) {
    console.error('Deployment failed:', err.message);
    process.exitCode = 1;
  }
}

main();
