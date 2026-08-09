import { DynamoDBClient, GetItemCommand } from '@aws-sdk/client-dynamodb';

const TABLE_NAME = process.env.TABLE_NAME;

if (!TABLE_NAME) {
  throw new Error('Required TABLE_NAME configuration is missing');
}

const clientConfig = {};
if (process.env.DYNAMODB_ENDPOINT) {
  clientConfig.endpoint = process.env.DYNAMODB_ENDPOINT;
  clientConfig.credentials = {
    accessKeyId: 'local',
    secretAccessKey: 'local',
  };
  clientConfig.region = 'eu-west-1';
}

const dynamoDbClient = new DynamoDBClient(clientConfig);

/**
 * Determines if all three slot values are identical (a winner).
 * Exported separately for testability.
 */
export function determineWinner(left, middle, right) {
  return left === middle && left === right;
}

async function getRandomSlotPosition() {
  const position = Math.floor(Math.random() * 11);

  const command = new GetItemCommand({
    TableName: TABLE_NAME,
    Key: {
      slotPosition: { N: position.toString() },
    },
  });

  const response = await dynamoDbClient.send(command);
  return response.Item.imageFile.S;
}

export const handler = async () => {
  try {
    const [left, middle, right] = await Promise.all([
      getRandomSlotPosition(),
      getRandomSlotPosition(),
      getRandomSlotPosition(),
    ]);

    return {
      isWinner: determineWinner(left, middle, right),
      leftWheelImage: { file: { S: left } },
      middleWheelImage: { file: { S: middle } },
      rightWheelImage: { file: { S: right } },
    };
  } catch (error) {
    console.error('Error retrieving slot data:', error);
    return { error: 'Could not retrieve slot data' };
  }
};
