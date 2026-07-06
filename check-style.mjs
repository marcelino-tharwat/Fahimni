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
  await page.screenshot({ path: 'become-teacher-style.png', fullPage: true });
  console.log('Screenshot saved');

  const styles = await page.evaluate(() => {
    const card = document.querySelector('.rounded-card');
    const inputs = document.querySelectorAll('input');
    const button = document.querySelector('button[type="submit"]');
    const bodyFont = window.getComputedStyle(document.body).fontFamily;
    const bodyBg = window.getComputedStyle(document.body).backgroundColor;

    const r = { bodyFont, bodyBg, card: null, inputs: [], button: null };

    if (card) {
      const cs = window.getComputedStyle(card);
      r.card = {
        borderRadius: cs.borderRadius,
        boxShadow: cs.boxShadow,
        backgroundColor: cs.backgroundColor,
      };
    }

    for (const inp of inputs) {
      if (inp.type === 'checkbox' || inp.type === 'file') continue;
      const cs = window.getComputedStyle(inp);
      r.inputs.push({
        type: inp.type,
        placeholder: inp.placeholder,
        borderRadius: cs.borderRadius,
        height: cs.height,
        fontFamily: cs.fontFamily,
        backgroundColor: cs.backgroundColor,
        border: cs.border,
        padding: cs.padding,
      });
    }

    if (button) {
      const cs = window.getComputedStyle(button);
      r.button = {
        backgroundColor: cs.backgroundColor,
        color: cs.color,
        borderRadius: cs.borderRadius,
        fontFamily: cs.fontFamily,
        height: cs.height,
        padding: cs.padding,
      };
    }

    // Check font loading
    r.fontLoaded = false;
    if (document.fonts && document.fonts.check) {
      r.fontLoaded = document.fonts.check('12px Cairo');
    }

    return r;
  });

  console.log(JSON.stringify(styles, null, 2));

} finally {
  await browser.close();
}
