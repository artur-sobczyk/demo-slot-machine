const puppeteer = require('puppeteer');

async function runSmokeTest() {
  const amplifyUrl = process.env.AMPLIFY_URL;
  if (!amplifyUrl) {
    console.error('AMPLIFY_URL environment variable is not set');
    process.exit(1);
  }

  console.log('Launching headless browser...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  try {
    const page = await browser.newPage();

    console.log('Navigating to:', amplifyUrl);
    await page.goto(amplifyUrl, { waitUntil: 'networkidle2', timeout: 10000 });

    // Wait up to 10 seconds for #slot_handle to be visible
    console.log('Waiting for #slot_handle to be visible...');
    await page.waitForSelector('#slot_handle', { visible: true, timeout: 10000 });

    // Simulate mousedown + mouseup on #slot_handle
    console.log('Simulating mousedown + mouseup on #slot_handle...');
    const handle = await page.$('#slot_handle');
    await page.evaluate((el) => {
      // Call the inline handlers directly (they're global functions set via onMouseDown/onMouseUp attributes)
      if (typeof window.pullHandle === 'function') window.pullHandle();
      if (typeof window.initiatePull === 'function') window.initiatePull();
    }, handle);

    // Poll up to 15 seconds until all slot images have resolved
    console.log('Polling slot images for up to 15 seconds...');
    const pollInterval = 500;
    const maxPollTime = 15000;
    const startTime = Date.now();

    while (Date.now() - startTime < maxPollTime) {
      const slotsSrc = await page.evaluate(() => {
        const slotL = document.querySelector('#slot_L');
        const slotM = document.querySelector('#slot_M');
        const slotR = document.querySelector('#slot_R');
        return {
          L: slotL ? slotL.getAttribute('src') : null,
          M: slotM ? slotM.getAttribute('src') : null,
          R: slotR ? slotR.getAttribute('src') : null,
        };
      });

      const allResolved =
        slotsSrc.L && !slotsSrc.L.includes('slotpullanimation.gif') &&
        slotsSrc.M && !slotsSrc.M.includes('slotpullanimation.gif') &&
        slotsSrc.R && !slotsSrc.R.includes('slotpullanimation.gif');

      if (allResolved) {
        console.log('All slot images resolved successfully:');
        console.log('  slot_L src:', slotsSrc.L);
        console.log('  slot_M src:', slotsSrc.M);
        console.log('  slot_R src:', slotsSrc.R);
        console.log('Smoke test PASSED');
        await browser.close();
        process.exit(0);
      }

      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }

    // If we reach here, polling timed out
    console.error('Smoke test FAILED: Slot images did not resolve within 15 seconds');
    const finalSrc = await page.evaluate(() => {
      return {
        L: document.querySelector('#slot_L')?.getAttribute('src'),
        M: document.querySelector('#slot_M')?.getAttribute('src'),
        R: document.querySelector('#slot_R')?.getAttribute('src'),
      };
    });
    console.error('Final slot src values:', JSON.stringify(finalSrc));
    await browser.close();
    process.exit(1);
  } catch (error) {
    console.error('Smoke test FAILED:', error.message);
    await browser.close();
    process.exit(1);
  }
}

runSmokeTest();
