import fs from "fs";
import { chromium, Browser, BrowserContext, Page } from "playwright";
import { chromium as playwrightExtra } from "playwright-extra";
import stealthPlugin from "puppeteer-extra-plugin-stealth";
import { config } from "./config.js";
import { BoxSeatStatus, CinemaSession } from "./types.js";
import { Notifier } from "./notifier.js";

// Enable stealth
playwrightExtra.use(stealthPlugin());

export class TicketBooker {
  private browser: Browser | null = null;
  private activePage: Page | null = null;

  async initBrowser(headless: boolean = config.headless): Promise<void> {
    if (this.browser) return;

    const launchOptions: any = {
      headless: headless,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-blink-features=AutomationControlled",
        "--disable-infobars",
        "--window-size=1280,900"
      ]
    };

    if (fs.existsSync(config.chromePath)) {
      launchOptions.executablePath = config.chromePath;
    }

    this.browser = await (playwrightExtra as any).launch(launchOptions);
  }

  async closeBrowser(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  private async createStealthContext(): Promise<BrowserContext> {
    if (!this.browser) await this.initBrowser();
    return await this.browser!.newContext({
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
      viewport: { width: 1280, height: 900 },
      deviceScaleFactor: 1
    });
  }

  /**
   * Checks whether the Coca-Cola Box is available on a specific session
   */
  async checkSessionSeats(sessionId: string): Promise<BoxSeatStatus> {
    const context = await this.createStealthContext();
    const page = await context.newPage();
    const url = `https://www.eventcinemas.com.au/orders/tickets#sessionId=${sessionId}`;

    try {
      await page.goto(url, { waitUntil: "networkidle", timeout: 35000 });
      await page.waitForTimeout(2000);

      const status = await page.evaluate(() => {
        const boxSeats = Array.from(document.querySelectorAll("li.boxpod, [data-seat*='\"AreaId\":16']"));
        const availableSeats: string[] = [];
        const availablePods: string[] = [];

        boxSeats.forEach(s => {
          const isTaken = s.classList.contains("taken");
          let data: any = {};
          try { data = JSON.parse((s as HTMLElement).dataset.seat || "{}"); } catch (e) {}

          const seatName = data.SeatName || (s as HTMLElement).dataset.seatname || "";
          const seatStatus = data.Status;

          if (!isTaken && seatStatus !== "Booked") {
            availableSeats.push(seatName);
            if (s.classList.contains("quad") || s.classList.contains("delivery") || ["R1", "R5", "R9", "R13"].includes(seatName)) {
              availablePods.push(seatName);
            }
          }
        });

        return {
          totalBoxSeats: boxSeats.length || 16,
          availableBoxSeats: availableSeats.length,
          availablePods,
          isAvailable: availableSeats.length >= 4 || availablePods.length > 0
        };
      });

      return {
        sessionId,
        ...status
      };
    } catch (err: any) {
      console.error(`[Booker] Error checking session ${sessionId}:`, err.message);
      return {
        sessionId,
        totalBoxSeats: 16,
        availableBoxSeats: 0,
        availablePods: [],
        isAvailable: false
      };
    } finally {
      await context.close();
    }
  }

  /**
   * Automatically selects the Coca-Cola Box seats, proceeds through the cart,
   * autofills guest contact details, holds the reservation, and triggers urgent alerts.
   */
  async holdBoxSeats(session: CinemaSession): Promise<boolean> {
    console.log(`\n[Booker] 🎯 HOLDING COCA-COLA BOX FOR SESSION: ${session.sessionId} (${session.dayName}, ${session.timeFormatted})`);

    // Launch visible browser so the user can immediately take over
    await this.closeBrowser();
    await this.initBrowser(false);

    const context = await this.createStealthContext();
    const page = await context.newPage();
    this.activePage = page;
    const url = session.bookingUrl;

    try {
      await page.goto(url, { waitUntil: "networkidle", timeout: 45000 });
      await page.waitForTimeout(2000);

      // 1. Locate available Coca-Cola Box anchor seat (R1, R5, R9, R13 or any .quad:not(.taken))
      console.log("[Booker] 🔍 Locating available box pod...");
      const seatClicked = await page.evaluate(() => {
        const podAnchor = document.querySelector("li.boxpod.quad:not(.taken), li.boxpod.delivery:not(.taken), li.boxpod:not(.taken)") as HTMLElement;
        if (podAnchor) {
          podAnchor.scrollIntoView({ behavior: "smooth", block: "center" });
          podAnchor.click();
          return true;
        }
        return false;
      });

      if (!seatClicked) {
        console.warn("[Booker] ⚠️ Could not click available box pod anchor. Attempting click on any available Box seat...");
        await page.click("li.boxpod:not(.taken), [data-seat*='\"AreaId\":16']:not(.taken)");
      }

      await page.waitForTimeout(1500);

      // 2. Click Proceed on Seats step
      console.log("[Booker] ➡️ Advancing through seat selection...");
      const proceedSeatsBtn = page.locator("a.btn.proceed.seats, a.btn.proceed:visible").first();
      await proceedSeatsBtn.waitFor({ state: "visible", timeout: 10000 });
      await proceedSeatsBtn.click();
      await page.waitForTimeout(2000);

      // 3. Handle Ticket selection step (if prompted)
      const proceedTicketsBtn = page.locator("a.btn.proceed.tickets, a.btn.proceed:visible").first();
      if (await proceedTicketsBtn.isVisible()) {
        console.log("[Booker] ➡️ Confirming ticket selection...");
        await proceedTicketsBtn.click();
        await page.waitForTimeout(2000);
      }

      // 4. Handle Food & Beverage / Add-ons step (skip or proceed)
      const proceedFabBtn = page.locator("a.btn.proceed.fab, a.skip-step:visible, a.btn.proceed:visible").first();
      if (await proceedFabBtn.isVisible()) {
        console.log("[Booker] ➡️ Skipping/Proceeding past Food & Beverage...");
        await proceedFabBtn.click();
        await page.waitForTimeout(2000);
      }

      // 5. Handle Guest Checkout / Autofill contact details
      console.log("[Booker] 📝 Checking for guest contact details form...");
      await this.autofillGuestDetails(page);

      // Bring window to front
      await Notifier.bringChromeToFront();

      // Trigger high-priority alerts across mobile and Mac
      await Notifier.triggerAllAlerts(session, page.url());

      console.log("\n=============================================================");
      console.log("✅ CART HOLD ACTIVE! THE SEATS ARE LOCKED IN YOUR CART.");
      console.log("👉 The Chrome window has been opened and focused on your screen.");
      console.log("👉 Complete payment details before the hold timer expires.");
      console.log("=============================================================\n");

      return true;
    } catch (err: any) {
      console.error("[Booker] ❌ Failed to hold box seats:", err.message);
      return false;
    }
  }

  /**
   * Helper to autofill guest details if fields are present
   */
  private async autofillGuestDetails(page: Page): Promise<void> {
    try {
      // Guest Checkout button if present
      const guestBtn = page.locator("a:has-text('Guest'), button:has-text('Guest'), a:has-text('Continue as Guest')").first();
      if (await guestBtn.isVisible()) {
        console.log("[Booker] Clicking 'Continue as Guest'...");
        await guestBtn.click();
        await page.waitForTimeout(1500);
      }

      // First Name
      const firstNameInput = page.locator("input[name*='firstName' i], input[id*='firstname' i], input[placeholder*='First Name' i]").first();
      if (await firstNameInput.isVisible()) {
        console.log(`[Booker] Autofilling First Name: ${config.guest.firstName}`);
        await firstNameInput.fill(config.guest.firstName);
      }

      // Last Name
      const lastNameInput = page.locator("input[name*='lastName' i], input[id*='lastname' i], input[placeholder*='Last Name' i]").first();
      if (await lastNameInput.isVisible()) {
        console.log(`[Booker] Autofilling Last Name: ${config.guest.lastName}`);
        await lastNameInput.fill(config.guest.lastName);
      }

      // Email
      const emailInput = page.locator("input[type='email'], input[name*='email' i], input[id*='email' i]").first();
      if (await emailInput.isVisible()) {
        console.log(`[Booker] Autofilling Email: ${config.guest.email}`);
        await emailInput.fill(config.guest.email);
      }

      // Phone
      const phoneInput = page.locator("input[type='tel'], input[name*='phone' i], input[name*='mobile' i], input[id*='mobile' i]").first();
      if (await phoneInput.isVisible()) {
        console.log(`[Booker] Autofilling Mobile: ${config.guest.phone}`);
        await phoneInput.fill(config.guest.phone);
      }

      // Proceed after filling
      const proceedAfterDetails = page.locator("a.btn.proceed:visible, button:has-text('Proceed'):visible, button:has-text('Next'):visible").first();
      if (await proceedAfterDetails.isVisible()) {
        console.log("[Booker] Submitting guest details to lock cart timer...");
        await proceedAfterDetails.click();
        await page.waitForTimeout(2000);
      }
    } catch (err: any) {
      console.warn("[Booker] Note on guest autofill:", err.message);
    }
  }
}
