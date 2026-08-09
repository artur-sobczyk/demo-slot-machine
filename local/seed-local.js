import {
  DynamoDBClient,
  CreateTableCommand,
  DeleteTableCommand,
  DescribeTableCommand,
} from '@aws-sdk/client-dynamodb';
import { writeSeedRecords } from '../backend/seed-lambda/seed-records.js';

const TABLE_NAME = 'SlotPositionTable';
const ENDPOINT = 'http://localhost:4566';

const client = new DynamoDBClient({
  endpoint: ENDPOINT,
  region: 'eu-west-1',
  credentials: {
    accessKeyId: 'local',
    secretAccessKey: 'local',
  },
});

async function tableExists() {
  try {
    await client.send(new DescribeTableCommand({ TableName: TABLE_NAME }));
    return true;
  } catch (err) {
    if (err.name === 'ResourceNotFoundException') {
      return false;
    }
    throw err;
  }
}

async function recreateTable() {
  if (await tableExists()) {
    console.log(`Deleting existing table "${TABLE_NAME}"...`);
    await client.send(new DeleteTableCommand({ TableName: TABLE_NAME }));
  }

  console.log(`Creating table "${TABLE_NAME}"...`);
  await client.send(
    new CreateTableCommand({
      TableName: TABLE_NAME,
      KeySchema: [{ AttributeName: 'slotPosition', KeyType: 'HASH' }],
      AttributeDefinitions: [{ AttributeName: 'slotPosition', AttributeType: 'N' }],
      BillingMode: 'PAY_PER_REQUEST',
    })
  );
  console.log(`Table "${TABLE_NAME}" created.`);
}

async function main() {
  try {
    await recreateTable();
    const count = await writeSeedRecords(client, TABLE_NAME);
    console.log(`Inserted ${count} records. Local DynamoDB seeding complete.`);
  } catch (err) {
    console.error('Seeding failed:', err.message);
    process.exitCode = 1;
  }
}

main();
