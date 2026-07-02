const CALENDAR_SOURCES = [
  {
    apartment: "123",
    calendars: [
      {
        provider: "airbnb",
        url: "https://www.airbnb.com/calendar/ical/1192674.ics?s=713a99e9483f6ed204d12be2acc1f940",
      },
      {
        provider: "vrbo",
        url: "https://www.vrbo.com/icalendar/c0cd3694cf3840288be37d51c9a758d2.ics?nonTentative",
      },
    ],
  },
  {
    apartment: "1248",
    calendars: [
      {
        provider: "airbnb",
        url: "https://www.airbnb.com/calendar/ical/9776121.ics?s=20937949370c92092084c8f0e5a50bbb",
      },
      {
        provider: "vrbo",
        url: "https://www.vrbo.com/icalendar/a4305ff49cb547d39bc1fe735fe67c85.ics?nonTentative",
      },
    ],
  },
];

const CACHE_TTL_MS = 5 * 60 * 1000;
const calendarCache = new Map();

function parseCalendarBookings(icalText, provider) {
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
      const summary = event?.summary?.trim().toLowerCase();
      const validDates =
        isDateKey(event?.start) &&
        isDateKey(event?.end) &&
        event.start < event.end;
      const isReservation = provider === "vrbo"
        ? /^reserved(?:\s*-|$)/.test(summary || "")
        : summary === "reserved";

      if (
        validDates &&
        isReservation
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
    const sourceBookings = await Promise.all(source.calendars.map((calendar) =>
      loadSourceBookings(source.apartment, calendar)
    ));
    const bookings = deduplicateBookings(sourceBookings.flat());
    const previousBooking = [...bookings]
      .filter((booking) => booking.end < start)
      .sort((a, b) => b.end.localeCompare(a.end))[0];
    const relevantBookings = bookings.filter((booking) =>
      booking.end >= start && booking.start < rangeEnd
    );
    const nextBooking = [...bookings]
      .filter((booking) => booking.start >= rangeEnd)
      .sort((a, b) => a.start.localeCompare(b.start))[0];

    if (
      previousBooking &&
      !relevantBookings.some((booking) =>
        booking.start === previousBooking.start && booking.end === previousBooking.end
      )
    ) {
      relevantBookings.unshift(previousBooking);
    }
    if (
      nextBooking &&
      !relevantBookings.some((booking) =>
        booking.start === nextBooking.start && booking.end === nextBooking.end
      )
    ) {
      relevantBookings.push(nextBooking);
    }

    return {
      apartment: source.apartment,
      bookings: relevantBookings,
    };
  }));

  return {
    start,
    days,
    generatedAt: new Date().toISOString(),
    calendars,
  };
}

async function loadSourceBookings(apartment, source) {
  const cacheKey = `${apartment}:${source.provider}`;
  const cached = calendarCache.get(cacheKey);
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

    const bookings = parseCalendarBookings(await response.text(), source.provider);
    calendarCache.set(cacheKey, {
      bookings,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });
    return bookings;
  } catch (error) {
    if (cached?.bookings) {
      console.warn(`A usar cache iCal expirado de ${source.provider} no apartamento ${apartment}`, error);
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

function deduplicateBookings(bookings) {
  const unique = new Map();
  bookings.forEach((booking) => {
    unique.set(`${booking.start}|${booking.end}`, booking);
  });
  return Array.from(unique.values()).sort((a, b) => a.start.localeCompare(b.start));
}

function parseAirbnbBookings(icalText) {
  return parseCalendarBookings(icalText, "airbnb");
}

function parseVrboBookings(icalText) {
  return parseCalendarBookings(icalText, "vrbo");
}

function isDateKey(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
}

module.exports = {
  addDays,
  loadCleaningCalendar,
  parseAirbnbBookings,
  parseVrboBookings,
};
