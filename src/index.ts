import { config } from "./config.js";
import { SessionMonitor } from "./monitor.js";
import { TicketBooker } from "./booker.js";
import { CinemaSession } from "./types.js";

const monitor = new SessionMonitor();
const booker = new TicketBooker();

let isRunning = true;

const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));

const getRandomJitter = (baseSeconds: number, jitterSeconds: number): number => {
  const variation = (Math.random() * 2 - 1) * jitterSeconds;
  return Math.max(15, Math.round(baseSeconds + variation));
};

async function shutdown() {
  console.log("\n[Main] Gracefully shutting down IMAX Sydney Bot...");
  isRunning = false;
  await booker.closeBrowser();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

async function main() {
  console.log("=============================================================");
  console.log("🎬  IMAX SYDNEY COCA-COLA BOX AUTO-MONITOR & HOLD BOT");
  console.log("=============================================================");
  console.log(`🎥 Target Movie   : ${config.movieTitle}`);
  console.log(`🏛️  Cinema         : IMAX Sydney (${config.cinemaUrl})`);
  console.log(`📅 Target Days    : Friday, Saturday, Sunday (Weekend)`);
  console.log(`⏰ Target Times   : After ${config.earliestHour}:${config.earliestMinute.toString().padStart(2, "0")}`);
  console.log(`💺 Target Seating : Coca-Cola Private Box (4-seat pod)`);
  console.log(`📱 Phone Alerts   : https://ntfy.sh/${config.ntfyTopic}`);
  console.log(`⏱️  Check Rate     : ~${config.checkIntervalSeconds}s (jitter +/- ${config.checkJitterSeconds}s)`);
  console.log("=============================================================\n");

  console.log("🚀 Initializing stealth engine and starting monitoring daemon...\n");
  await booker.initBrowser(config.headless);

  let scanCount = 0;

  while (isRunning) {
    scanCount++;
    const timestamp = new Date().toLocaleTimeString("en-AU", { timeZone: "Australia/Sydney", hour12: true });
    console.log(`\n--- [Scan #${scanCount} at ${timestamp} Sydney Time] ---`);

    try {
      // 1. Fetch live schedule from cinema page
      const allSessions = await monitor.fetchSessions();
      console.log(`[Monitor] Found ${allSessions.length} total sessions for "${config.movieTitle}".`);

      // 2. Check for newly released sessions (batch drop alert)
      const newSessions = monitor.identifyNewSessions(allSessions);
      if (newSessions.length > 0 && scanCount > 1) {
        console.log(`[Monitor] 🌟 NEW BATCH DETECTED! ${newSessions.length} new session(s) released:`);
        for (const s of newSessions) {
          console.log(`   -> [${s.sessionId}] ${s.dayName} ${s.timeFormatted} (${s.localDateString})`);
        }
      }

      // 3. Filter target weekend evening sessions
      const targetSessions = monitor.filterTargetSessions(allSessions);
      console.log(`[Monitor] ${targetSessions.length} sessions match your criteria (Weekend Evenings).`);

      // 4. Check seat maps for each target session
      for (const session of targetSessions) {
        console.log(`[Booker] Checking seats for session ${session.sessionId}: ${session.dayName} ${session.timeFormatted}...`);
        const seatStatus = await booker.checkSessionSeats(session.sessionId);

        if (seatStatus.isAvailable) {
          console.log(`\n🔥 SEAT AVAILABLE! Coca-Cola Box open on session ${session.sessionId}!`);
          console.log(`   Available Pods/Seats: ${seatStatus.availablePods.join(", ") || seatStatus.availableBoxSeats + " seats"}`);

          // Attempt cart hold immediately
          const holdSuccess = await booker.holdBoxSeats(session);
          if (holdSuccess) {
            console.log("\n[Main] 🎉 Seats successfully locked in cart! Waiting for you to finish checkout in Chrome...");
            // Keep process open and pause polling while user completes payment
            while (isRunning) {
              await sleep(10000);
            }
            return;
          }
        } else {
          console.log(`   -> Coca-Cola Box: Booked (${seatStatus.availableBoxSeats}/${seatStatus.totalBoxSeats} seats free)`);
        }
      }

    } catch (err: any) {
      console.error("[Main] Error during scan cycle:", err.message);
    }

    // Compute next interval with jitter
    const waitSeconds = getRandomJitter(config.checkIntervalSeconds, config.checkJitterSeconds);
    console.log(`[Main] Sleeping ${waitSeconds}s until next check... (Press Ctrl+C to stop)`);
    await sleep(waitSeconds * 1000);
  }
}

main().catch(err => {
  console.error("Fatal error in main loop:", err);
  process.exit(1);
});
