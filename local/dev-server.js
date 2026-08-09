import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

// Set environment variables for the Lambda handler (pointing to Floci)
process.env.TABLE_NAME = 'SlotPositionTable';
process.env.DYNAMODB_ENDPOINT = 'http://localhost:4566';

// Import the Lambda handler after env vars are set
const { handler } = await import('../backend/draw-lambda/app.js');

const app = express();
const PORT = 3000;

// Serve the local frontend at root
app.get('/', (req, res) => {
  res.sendFile(path.join(rootDir, 'frontend', 'static', 'index-local.html'));
});

// Serve static frontend assets (images, css, etc.) but skip index.html
app.use(express.static(path.join(rootDir, 'frontend', 'static'), { index: false }));

// Invoke Lambda handler directly (DynamoDB calls go to Floci)
app.post('/pull', async (req, res) => {
  try {
    const result = await handler({});
    res.json(result);
  } catch (error) {
    console.error('Lambda invocation error:', error.message);
    res.status(500).json({ error: 'Could not retrieve slot data' });
  }
});

app.get('/pull', async (req, res) => {
  try {
    const result = await handler({});
    res.json(result);
  } catch (error) {
    console.error('Lambda invocation error:', error.message);
    res.status(500).json({ error: 'Could not retrieve slot data' });
  }
});

app.listen(PORT, () => {
  console.log(`Slot Machine dev server running at http://localhost:${PORT}`);
  console.log(`DynamoDB via Floci: http://localhost:4566`);
  console.log(`\nMake sure Floci is running: docker compose up -d`);
  console.log(`And database is seeded: npm run seed-local`);
});
