import dotenv from "dotenv";
import { BotConfig } from "./types.js";

dotenv.config();

const parseDays = (daysStr?: string): number[] => {
  if (!daysStr) return [5, 6, 0]; // Default: Friday, Saturday, Sunday
  return daysStr.split(",").map(d => parseInt(d.trim(), 10)).filter(n => !isNaN(n));
};

const parseTime = (timeStr?: string): { hour: number; minute: number } => {
  if (!timeStr) return { hour: 17, minute: 0 };
  const [h, m] = timeStr.split(":").map(n => parseInt(n, 10));
  return {
    hour: isNaN(h) ? 17 : h,
    minute: isNaN(m) ? 0 : m
  };
};

const timeParsed = parseTime(process.env.EARLIEST_TIME);

export const config: BotConfig = {
  cinemaUrl: process.env.CINEMA_URL || "https://www.eventcinemas.com.au/cinema/imax-sydney",
  movieTitle: process.env.TARGET_MOVIE_TITLE || "The Odyssey",
  targetDaysOfWeek: parseDays(process.env.TARGET_DAYS_OF_WEEK),
  earliestHour: timeParsed.hour,
  earliestMinute: timeParsed.minute,
  checkIntervalSeconds: parseInt(process.env.CHECK_INTERVAL_SECONDS || "60", 10),
  checkJitterSeconds: parseInt(process.env.CHECK_JITTER_SECONDS || "20", 10),
  headless: process.env.HEADLESS !== "false",
  ntfyTopic: process.env.NTFY_TOPIC || "imax-sydney-odyssey-alerts",
  guest: {
    firstName: process.env.GUEST_FIRST_NAME || "Farah",
    lastName: process.env.GUEST_LAST_NAME || "Farah",
    email: process.env.GUEST_EMAIL || "test@example.com",
    phone: process.env.GUEST_PHONE || "0400000000"
  },
  chromePath: process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
};
