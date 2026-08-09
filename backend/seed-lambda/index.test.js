import { describe, it, mock, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

// We need to set TABLE_NAME before importing the handler
// but the handler module has side effects, so we test via dynamic import

describe('seed-lambda handler', () => {
  let responseServer;
  let receivedResponses;
  let serverUrl;

  beforeEach(async () => {
    receivedResponses = [];

    // Create a local HTTP server to capture CloudFormation responses
    responseServer = http.createServer((req, res) => {
      let body = '';
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', () => {
        receivedResponses.push(JSON.parse(body));
        res.writeHead(200);
        res.end();
      });
    });

    await new Promise((resolve) => responseServer.listen(0, resolve));
    const port = responseServer.address().port;
    serverUrl = `http://localhost:${port}/response`;
  });

  afterEach(() => {
    responseServer.close();
  });

  function makeEvent(requestType) {
    return {
      RequestType: requestType,
      ResponseURL: serverUrl,
      StackId: 'arn:aws:cloudformation:eu-west-1:123:stack/test/guid',
      RequestId: 'test-request-id',
      ResourceType: 'Custom::SeedData',
      LogicalResourceId: 'SeedDataCustomResource',
    };
  }

  it('sends SUCCESS on Delete without writing records', async () => {
    process.env.TABLE_NAME = 'TestTable';

    // Dynamic import to pick up env var
    const { handler } = await import('./index.js?t=' + Date.now());

    // Mock the DynamoDB client in the module — since writeSeedRecords is called
    // we need to verify via the response
    await handler(makeEvent('Delete'));

    // Give the HTTP response time to arrive
    await new Promise((r) => setTimeout(r, 50));

    assert.equal(receivedResponses.length, 1);
    assert.equal(receivedResponses[0].Status, 'SUCCESS');
    assert.match(receivedResponses[0].Reason, /Delete/i);

    delete process.env.TABLE_NAME;
  });

  it('sends FAILED when TABLE_NAME is not set', async () => {
    const originalTableName = process.env.TABLE_NAME;
    delete process.env.TABLE_NAME;

    // Force fresh import
    const mod = await import('./index.js?t=noenv' + Date.now());

    await mod.handler(makeEvent('Create'));

    await new Promise((r) => setTimeout(r, 50));

    assert.equal(receivedResponses.length, 1);
    assert.equal(receivedResponses[0].Status, 'FAILED');
    assert.match(receivedResponses[0].Reason, /TABLE_NAME/);

    if (originalTableName) process.env.TABLE_NAME = originalTableName;
  });
});
