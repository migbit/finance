const APARTMENTS = ["123", "1248"];

function findPotentialCleaningConflicts(calendars, start, days) {
  const rangeEnd = addDays(start, days);
  const apartmentBookings = new Map(APARTMENTS.map((apartment) => [apartment, []]));

  (calendars || []).forEach((calendar) => {
    const apartment = String(calendar?.apartment || "");
    if (!apartmentBookings.has(apartment)) return;
    apartmentBookings.set(apartment, deduplicateBookings(calendar.bookings));
  });

  const states = new Map();
  apartmentBookings.forEach((bookings, apartment) => {
    const starts = new Set(bookings.map((booking) => booking.start));
    const checkouts = new Set(
      bookings
        .map((booking) => booking.end)
        .filter((date) => date >= start && date < rangeEnd)
    );
    const turnovers = new Set([...checkouts].filter((date) => starts.has(date)));
    states.set(apartment, { checkouts, turnovers });
  });

  const dates = new Set([
    ...states.get("123").checkouts,
    ...states.get("1248").checkouts,
  ]);

  return [...dates]
    .sort()
    .flatMap((date) => {
      const turnoverApartments = APARTMENTS.filter((apartment) =>
        states.get(apartment).turnovers.has(date)
      );

      // Once both turnovers are confirmed it is no longer an avoidable risk.
      if (turnoverApartments.length !== 1) return [];

      const turnoverApartment = turnoverApartments[0];
      const atRiskApartment = APARTMENTS.find(
        (apartment) => apartment !== turnoverApartment
      );

      // The second cleaning is only possible if the other apartment also has
      // a guest checking out that day and its same-day check-in is still open.
      if (!states.get(atRiskApartment).checkouts.has(date)) return [];

      return [{
        key: date,
        date,
        turnoverApartment,
        atRiskApartment,
        message: "Alerta de 2 limpezas em simultâneo",
      }];
    });
}

function deduplicateBookings(bookings) {
  const unique = new Map();
  (bookings || []).forEach((booking) => {
    if (!isDateKey(booking?.start) || !isDateKey(booking?.end)) return;
    if (booking.start >= booking.end) return;
    unique.set(`${booking.start}|${booking.end}`, {
      start: booking.start,
      end: booking.end,
    });
  });
  return [...unique.values()].sort((a, b) => a.start.localeCompare(b.start));
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
  findPotentialCleaningConflicts,
};
