import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';
import https from 'https';
import { URL } from 'url';

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

async function sendResponse(event, status, reason) {
  const responseBody = JSON.stringify({
    Status: status,
    Reason: reason,
    PhysicalResourceId: event.LogicalResourceId || 'SeedDataResource',
    StackId: event.StackId,
    RequestId: event.RequestId,
    LogicalResourceId: event.LogicalResourceId,
  });

  const parsedUrl = new URL(event.ResponseURL);

  const options = {
    hostname: parsedUrl.hostname,
    port: 443,
    path: parsedUrl.pathname + parsedUrl.search,
    method: 'PUT',
    headers: {
      'Content-Type': '',
      'Content-Length': Buffer.byteLength(responseBody),
    },
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      resolve();
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.write(responseBody);
    req.end();
  });
}

export const handler = async (event) => {
  console.log('Received event:', JSON.stringify(event, null, 2));

  if (event.RequestType === 'Delete') {
    await sendResponse(event, 'SUCCESS', 'Delete request - no action required');
    return;
  }

  const tableName = process.env.TABLE_NAME;
  if (!tableName) {
    await sendResponse(event, 'FAILED', 'TABLE_NAME environment variable is not set');
    return;
  }

  const client = new DynamoDBClient();
  let writtenCount = 0;

  for (const record of SLOT_DATA) {
    try {
      await client.send(
        new PutItemCommand({
          TableName: tableName,
          Item: {
            slotPosition: { N: String(record.slotPosition) },
            imageFile: { S: record.imageFile },
          },
        })
      );
      writtenCount++;
    } catch (err) {
      console.error(`Failed to write position ${record.slotPosition}:`, err);
      await sendResponse(
        event,
        'FAILED',
        `Failed to write record at position ${record.slotPosition}: ${err.message}`
      );
      return;
    }
  }

  if (writtenCount === 0) {
    await sendResponse(event, 'FAILED', 'No records were written to the table');
    return;
  }

  await sendResponse(
    event,
    'SUCCESS',
    `Successfully wrote ${writtenCount} records to ${tableName}`
  );
};
