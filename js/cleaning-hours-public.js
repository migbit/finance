const calendarWeeks = document.getElementById('cleaning-calendar-weeks');
const calendarMeta = document.getElementById('cleaning-calendar-meta');
const reloadButton = document.getElementById('reload-cleaning-calendar');
const API_ORIGIN = 'https://apartments-a4b17.web.app';
const token = new URLSearchParams(window.location.search).get('token') || '';

let loading = false;

document.addEventListener('DOMContentLoaded', () => {
  reloadButton?.addEventListener('click', loadCalendar);

  if (!token) {
    setMeta('Link inválido. Falta o token de acesso.', true);
    setHtml(calendarWeeks, '<div class="empty-state">Não foi possível abrir o calendário.</div>');
    if (reloadButton) reloadButton.disabled = true;
    return;
  }

  loadCalendar();

  window.setInterval(() => {
    if (document.visibilityState === 'visible') loadCalendar();
  }, 15 * 60 * 1000);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') loadCalendar();
  });
});

async function loadCalendar() {
  if (!token || !calendarWeeks || loading) return;
  loading = true;

  if (reloadButton) {
    reloadButton.disabled = true;
    reloadButton.textContent = 'A atualizar...';
  }
  setMeta('A carregar calendário...');

  try {
    const url = new URL('/api/cleaning-calendar', API_ORIGIN);
    url.searchParams.set('token', token);
    url.searchParams.set('start', todayLocal());

    const response = await fetch(url.toString(), { cache: 'no-store' });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || 'Falha ao carregar o calendário.');

    renderCalendar(payload);
    const updatedAt = payload.generatedAt ? new Date(payload.generatedAt) : new Date();
    setMeta(`Atualizado em ${updatedAt.toLocaleString('pt-PT', {
      dateStyle: 'short',
      timeStyle: 'short'
    })}. Atualiza automaticamente a cada 15 minutos.`);
  } catch (error) {
    console.error(error);
    setMeta(error.message || 'Não foi possível carregar o calendário.', true);
    setHtml(calendarWeeks, '<div class="empty-state">Não foi possível carregar os dias de limpeza.</div>');
  } finally {
    loading = false;
    if (reloadButton) {
      reloadButton.disabled = false;
      reloadButton.textContent = 'Atualizar';
    }
  }
}

function renderCalendar(payload) {
  const dates = buildDateKeys(payload.start, Number(payload.days) || 14);
  const calendars = normalizeCalendars(payload.calendars);
  const schedules = {
    '123': buildSchedule(dates, calendars['123']),
    '1248': buildSchedule(dates, calendars['1248'])
  };
  const weeks = [dates.slice(0, 7), dates.slice(7, 14)];

  calendarWeeks.innerHTML = weeks.map((weekDates, index) => `
    <section class="calendar-week">
      <h2>Semana ${index + 1} · ${escapeHtml(formatShortRange(weekDates))}</h2>
      ${weekDates.map((dateKey) => `
        <article class="calendar-day">
          <div class="calendar-day-date">${escapeHtml(formatDay(dateKey))}</div>
          <div class="calendar-day-statuses">
            ${renderStatus('123', schedules['123'][dateKey])}
            ${renderStatus('1248', schedules['1248'][dateKey])}
          </div>
        </article>
      `).join('')}
    </section>
  `).join('');
}

function renderStatus(apartment, status) {
  const labels = {
    required: 'LIMPAR!',
    optional: 'LIMPAR',
    occupied: 'OCUPADO',
    free: 'LIVRE'
  };

  return `
    <div class="apartment-status is-${escapeHtml(apartment)} is-${escapeHtml(status)}">
      <span>AP. ${escapeHtml(apartment)}</span>
      <strong>${labels[status] || 'LIVRE'}</strong>
    </div>
  `;
}

function normalizeCalendars(calendars) {
  const result = {
    '123': { bookings: [], assumeTurnoverToday: false },
    '1248': { bookings: [], assumeTurnoverToday: false }
  };
  if (!Array.isArray(calendars)) return result;

  calendars.forEach((calendar) => {
    if (!result[calendar.apartment] || !Array.isArray(calendar.bookings)) return;
    result[calendar.apartment] = {
      bookings: calendar.bookings.filter((booking) =>
        isDateKey(booking.start) && isDateKey(booking.end)
      ),
      assumeTurnoverToday: calendar.assumeTurnoverToday === true
    };
  });
  return result;
}

function buildSchedule(dates, calendar) {
  const bookings = [...calendar.bookings].sort((a, b) => a.start.localeCompare(b.start));
  const schedule = {};

  dates.forEach((dateKey) => {
    schedule[dateKey] = bookings.some((booking) =>
      booking.start <= dateKey && dateKey < booking.end
    ) ? 'occupied' : 'free';
  });

  bookings.forEach((booking, index) => {
    const checkout = booking.end;
    const nextBooking = bookings.slice(index + 1).find((candidate) => candidate.start >= checkout);
    const nextCheckIn = nextBooking?.start || null;
    const required = nextCheckIn !== null && nextCheckIn <= addDays(checkout, 1);

    dates.forEach((dateKey) => {
      const isCleaningDay = required
        ? dateKey === checkout
        : dateKey >= checkout && (!nextCheckIn || dateKey < nextCheckIn);
      if (isCleaningDay) schedule[dateKey] = required ? 'required' : 'optional';
    });
  });

  if (calendar.assumeTurnoverToday && dates[0]) {
    schedule[dates[0]] = 'required';
  }

  return schedule;
}

function buildDateKeys(start, count) {
  return Array.from({ length: count }, (_, index) => addDays(start, index));
}

function addDays(dateKey, days) {
  const date = toDate(dateKey);
  date.setDate(date.getDate() + days);
  return dateKeyFromDate(date);
}

function toDate(dateKey) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
}

function dateKeyFromDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function todayLocal() {
  return dateKeyFromDate(new Date());
}

function formatDay(dateKey) {
  return toDate(dateKey).toLocaleDateString('pt-PT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  });
}

function formatShortRange(dates) {
  if (!dates.length) return '';
  const format = (dateKey) => toDate(dateKey).toLocaleDateString('pt-PT', {
    day: 'numeric',
    month: 'short'
  });
  return `${format(dates[0])}–${format(dates[dates.length - 1])}`;
}

function setMeta(message, isError = false) {
  if (!calendarMeta) return;
  calendarMeta.textContent = message;
  calendarMeta.classList.toggle('is-error', isError);
}

function setHtml(element, html) {
  if (element) element.innerHTML = html;
}

function isDateKey(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }[char]));
}
