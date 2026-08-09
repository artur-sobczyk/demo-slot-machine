import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock AWS SDK modules
vi.mock('@aws-sdk/client-lambda', () => ({
  LambdaClient: vi.fn().mockImplementation(() => ({
    send: vi.fn(),
  })),
  InvokeCommand: vi.fn(),
}));

vi.mock('@aws-sdk/client-cognito-identity', () => ({
  CognitoIdentityClient: vi.fn().mockImplementation(() => ({
    send: vi.fn(),
  })),
  GetIdCommand: vi.fn(),
  GetCredentialsForIdentityCommand: vi.fn(),
}));

// Mock DOM
function setupDOM() {
  document.body.innerHTML = `
    <img id="slot_L" src="hart_q.png" />
    <img id="slot_M" src="hart_q.png" />
    <img id="slot_R" src="hart_q.png" />
    <img id="slot_handle" src="lever-up.png" />
    <img id="winner_light" src="winner.png" style="visibility: hidden;" />
  `;
}

describe('pullHandle', () => {
  beforeEach(() => {
    setupDOM();
  });

  it('changes handle image to lever-dn when not spinning', async () => {
    // Import after mocks are set up
    await import('./app.js');

    window.pullHandle();
    const handle = document.getElementById('slot_handle');
    expect(handle.src).toContain('lever-dn.png');
  });
});

describe('initiatePull', () => {
  beforeEach(() => {
    setupDOM();
    vi.clearAllMocks();
  });

  it('sets all wheels to spinning animation', async () => {
    const { CognitoIdentityClient } = await import('@aws-sdk/client-cognito-identity');
    const mockCognitoSend = vi.fn()
      .mockResolvedValueOnce({ IdentityId: 'test-identity' })
      .mockResolvedValueOnce({
        Credentials: {
          AccessKeyId: 'AKID',
          SecretKey: 'secret',
          SessionToken: 'token',
          Expiration: new Date(Date.now() + 3600000),
        },
      });
    CognitoIdentityClient.mockImplementation(() => ({ send: mockCognitoSend }));

    const { LambdaClient } = await import('@aws-sdk/client-lambda');
    const payload = JSON.stringify({
      isWinner: false,
      leftWheelImage: { file: { S: 'spad_a.png' } },
      middleWheelImage: { file: { S: 'hart_k.png' } },
      rightWheelImage: { file: { S: 'diam_q.png' } },
    });
    const mockLambdaSend = vi.fn().mockResolvedValue({
      Payload: new TextEncoder().encode(payload),
    });
    LambdaClient.mockImplementation(() => ({ send: mockLambdaSend }));

    // Re-import to pick up new mocks
    vi.resetModules();
    await import('./app.js');

    await window.initiatePull();

    const slotL = document.getElementById('slot_L');
    const slotM = document.getElementById('slot_M');
    const slotR = document.getElementById('slot_R');

    // After pull completes, images should be the result
    expect(slotL.src).toContain('spad_a.png');
    expect(slotM.src).toContain('hart_k.png');
    expect(slotR.src).toContain('diam_q.png');
  });
});

describe('winner display', () => {
  beforeEach(() => {
    setupDOM();
    vi.clearAllMocks();
  });

  it('shows winner light when isWinner is true', async () => {
    const { CognitoIdentityClient } = await import('@aws-sdk/client-cognito-identity');
    CognitoIdentityClient.mockImplementation(() => ({
      send: vi.fn()
        .mockResolvedValueOnce({ IdentityId: 'id' })
        .mockResolvedValueOnce({
          Credentials: {
            AccessKeyId: 'AK', SecretKey: 'SK', SessionToken: 'ST',
            Expiration: new Date(Date.now() + 3600000),
          },
        }),
    }));

    const { LambdaClient } = await import('@aws-sdk/client-lambda');
    const payload = JSON.stringify({
      isWinner: true,
      leftWheelImage: { file: { S: 'spad_a.png' } },
      middleWheelImage: { file: { S: 'spad_a.png' } },
      rightWheelImage: { file: { S: 'spad_a.png' } },
    });
    LambdaClient.mockImplementation(() => ({
      send: vi.fn().mockResolvedValue({ Payload: new TextEncoder().encode(payload) }),
    }));

    vi.resetModules();
    await import('./app.js');
    await window.initiatePull();

    const winnerLight = document.getElementById('winner_light');
    expect(winnerLight.style.visibility).toBe('visible');
  });

  it('hides winner light when isWinner is false', async () => {
    const { CognitoIdentityClient } = await import('@aws-sdk/client-cognito-identity');
    CognitoIdentityClient.mockImplementation(() => ({
      send: vi.fn()
        .mockResolvedValueOnce({ IdentityId: 'id' })
        .mockResolvedValueOnce({
          Credentials: {
            AccessKeyId: 'AK', SecretKey: 'SK', SessionToken: 'ST',
            Expiration: new Date(Date.now() + 3600000),
          },
        }),
    }));

    const { LambdaClient } = await import('@aws-sdk/client-lambda');
    const payload = JSON.stringify({
      isWinner: false,
      leftWheelImage: { file: { S: 'spad_a.png' } },
      middleWheelImage: { file: { S: 'hart_k.png' } },
      rightWheelImage: { file: { S: 'diam_q.png' } },
    });
    LambdaClient.mockImplementation(() => ({
      send: vi.fn().mockResolvedValue({ Payload: new TextEncoder().encode(payload) }),
    }));

    vi.resetModules();
    await import('./app.js');
    await window.initiatePull();

    const winnerLight = document.getElementById('winner_light');
    expect(winnerLight.style.visibility).toBe('hidden');
  });
});
