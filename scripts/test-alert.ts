import { config } from "../src/config.js";
import { Notifier } from "../src/notifier.js";
import { CinemaSession } from "../src/types.js";

async function runTestAlert() {
  console.log("=============================================================");
  console.log("🔔 TESTING NOTIFICATION SYSTEM");
  console.log("=============================================================");
  console.log(`📱 Target ntfy topic: https://ntfy.sh/${config.ntfyTopic}`);
  console.log("Make sure you have installed the ntfy app on your phone and subscribed to this topic!\n");

  const mockSession: CinemaSession = {
    sessionId: "15546112",
    name: "The Odyssey",
    startDate: new Date().toISOString(),
    localDateString: "Fri, 18 Sep 2026",
    timeFormatted: "5:40 PM",
    dayOfWeek: 5,
    dayName: "Friday",
    isWeekend: true,
    isEvening: true,
    bookingUrl: "https://www.eventcinemas.com.au/orders/tickets#sessionId=15546112"
  };

  console.log("1. Sending test push notification to your phone...");
  const sent = await Notifier.sendMobileAlert(mockSession, mockSession.bookingUrl);
  if (sent) {
    console.log("✅ Mobile alert sent! Check your phone.");
  } else {
    console.log("❌ Mobile alert failed.");
  }

  console.log("\n2. Showing Mac notification banner...");
  await Notifier.showMacNotification("IMAX Sydney Test Alert", "If you can see this, Mac desktop notifications are working!");

  console.log("\n3. Bringing Chrome window to foreground...");
  await Notifier.bringChromeToFront();

  console.log("\n4. Playing Mac alert sound...");
  await Notifier.playMacAlarm(3);

  console.log("\n=============================================================");
  console.log("🎉 Test completed! All notification channels verified.");
  console.log("=============================================================");
}

runTestAlert().catch(console.error);
