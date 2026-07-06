import puppeteer from 'puppeteer-core';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const browser = await puppeteer.launch({
  executablePath: CHROME_PATH,
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  // Suppress noisy console
  page.on('console', () => {});

  await page.goto('http://localhost:5173/become-teacher', { waitUntil: 'networkidle0', timeout: 20000 });
  // Wait extra long for the page
  await new Promise(r => setTimeout(r, 5000));

  const rootHTML = await page.evaluate(() => document.getElementById('root')?.innerHTML?.length || 0);
  console.log('Root innerHTML length:', rootHTML);

  // Even if there's an error, try to see partial content
  const bodyContent = await page.evaluate(() => document.body.innerHTML.substring(0, 3000));
  console.log('Body:', bodyContent);

  await page.screenshot({ path: 'become-teacher-fixed.png', fullPage: true });
  console.log('Screenshot saved');

  // If the page loaded, check headers
  if (rootHTML > 0) {
    const headers = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('nav, header')).map(h => ({
        tag: h.tagName,
        visible: h.offsetHeight > 0,
        text: h.textContent?.trim().substring(0, 100),
      }));
    });
    console.log('Headers:', JSON.stringify(headers, null, 2));
  }

} finally {
  await browser.close();
}
