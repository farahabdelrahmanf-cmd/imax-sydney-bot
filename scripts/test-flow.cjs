const { chromium } = require("playwright-extra");
const stealth = require("puppeteer-extra-plugin-stealth")();
chromium.use(stealth);

(async () => {
  const browser = await chromium.launch({
    executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-blink-features=AutomationControlled"]
  });

  const page = await browser.newPage();
  await page.goto("https://www.eventcinemas.com.au/orders/tickets#sessionId=15546112", {
    waitUntil: "networkidle"
  });

  // Find proceed buttons and active step container
  const flowInfo = await page.evaluate(() => {
    const proceedButtons = Array.from(document.querySelectorAll("button, a.btn, input[type='submit']"))
      .filter(el => (el.innerText || el.value || "").toLowerCase().includes("proceed"))
      .map(el => ({
        tag: el.tagName,
        id: el.id,
        className: el.className,
        text: el.innerText || el.value,
        offsetParent: el.offsetParent !== null, // visible?
        disabled: el.disabled || el.classList.contains("disabled")
      }));

    const footer = document.querySelector(".booking-footer, .order-footer, .checkout-bar, .ticketing-footer");
    return {
      proceedButtons,
      footerText: footer ? footer.innerText.trim() : null
    };
  });

  console.log("Flow info:", JSON.stringify(flowInfo, null, 2));
  await browser.close();
})();
