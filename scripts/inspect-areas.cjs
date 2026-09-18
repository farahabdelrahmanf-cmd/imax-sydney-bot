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

  const analysis = await page.evaluate(() => {
    const seats = Array.from(document.querySelectorAll("li.seat"));
    const areas = {};
    const boxSeats = [];
    
    seats.forEach(s => {
      let data = null;
      try {
        data = JSON.parse(s.dataset.seat || "{}");
      } catch (e) {}
      
      const area = s.dataset.areaid || (data && data.AreaId) || "unknown";
      if (!areas[area]) {
        areas[area] = { count: 0, sampleNames: [], classes: new Set() };
      }
      areas[area].count++;
      s.className.split(" ").forEach(c => areas[area].classes.add(c));
      if (areas[area].sampleNames.length < 5 && data && data.SeatName) {
        areas[area].sampleNames.push(data.SeatName);
      }

      // Check for box keywords or row names that might be boxes
      const isBox = (s.className && s.className.toLowerCase().includes("box")) ||
                    (data && data.SeatName && (data.SeatName.toLowerCase().includes("box") || data.SeatName.startsWith("BX")));
      if (isBox) {
        boxSeats.push({ seatName: data?.SeatName, status: data?.Status, className: s.className, areaId: area });
      }
    });

    // Also look at seat-attribute-filter
    const filterOptions = Array.from(document.querySelectorAll(".seat-attribute-filter-option")).map(el => ({
      text: el.innerText.trim(),
      dataset: Object.assign({}, el.dataset),
      href: el.getAttribute("href") || el.getAttribute("data-filter")
    }));

    return {
      totalSeats: seats.length,
      areas: Object.fromEntries(Object.entries(areas).map(([k, v]) => [k, { ...v, classes: Array.from(v.classes) }])),
      boxSeatsCount: boxSeats.length,
      sampleBoxSeats: boxSeats.slice(0, 10),
      filterOptions
    };
  });

  console.log("Analysis Result:", JSON.stringify(analysis, null, 2));
  await browser.close();
})();
