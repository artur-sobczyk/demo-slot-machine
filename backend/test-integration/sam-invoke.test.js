import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';

/**
 * Integration test that invokes the Draw Lambda handler directly
 * against Floci's DynamoDB on port 4566.
 *
 * Prerequisites:
 *   - Floci running: docker compose -f local/docker-compose.yml up -d
 *   - Database seeded: npm run seed-local
 */
describe('Draw Lambda integration - via Floci DynamoDB', () => {
  let handler;

  before(async () => {
    process.env.TABLE_NAME = 'SlotPositionTable';
    process.env.DYNAMODB_ENDPOINT = 'http://localhost:4566';
    const mod = await import('../draw-lambda/app.js');
    handler = mod.handler;
  });

  after(() => {
    delete process.env.TABLE_NAME;
    delete process.env.DYNAMODB_ENDPOINT;
  });

  it('returns a valid slot result with isWinner field', async () => {
    const payload = await handler({});

    assert.ok('isWinner' in payload, 'Response should have isWinner field');
    assert.equal(typeof payload.isWinner, 'boolean');
    assert.ok(payload.leftWheelImage?.file?.S, 'leftWheelImage.file.S should exist');
    assert.ok(payload.middleWheelImage?.file?.S, 'middleWheelImage.file.S should exist');
    assert.ok(payload.rightWheelImage?.file?.S, 'rightWheelImage.file.S should exist');
  });

  it('returns image filenames matching card pattern', async () => {
    const payload = await handler({});
    const pattern = /^(spad|hart|diam|club)_(a|k|q|j)\.png$/;

    assert.match(payload.leftWheelImage.file.S, pattern);
    assert.match(payload.middleWheelImage.file.S, pattern);
    assert.match(payload.rightWheelImage.file.S, pattern);
  });

  it('isWinner is true only when all three images match', async () => {
    const payload = await handler({});
    const left = payload.leftWheelImage.file.S;
    const middle = payload.middleWheelImage.file.S;
    const right = payload.rightWheelImage.file.S;

    if (payload.isWinner) {
      assert.equal(left, middle, 'Winner: left should equal middle');
      assert.equal(left, right, 'Winner: left should equal right');
    } else {
      const allSame = left === middle && left === right;
      assert.equal(allSame, false, 'Non-winner: not all three should match');
    }
  });

  it('returns different results across multiple invocations (randomness)', async () => {
    const results = [];
    for (let i = 0; i < 5; i++) {
      const payload = await handler({});
      results.push(payload.leftWheelImage.file.S + payload.middleWheelImage.file.S + payload.rightWheelImage.file.S);
    }
    const unique = new Set(results);
    // With 11 positions and 3 slots, extremely unlikely to get 5 identical results
    assert.ok(unique.size > 1, 'Multiple invocations should produce varied results');
  });
});
