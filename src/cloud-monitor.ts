import { config } from "./config.js";
import { SessionMonitor } from "./monitor.js";
import { TicketBooker } from "./booker.js";
import { Notifier } from "./notifier.js";

const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));

async function runCloudMonitor() {
  console.log("=============================================================");
  console.log("☁️  IMAX SYDNEY 24/7 CLOUD MONITOR (GITHUB ACTIONS / VPS)");
  console.log("=============================================================");
  console.log(`Movie        : ${config.movieTitle}`);
  console.log(`Cinema       : ${config.cinemaUrl}`);
  console.log(`Target Days  : Friday, Saturday, Sunday (Weekend)`);
  console.log(`Target Times : After ${config.earliestHour}:${config.earliestMinute.toString().padStart(2, "0")}`);
  console.log(`ntfy Topic   : https://ntfy.sh/${config.ntfyTopic}`);
  console.log("=============================================================\n");

  const monitor = new SessionMonitor();
  const booker = new TicketBooker();

  // In cloud environment (Ubuntu / CI), launch headless Chromium
  await booker.initBrowser(true);

  // Run a cycle of checks for ~5 minutes per GitHub Action execution
  const MAX_RUNTIME_MS = 5 * 60 * 1000;
  const startTime = Date.now();
  let cycle = 0;

  while (Date.now() - startTime < MAX_RUNTIME_MS) {
    cycle++;
    const timestamp = new Date().toLocaleTimeString("en-AU", { timeZone: "Australia/Sydney", hour12: true });
    console.log(`\n--- [Cloud Scan #${cycle} at ${timestamp} Sydney Time] ---`);

    try {
      // 1. Fetch live schedule
      const allSessions = await monitor.fetchSessions();
      console.log(`[Cloud] Found ${allSessions.length} total sessions for "${config.movieTitle}".`);

      // 2. Check for newly released sessions (new batch drop)
      const newSessions = monitor.identifyNewSessions(allSessions);
      if (newSessions.length > 0 && cycle > 1) {
        console.log(`[Cloud] 🌟 NEW BATCH DROPPED! Found ${newSessions.length} new session(s)!`);
        for (const s of newSessions) {
          if (s.isWeekend && s.isEvening) {
            console.log(`   -> Alerting phone for new weekend session: ${s.sessionId} (${s.dayName} ${s.timeFormatted})`);
            await Notifier.sendMobileAlert(s, s.bookingUrl);
          }
        }
      }

      // 3. Filter target weekend evening sessions
      const targetSessions = monitor.filterTargetSessions(allSessions);
      console.log(`[Cloud] Checking ${targetSessions.length} target weekend evening sessions...`);

      // 4. Inspect seat map of each target session
      for (const session of targetSessions) {
        console.log(`[Cloud] Inspecting seat map for [${session.sessionId}] ${session.dayName} ${session.timeFormatted}...`);
        const status = await booker.checkSessionSeats(session.sessionId);

        if (status.isAvailable) {
          console.log(`\n🚨🚨 SEAT AVAILABLE! Coca-Cola Box is open for ${session.dayName} ${session.timeFormatted}! 🚨🚨`);
          console.log(`   Available: ${status.availablePods.join(", ") || status.availableBoxSeats + " seats"}`);
          
          // Send instant mobile push notification
          await Notifier.sendMobileAlert(session, session.bookingUrl);
        } else {
          console.log(`   -> Booked (${status.availableBoxSeats}/${status.totalBoxSeats} seats free)`);
        }
      }

    } catch (err: any) {
      console.error("[Cloud] Error during scan cycle:", err.message);
    }

    // Wait 45-60 seconds between scans
    const waitSeconds = 45 + Math.floor(Math.random() * 15);
    if (Date.now() - startTime + (waitSeconds * 1000) < MAX_RUNTIME_MS) {
      console.log(`[Cloud] Sleeping ${waitSeconds}s until next scan...`);
      await sleep(waitSeconds * 1000);
    } else {
      break;
    }
  }

  await booker.closeBrowser();
  console.log("\n[Cloud] 5-minute cycle finished cleanly. Next scheduled runner will resume automatically.");
}

runCloudMonitor().catch(err => {
  console.error("Fatal cloud monitor error:", err);
  process.exit(1);
});
