import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

describe('determineWinner', () => {
  let determineWinner;

  beforeEach(async () => {
    // Set TABLE_NAME so the module loads without throwing
    process.env.TABLE_NAME = 'TestTable';
    const mod = await import('./app.js?t=' + Date.now());
    determineWinner = mod.determineWinner;
  });

  afterEach(() => {
    delete process.env.TABLE_NAME;
  });

  it('returns true when all three values are identical', () => {
    assert.equal(determineWinner('spad_a.png', 'spad_a.png', 'spad_a.png'), true);
  });

  it('returns false when left differs', () => {
    assert.equal(determineWinner('hart_a.png', 'spad_a.png', 'spad_a.png'), false);
  });

  it('returns false when middle differs', () => {
    assert.equal(determineWinner('spad_a.png', 'hart_a.png', 'spad_a.png'), false);
  });

  it('returns false when right differs', () => {
    assert.equal(determineWinner('spad_a.png', 'spad_a.png', 'hart_a.png'), false);
  });

  it('returns false when all three are different', () => {
    assert.equal(determineWinner('spad_a.png', 'hart_k.png', 'diam_q.png'), false);
  });

  it('returns true for empty strings (edge case)', () => {
    assert.equal(determineWinner('', '', ''), true);
  });
});

describe('handler - missing TABLE_NAME', () => {
  it('throws when TABLE_NAME is not set', async () => {
    delete process.env.TABLE_NAME;

    await assert.rejects(
      async () => await import('./app.js?t=missing' + Date.now()),
      (err) => {
        assert.match(err.message, /TABLE_NAME/);
        return true;
      }
    );
  });
});
