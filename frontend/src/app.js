import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { CognitoIdentityClient, GetIdCommand, GetCredentialsForIdentityCommand } from '@aws-sdk/client-cognito-identity';

const REGION = '{{AWS_REGION}}';
const IDENTITY_POOL_ID = '{{IDENTITY_POOL_ID}}';
const FUNCTION_NAME = '{{SLOT_FUNCTION_NAME}}';

const cognitoClient = new CognitoIdentityClient({ region: REGION });

async function getCredentials() {
  const { IdentityId } = await cognitoClient.send(
    new GetIdCommand({ IdentityPoolId: IDENTITY_POOL_ID })
  );
  const { Credentials } = await cognitoClient.send(
    new GetCredentialsForIdentityCommand({ IdentityId })
  );
  return {
    accessKeyId: Credentials.AccessKeyId,
    secretAccessKey: Credentials.SecretKey,
    sessionToken: Credentials.SessionToken,
    expiration: Credentials.Expiration,
  };
}

let cachedCredentials = null;

async function resolveCredentials() {
  if (!cachedCredentials || cachedCredentials.expiration < new Date()) {
    cachedCredentials = await getCredentials();
  }
  return cachedCredentials;
}

let isSpinning = false;

window.pullHandle = function () {
  if (!isSpinning) {
    document.getElementById('slot_handle').src = 'lever-dn.png';
  }
};

window.initiatePull = async function () {
  const slotHandle = document.getElementById('slot_handle');
  const slotL = document.getElementById('slot_L');
  const slotM = document.getElementById('slot_M');
  const slotR = document.getElementById('slot_R');
  const winnerLight = document.getElementById('winner_light');

  slotHandle.src = 'lever-up.png';
  slotL.src = 'slotpullanimation.gif';
  slotM.src = 'slotpullanimation.gif';
  slotR.src = 'slotpullanimation.gif';

  isSpinning = true;

  try {
    const credentials = await resolveCredentials();
    const lambdaClient = new LambdaClient({
      region: REGION,
      credentials,
    });

    const command = new InvokeCommand({
      FunctionName: FUNCTION_NAME,
      InvocationType: 'RequestResponse',
    });

    const response = await lambdaClient.send(command);
    const payload = JSON.parse(new TextDecoder().decode(response.Payload));

    isSpinning = false;

    if (payload.isWinner) {
      winnerLight.style.visibility = 'visible';
    } else {
      winnerLight.style.visibility = 'hidden';
    }

    slotL.src = payload.leftWheelImage.file.S;
    slotM.src = payload.middleWheelImage.file.S;
    slotR.src = payload.rightWheelImage.file.S;
  } catch (error) {
    isSpinning = false;
    console.error('Pull failed:', error);
  }
};
