import fetch from "node-fetch";
import { exec } from "child_process";
import { promisify } from "util";
import { config } from "./config.js";
import { CinemaSession } from "./types.js";

const execAsync = promisify(exec);

export class Notifier {
  /**
   * Sends an urgent push notification to the user's phone via ntfy.sh
   */
  static async sendMobileAlert(session: CinemaSession, directLink: string): Promise<boolean> {
    const topic = config.ntfyTopic;
    const topics = Array.from(new Set([config.ntfyTopic, "imax-odyssey-farah-2026", "imax-sydney-odyssey-alerts"]));
    const title = `🚨 COCA-COLA BOX HELD: ${session.name}`;
    const message = `IMAX Sydney: Coca-Cola Box secured for ${session.dayName} (${session.timeFormatted}, ${session.localDateString})! Check your computer and finish checkout before the 10-15 min hold expires!`;

    try {
      for (const t of topics) {
        console.log(`[Notifier] Dispatching mobile alert to https://ntfy.sh/${t}...`);
        await fetch("https://ntfy.sh", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            topic: t,
            title,
            message,
            priority: 5,
            tags: ["tada", "tickets", "warning"],
            click: directLink,
            actions: [{ action: "view", label: "Open Booking Link", url: directLink }]
          })
        });
      }
      return true;
    } catch (err: any) {
      console.error("[Notifier] ⚠️ Error sending mobile push alert:", err.message);
      return false;
    }
  }

  /**
   * Plays audible chime repeatedly on Mac
   */
  static async playMacAlarm(repeats: number = 5): Promise<void> {
    console.log("[Notifier] 🔊 Ringing loud audio chime on your Mac...");
    for (let i = 0; i < repeats; i++) {
      try {
        await execAsync("afplay /System/Library/Sounds/Glass.aiff");
      } catch {
        // Fallback to terminal bell
        process.stdout.write("\x07");
      }
    }
  }

  /**
   * Displays native macOS notification banner
   */
  static async showMacNotification(title: string, message: string): Promise<void> {
    try {
      const sanitizedTitle = title.replace(/"/g, '\\"');
      const sanitizedMessage = message.replace(/"/g, '\\"');
      await execAsync(`osascript -e 'display notification "${sanitizedMessage}" with title "${sanitizedTitle}" sound name "Glass"'`);
    } catch (err: any) {
      console.error("[Notifier] macOS notification error:", err.message);
    }
  }

  /**
   * Focuses Google Chrome and brings it directly to the front of the screen
   */
  static async bringChromeToFront(): Promise<void> {
    try {
      console.log("[Notifier] 🖥️ Bringing Chrome window to foreground...");
      await execAsync(`osascript -e 'tell application "Google Chrome" to activate'`);
    } catch (err: any) {
      console.error("[Notifier] Failed to focus Chrome window:", err.message);
    }
  }

  /**
   * Trigger all alerts simultaneously
   */
  static async triggerAllAlerts(session: CinemaSession, directLink: string): Promise<void> {
    console.log("\n=============================================================");
    console.log("🚨🚨🚨 TICKET CART HOLD SUCCESSFUL! TRIGGERING ALERTS 🚨🚨🚨");
    console.log("=============================================================\n");

    // Run parallel notification tasks
    await Promise.allSettled([
      this.sendMobileAlert(session, directLink),
      this.showMacNotification("IMAX Sydney Box Secured!", `Held seats for ${session.name} on ${session.dayName}! Complete payment now.`),
      this.bringChromeToFront(),
      this.playMacAlarm(6)
    ]);
  }
}
