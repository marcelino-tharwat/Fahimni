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
  await page.goto('http://localhost:5173/become-teacher', { waitUntil: 'networkidle0', timeout: 15000 });
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: 'become-teacher-after-fix.png', fullPage: true });
  console.log('Screenshot saved to become-teacher-after-fix.png');

  // Verify the button renders correctly (no duplicate spinner)
  const btnHTML = await page.evaluate(() => {
    const btn = document.querySelector('button[type="submit"]');
    if (!btn) return 'NO BUTTON FOUND';
    return {
      text: btn.textContent,
      spinnerCount: btn.querySelectorAll('.animate-spin, svg.lucide-loader2').length,
      hasLoaderSvg: btn.innerHTML.includes('lucide-loader2') || btn.innerHTML.includes('loader'),
    };
  });
  console.log('Button:', JSON.stringify(btnHTML));

  // Verify the success icon uses text-success
  // (We can't trigger success without submitting, but we can check the rendered form)
  const proofUploadDiv = await page.evaluate(() => {
    const div = document.querySelector('[class*="border-dashed"]');
    if (!div) return null;
    return {
      bgColor: window.getComputedStyle(div).backgroundColor,
    };
  });
  console.log('ProofUpload dropzone bg:', JSON.stringify(proofUploadDiv));

} finally {
  await browser.close();
}
