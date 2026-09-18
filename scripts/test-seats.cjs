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

    const seatDetails = await page.$$eval("li.seat, [data-seat-id], [class*='seat-item'], [class*='seat']", els =>
      els.slice(0, 30).map(el => ({
        tag: el.tagName,
        className: el.className,
        id: el.id,
        dataset: Object.assign({}, el.dataset),
        title: el.getAttribute("title"),
        ariaLabel: el.getAttribute("aria-label"),
        text: el.innerText.trim()
      }))
    );
    console.log("Sample seat details count:", seatDetails.length);
    console.log("Sample seat items:", seatDetails.filter(s => s.className.includes("seat")));

    // Search specifically for seats matching "Box" or "Coca"
    const boxSeats = await page.$$eval("*", els => {
      const matches = [];
      for (const el of els) {
        const text = (el.innerText || "") + (el.getAttribute("aria-label") || "") + (el.getAttribute("title") || "") + JSON.stringify(el.dataset || {});
        if (text.toLowerCase().includes("coca") || text.toLowerCase().includes("box")) {
          if (el.className && typeof el.className === "string" && (el.className.includes("seat") || el.tagName === "LI" || el.tagName === "DIV")) {
            matches.push({
              tag: el.tagName,
              className: el.className,
              dataset: el.dataset,
              text: el.innerText ? el.innerText.substring(0, 50) : ""
            });
          }
        }
      }
      return matches.slice(0, 15);
    });
    console.log("Box seats in DOM:", boxSeats);

  } catch (err) {
    console.error("Error:", err.message);
  } finally {
    await browser.close();
  }
})();
