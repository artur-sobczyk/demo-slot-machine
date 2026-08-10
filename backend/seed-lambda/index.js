import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import https from 'https';
import http from 'http';
import { URL } from 'url';
import { writeSeedRecords } from './seed-records.js';

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
  const isHttps = parsedUrl.protocol === 'https:';
  const transport = isHttps ? https : http;

  const options = {
    hostname: parsedUrl.hostname,
    port: parsedUrl.port || (isHttps ? 443 : 80),
    path: parsedUrl.pathname + parsedUrl.search,
    method: 'PUT',
    headers: {
      'Content-Type': '',
      'Content-Length': Buffer.byteLength(responseBody),
    },
  };

  return new Promise((resolve, reject) => {
    const req = transport.request(options, () => resolve());
    req.on('error', (err) => reject(err));
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

  try {
    const writtenCount = await writeSeedRecords(client, tableName);

    if (writtenCount === 0) {
      await sendResponse(event, 'FAILED', 'No records were written to the table');
      return;
    }

    await sendResponse(
      event,
      'SUCCESS',
      `Successfully wrote ${writtenCount} records to ${tableName}`
    );
  } catch (err) {
    console.error('Seed failed:', err);
    await sendResponse(
      event,
      'FAILED',
      `Failed to write record: ${err.message}`
    );
  }
};
