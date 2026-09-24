import fetch from "node-fetch";
import { config } from "./config.js";
import { CinemaSession } from "./types.js";

export class SessionMonitor {
  private knownSessionIds: Set<string> = new Set();

  /**
   * Fetches the IMAX Sydney schedule and parses all sessions for the target movie
   */
  async fetchSessions(): Promise<CinemaSession[]> {
    const url = config.cinemaUrl;
    console.log(`[Monitor] Scanning ${url} for sessions of "${config.movieTitle}"...`);

    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9"
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch cinema page: HTTP ${response.status}`);
    }

    const html = await response.text();
    const sessions: CinemaSession[] = [];

    // Parse JSON-LD structure
    const jsonLdMatch = html.match(/<script type="application\/ld\+json">\s*(\[[\s\S]*?\])\s*<\/script>/);
    if (jsonLdMatch) {
      try {
        const events = JSON.parse(jsonLdMatch[1]);
        for (const evt of events) {
          if (evt["@type"] === "ScreeningEvent" && evt.name && evt.name.toLowerCase().includes(config.movieTitle.toLowerCase())) {
            const parsed = this.parseScreeningEvent(evt);
            if (parsed) {
              sessions.push(parsed);
            }
          }
        }
      } catch (err: any) {
        console.warn("[Monitor] Could not parse JSON-LD script, falling back to HTML parsing:", err.message);
      }
    }

    // HTML fallback if JSON-LD missing or incomplete
    if (sessions.length === 0) {
      const regex = /<a\s+href="([^"]*sessionId=(\d+)[^"]*)"[^>]*aria-label="([^"]*)"[^>]*>/gi;
      let match: RegExpExecArray | null;
      while ((match = regex.exec(html)) !== null) {
        const fullUrl = match[1];
        const sessionId = match[2];
        const label = match[3];

        if (label.toLowerCase().includes(config.movieTitle.toLowerCase())) {
          // If already added, skip
          if (!sessions.some(s => s.sessionId === sessionId)) {
            sessions.push({
              sessionId,
              name: config.movieTitle,
              startDate: new Date().toISOString(),
              localDateString: label,
              timeFormatted: label,
              dayOfWeek: -1,
              dayName: "Unknown",
              hour: 0,
              minute: 0,
              isWeekend: true,
              isEvening: true,
              bookingUrl: fullUrl.replace(/&amp;/g, "&")
            });
          }
        }
      }
    }

    return sessions;
  }

  /**
   * Helper to parse a JSON-LD event into CinemaSession
   */
  private parseScreeningEvent(evt: any): CinemaSession | null {
    const rawUrl = evt.url || "";
    const sessionMatch = rawUrl.match(/sessionId=(\d+)/);
    if (!sessionMatch) return null;

    const sessionId = sessionMatch[1];
    const startDate = new Date(evt.startDate);

    // Format in Sydney timezone
    const sydneyDate = new Date(startDate.toLocaleString("en-US", { timeZone: "Australia/Sydney" }));
    const dayOfWeek = sydneyDate.getDay();
    const hour = sydneyDate.getHours();
    const minute = sydneyDate.getMinutes();

    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const dayName = dayNames[dayOfWeek];

    const timeFormatted = sydneyDate.toLocaleTimeString("en-AU", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true
    });

    const localDateString = sydneyDate.toLocaleDateString("en-AU", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric"
    });

    const isWeekend = config.targetDaysOfWeek.includes(dayOfWeek);
    const isEvening = (hour > config.earliestHour) || (hour === config.earliestHour && minute >= config.earliestMinute);

    return {
      sessionId,
      name: evt.name,
      startDate: evt.startDate,
      localDateString,
      timeFormatted,
      dayOfWeek,
      dayName,
      hour,
      minute,
      isWeekend,
      isEvening,
      bookingUrl: `https://www.eventcinemas.com.au/orders/tickets#sessionId=${sessionId}`
    };
  }

  /**
   * Filters sessions matching user criteria:
   * - ANY time on Saturday or Sunday
   * - Friday afternoon/evening (from 2:00 PM onwards, covering 2:15 PM and all evenings)
   * - Thursday afternoon/evening (from 3:00 PM onwards, covering 3:45 PM and all evenings)
   * - Or any evening session (after 5:00 PM) on any day
   */
  filterTargetSessions(sessions: CinemaSession[]): CinemaSession[] {
    return sessions.filter(s => {
      // 1. Any time on Saturday (6) or Sunday (0)
      if (s.dayOfWeek === 6 || s.dayOfWeek === 0) {
        return true;
      }
      // 2. Friday (5): from 2:00 PM (14:00) onwards, covering 2:15 PM and all evenings
      if (s.dayOfWeek === 5 && s.hour >= 14) {
        return true;
      }
      // 3. Thursday (4): from 3:00 PM (15:00) onwards, covering 3:45 PM and all evenings
      if (s.dayOfWeek === 4 && s.hour >= 15) {
        return true;
      }
      // 4. Any other day evening (after 5:00 PM / 17:00)
      if (s.hour >= 17) {
        return true;
      }
      return false;
    });
  }

  /**
   * Identifies newly dropped sessions since previous check
   */
  identifyNewSessions(sessions: CinemaSession[]): CinemaSession[] {
    const newOnes: CinemaSession[] = [];
    for (const session of sessions) {
      if (!this.knownSessionIds.has(session.sessionId)) {
        this.knownSessionIds.add(session.sessionId);
        newOnes.push(session);
      }
    }
    return newOnes;
  }
}
