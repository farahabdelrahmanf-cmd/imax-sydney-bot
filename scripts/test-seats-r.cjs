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

  const rowR = await page.evaluate(() => {
    const seats = Array.from(document.querySelectorAll("li.boxpod, [data-seat*='\"AreaId\":16']"));
    return seats.map(s => {
      let data = {};
      try { data = JSON.parse(s.dataset.seat || "{}"); } catch (e) {}
      return {
        className: s.className,
        seatName: data.SeatName,
        seatId: data.SeatId,
        status: data.Status,
        areaId: data.AreaId,
        index: data.index
      };
    });
  });

  console.log("Row R Box Pods count:", rowR.length);
  console.log(rowR);
  await browser.close();
})();
