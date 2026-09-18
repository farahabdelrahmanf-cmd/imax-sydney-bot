import { SessionMonitor } from "../src/monitor.js";
import { TicketBooker } from "../src/booker.js";
import { config } from "../src/config.js";

async function runTestScan() {
  console.log("=============================================================");
  console.log("🔍 TESTING LIVE SESSION SCANNER & SEAT MAP CHECKER");
  console.log("=============================================================");
  console.log(`Movie : ${config.movieTitle}`);
  console.log(`Cinema: ${config.cinemaUrl}\n`);

  const monitor = new SessionMonitor();
  const booker = new TicketBooker();

  console.log("Step 1: Scraping cinema schedule...");
  const allSessions = await monitor.fetchSessions();
  console.log(`Found ${allSessions.length} total sessions for "${config.movieTitle}":`);
  for (const s of allSessions) {
    console.log(` - [${s.sessionId}] ${s.dayName} ${s.timeFormatted} (${s.localDateString}) | Weekend: ${s.isWeekend} | Evening: ${s.isEvening}`);
  }

  const targetSessions = monitor.filterTargetSessions(allSessions);
  console.log(`\nStep 2: Filtered ${targetSessions.length} target sessions (Weekend Evenings after ${config.earliestHour}:${config.earliestMinute.toString().padStart(2, "0")}):`);
  for (const s of targetSessions) {
    console.log(` - [${s.sessionId}] ${s.dayName} ${s.timeFormatted}`);
  }

  console.log("\nStep 3: Initializing stealth browser to check seat map of first target session...");
  await booker.initBrowser(true);

  if (targetSessions.length > 0) {
    const testSession = targetSessions[0];
    console.log(`Checking seat map for session ${testSession.sessionId} (${testSession.dayName} ${testSession.timeFormatted})...`);
    const status = await booker.checkSessionSeats(testSession.sessionId);
    console.log("\nSeat Status Result:");
    console.log(JSON.stringify(status, null, 2));
    if (status.isAvailable) {
      console.log("🔥 Coca-Cola Box is AVAILABLE on this session!");
    } else {
      console.log("🔒 Coca-Cola Box is currently BOOKED (0/16 seats free) - bot will monitor for cancellations.");
    }
  }

  await booker.closeBrowser();
  console.log("\n=============================================================");
  console.log("✅ Scan test complete!");
  console.log("=============================================================");
}

runTestScan().catch(console.error);
