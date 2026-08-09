import {
  DynamoDBClient,
  CreateTableCommand,
  DeleteTableCommand,
  DescribeTableCommand,
  PutItemCommand,
  waitUntilTableExists,
} from '@aws-sdk/client-dynamodb';

const TABLE_NAME = 'SlotPositionTable';
const ENDPOINT = 'http://localhost:4566';

const SLOT_DATA = [
  { slotPosition: 0, imageFile: 'spad_a.png' },
  { slotPosition: 1, imageFile: 'spad_k.png' },
  { slotPosition: 2, imageFile: 'spad_q.png' },
  { slotPosition: 3, imageFile: 'spad_j.png' },
  { slotPosition: 4, imageFile: 'hart_a.png' },
  { slotPosition: 5, imageFile: 'hart_k.png' },
  { slotPosition: 6, imageFile: 'hart_q.png' },
  { slotPosition: 7, imageFile: 'hart_j.png' },
  { slotPosition: 8, imageFile: 'diam_a.png' },
  { slotPosition: 9, imageFile: 'diam_k.png' },
  { slotPosition: 10, imageFile: 'diam_q.png' },
];

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

async function deleteTable() {
  console.log(`Deleting existing table "${TABLE_NAME}"...`);
  await client.send(new DeleteTableCommand({ TableName: TABLE_NAME }));
}

async function createTable() {
  console.log(`Creating table "${TABLE_NAME}"...`);
  await client.send(
    new CreateTableCommand({
      TableName: TABLE_NAME,
      KeySchema: [{ AttributeName: 'slotPosition', KeyType: 'HASH' }],
      AttributeDefinitions: [{ AttributeName: 'slotPosition', AttributeType: 'N' }],
      BillingMode: 'PAY_PER_REQUEST',
    })
  );
  await waitUntilTableExists({ client, maxWaitTime: 30 }, { TableName: TABLE_NAME });
  console.log(`Table "${TABLE_NAME}" created.`);
}

async function seedRecords() {
  console.log(`Inserting ${SLOT_DATA.length} records...`);
  for (const record of SLOT_DATA) {
    await client.send(
      new PutItemCommand({
        TableName: TABLE_NAME,
        Item: {
          slotPosition: { N: String(record.slotPosition) },
          imageFile: { S: record.imageFile },
        },
      })
    );
  }
  console.log(`Inserted ${SLOT_DATA.length} records.`);
}

async function main() {
  try {
    if (await tableExists()) {
      await deleteTable();
    }
    await createTable();
    await seedRecords();
    console.log('Local DynamoDB seeding complete.');
  } catch (err) {
    console.error('Seeding failed:', err.message);
    process.exitCode = 1;
  }
}

main();
