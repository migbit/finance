const CALENDAR_SOURCES = [
  {
    apartment: "123",
    url: "https://www.airbnb.com/calendar/ical/1192674.ics?s=713a99e9483f6ed204d12be2acc1f940",
  },
  {
    apartment: "1248",
    url: "https://www.airbnb.com/calendar/ical/9776121.ics?s=20937949370c92092084c8f0e5a50bbb",
  },
];

const CACHE_TTL_MS = 5 * 60 * 1000;
const calendarCache = new Map();

function parseAirbnbBookings(icalText) {
  const unfolded = String(icalText || "")
    .replace(/\r\n[ \t]/g, "")
    .replace(/\n[ \t]/g, "");
  const lines = unfolded.split(/\r?\n/);
  const bookings = [];
  let event = null;

  lines.forEach((line) => {
    if (line === "BEGIN:VEVENT") {
      event = {};
      return;
    }

    if (line === "END:VEVENT") {
      if (
        event?.summary?.trim().toLowerCase() === "reserved" &&
        isDateKey(event.start) &&
        isDateKey(event.end) &&
        event.start < event.end
      ) {
        bookings.push({ start: event.start, end: event.end });
      }
      event = null;
      return;
    }

    if (!event) return;

    const startMatch = line.match(/^DTSTART(?:;[^:]*)?:(\d{8})/);
    if (startMatch) {
      event.start = compactDateToKey(startMatch[1]);
      return;
    }

    const endMatch = line.match(/^DTEND(?:;[^:]*)?:(\d{8})/);
    if (endMatch) {
      event.end = compactDateToKey(endMatch[1]);
      return;
    }

    if (line.startsWith("SUMMARY:")) {
      event.summary = line.slice("SUMMARY:".length);
    }
  });

  return bookings;
}

async function loadCleaningCalendar(start, days = 14) {
  const rangeEnd = addDays(start, days);
  const calendars = await Promise.all(CALENDAR_SOURCES.map(async (source) => {
    const bookings = await loadSourceBookings(source);
    return {
      apartment: source.apartment,
      bookings: bookings.filter((booking) =>
        booking.end >= start && booking.start < rangeEnd
      ),
    };
  }));

  return {
    start,
    days,
    generatedAt: new Date().toISOString(),
    calendars,
  };
}

async function loadSourceBookings(source) {
  const cached = calendarCache.get(source.apartment);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.bookings;
  }

  try {
    const response = await fetch(source.url, {
      headers: {
        Accept: "text/calendar",
        "User-Agent": "Mozilla/5.0 (compatible; CleaningCalendar/1.0)",
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      throw new Error(`Airbnb respondeu com HTTP ${response.status}`);
    }

    const bookings = parseAirbnbBookings(await response.text());
    calendarCache.set(source.apartment, {
      bookings,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });
    return bookings;
  } catch (error) {
    if (cached?.bookings) {
      console.warn(`A usar cache iCal expirado do apartamento ${source.apartment}`, error);
      return cached.bookings;
    }
    throw error;
  }
}

function compactDateToKey(value) {
  return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
}

function addDays(dateKey, days) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function isDateKey(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
}

module.exports = {
  addDays,
  loadCleaningCalendar,
  parseAirbnbBookings,
};
