const { chromium } = require("playwright-extra");
const stealth = require("puppeteer-extra-plugin-stealth")();
chromium.use(stealth);

(async () => {
  const browser = await chromium.launch({
    executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-blink-features=AutomationControlled"]
  });

  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
    viewport: { width: 1280, height: 900 }
  });

  const page = await context.newPage();
  try {
    await page.goto("https://www.eventcinemas.com.au/orders/tickets#sessionId=15546112", {
      waitUntil: "networkidle",
      timeout: 30000
    });
    await page.waitForTimeout(3000);

    // Look for ticket selection or seat map sections
    const tickets = await page.$$eval(".ticket-item, .ticket-row, [class*='ticket'], [class*='pricing'], [class*='seat']", els => 
      els.map(el => ({
        tag: el.tagName,
        className: el.className,
        text: el.innerText.trim().replace(/\n+/g, ' ')
      })).filter(x => x.text.length > 0 && x.text.length < 200)
    );
    console.log("Found ticket/seat elements count:", tickets.length);
    console.log("Sample ticket elements:", tickets.slice(0, 15));

    // Look for button texts
    const buttons = await page.$$eval("button, a.btn, input[type='submit']", els =>
      els.map(b => b.innerText.trim() || b.value).filter(Boolean)
    );
    console.log("Buttons on page:", buttons);
  } catch (err) {
    console.error("Error:", err.message);
  } finally {
    await browser.close();
  }
})();
