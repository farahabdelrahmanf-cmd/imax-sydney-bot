export interface CinemaSession {
  sessionId: string;
  name: string;
  startDate: string; // ISO string
  localDateString: string;
  timeFormatted: string;
  dayOfWeek: number; // 0 = Sun, 1 = Mon, ..., 5 = Fri, 6 = Sat
  dayName: string;
  hour: number;
  minute: number;
  isWeekend: boolean;
  isEvening: boolean;
  bookingUrl: string;
}

export interface BoxSeatStatus {
  sessionId: string;
  totalBoxSeats: number;
  availableBoxSeats: number;
  availablePods: string[];
  isAvailable: boolean;
}

export interface GuestDetails {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}

export interface BotConfig {
  cinemaUrl: string;
  movieTitle: string;
  targetDaysOfWeek: number[]; // e.g. [5, 6, 0] for Fri, Sat, Sun
  earliestHour: number; // e.g. 17 for 5:00 PM
  earliestMinute: number;
  checkIntervalSeconds: number;
  checkJitterSeconds: number;
  headless: boolean;
  ntfyTopic: string;
  guest: GuestDetails;
  chromePath: string;
}
