import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { SLOT_DATA, writeSeedRecords } from './seed-records.js';

describe('SLOT_DATA', () => {
  it('contains exactly 11 records', () => {
    assert.equal(SLOT_DATA.length, 11);
  });

  it('has positions 0 through 10', () => {
    const positions = SLOT_DATA.map((r) => r.slotPosition).sort((a, b) => a - b);
    assert.deepEqual(positions, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it('all imageFile values match {suit}_{rank}.png pattern', () => {
    const pattern = /^(spad|hart|diam|club)_(a|k|q|j)\.png$/;
    for (const record of SLOT_DATA) {
      assert.match(record.imageFile, pattern, `Invalid imageFile: ${record.imageFile}`);
    }
  });

  it('all imageFile values are at most 50 characters', () => {
    for (const record of SLOT_DATA) {
      assert.ok(record.imageFile.length <= 50, `Too long: ${record.imageFile}`);
    }
  });

  it('all slotPosition values are integers', () => {
    for (const record of SLOT_DATA) {
      assert.equal(Number.isInteger(record.slotPosition), true);
    }
  });
});

describe('writeSeedRecords', () => {
  it('writes all 11 records and returns count', async () => {
    const sentCommands = [];
    const mockClient = {
      send: mock.fn(async (command) => {
        sentCommands.push(command);
      }),
    };

    const count = await writeSeedRecords(mockClient, 'TestTable');

    assert.equal(count, 11);
    assert.equal(sentCommands.length, 11);
  });

  it('passes correct table name in each command', async () => {
    const sentCommands = [];
    const mockClient = {
      send: mock.fn(async (command) => {
        sentCommands.push(command.input);
      }),
    };

    await writeSeedRecords(mockClient, 'MyTable');

    for (const input of sentCommands) {
      assert.equal(input.TableName, 'MyTable');
    }
  });

  it('throws when client.send fails', async () => {
    const mockClient = {
      send: mock.fn(async () => {
        throw new Error('DynamoDB connection refused');
      }),
    };

    await assert.rejects(
      () => writeSeedRecords(mockClient, 'TestTable'),
      { message: 'DynamoDB connection refused' }
    );
  });

  it('writes correct item structure for first record', async () => {
    let capturedInput = null;
    const mockClient = {
      send: mock.fn(async (command) => {
        if (!capturedInput) capturedInput = command.input;
      }),
    };

    await writeSeedRecords(mockClient, 'TestTable');

    assert.deepEqual(capturedInput.Item, {
      slotPosition: { N: '0' },
      imageFile: { S: 'spad_a.png' },
    });
  });
});
