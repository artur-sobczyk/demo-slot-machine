import { PutItemCommand } from '@aws-sdk/client-dynamodb';

export const SLOT_DATA = [
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

/**
 * Writes all seed records to the given DynamoDB table.
 * Returns the number of records written.
 * Throws on failure with the position that failed.
 */
export async function writeSeedRecords(client, tableName) {
  let writtenCount = 0;

  for (const record of SLOT_DATA) {
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
  }

  return writtenCount;
}
