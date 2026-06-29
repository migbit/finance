import { showToast } from './toast.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js';

const APARTMENTS = {
  '123': {
    color: '#1677d2',
    dark: '#0b4f91',
    light: '#e8f3ff'
  },
  '1248': {
    color: '#ed7a16',
    dark: '#9a4300',
    light: '#fff0e2'
  }
};

const generateButton = document.getElementById('generate-cleaning-calendar');
const copyButton = document.getElementById('copy-cleaning-calendar');
const statusElement = document.getElementById('cleaning-calendar-status');
const previewElement = document.getElementById('cleaning-calendar-preview');
const imageElement = document.getElementById('cleaning-calendar-image');

let currentImageBlob = null;
let currentImageUrl = '';

generateButton?.addEventListener('click', generateCalendar);
copyButton?.addEventListener('click', copyCalendarImage);

async function generateCalendar() {
  setLoading(true);
  setStatus('A carregar os calendários Airbnb...');

  try {
    const user = getAuth().currentUser;
    if (!user) {
      throw new Error('Inicie sessão para gerar o calendário.');
    }

    const start = todayLocal();
    const url = new URL('/api/cleaning-calendar', getApiOrigin());
    url.searchParams.set('start', start);

    const response = await fetch(url.toString(), {
      cache: 'no-store',
      headers: {
        Authorization: `Bearer ${await user.getIdToken()}`
      }
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || 'Não foi possível carregar os calendários.');
    }

    const canvas = drawCalendar(payload);
    currentImageBlob = await canvasToBlob(canvas);

    if (currentImageUrl) URL.revokeObjectURL(currentImageUrl);
    currentImageUrl = URL.createObjectURL(currentImageBlob);
    imageElement.src = currentImageUrl;
    previewElement.hidden = false;
    copyButton.hidden = false;
    setStatus(`Calendário criado: ${formatDateRange(payload.start, payload.days)}.`);
  } catch (error) {
    console.error(error);
    setStatus(error.message || 'Erro ao gerar o calendário.', true);
    showToast('Erro ao gerar o calendário de limpezas.', 'error');
  } finally {
    setLoading(false);
  }
}

async function copyCalendarImage() {
  if (!currentImageBlob) return;

  if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') {
    setStatus('Este browser não permite copiar imagens. Pode manter a imagem pressionada para a guardar.', true);
    return;
  }

  copyButton.disabled = true;
  try {
    await navigator.clipboard.write([
      new ClipboardItem({ 'image/png': currentImageBlob })
    ]);
    setStatus('Imagem copiada. Já pode colá-la numa mensagem.');
    showToast('Imagem copiada.', 'success');
  } catch (error) {
    console.error(error);
    setStatus('Não foi possível copiar automaticamente. Pode manter a imagem pressionada para a guardar.', true);
    showToast('O browser não permitiu copiar a imagem.', 'warning');
  } finally {
    copyButton.disabled = false;
  }
}

function drawCalendar(payload) {
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 1600;
  const ctx = canvas.getContext('2d');
  const dates = buildDateKeys(payload.start, Number(payload.days) || 14);
  const calendars = normalizeCalendars(payload.calendars);
  const schedules = {
    '123': buildCleaningSchedule(dates, calendars['123']),
    '1248': buildCleaningSchedule(dates, calendars['1248'])
  };

  ctx.fillStyle = '#f4f7fb';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = APARTMENTS['123'].color;
  ctx.fillRect(0, 0, canvas.width / 2, 12);
  ctx.fillStyle = APARTMENTS['1248'].color;
  ctx.fillRect(canvas.width / 2, 0, canvas.width / 2, 12);

  ctx.fillStyle = '#172033';
  ctx.font = '800 50px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('CALENDÁRIO DE LIMPEZAS', canvas.width / 2, 82);

  ctx.fillStyle = '#526074';
  ctx.font = '600 27px Arial, sans-serif';
  ctx.fillText(formatDateRange(payload.start, dates.length), canvas.width / 2, 126);

  const columns = [
    { x: 48, dates: dates.slice(0, 7), title: 'SEMANA 1' },
    { x: 610, dates: dates.slice(7, 14), title: 'SEMANA 2' }
  ];
  const columnWidth = 542;

  columns.forEach((column) => {
    ctx.fillStyle = '#172033';
    ctx.font = '800 25px Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(column.title, column.x, 202);

    ctx.fillStyle = '#718096';
    ctx.font = '600 19px Arial, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(shortRange(column.dates), column.x + columnWidth, 202);

    column.dates.forEach((dateKey, index) => {
      drawDayCard(ctx, {
        x: column.x,
        y: 226 + index * 155,
        width: columnWidth,
        height: 141,
        dateKey,
        schedules
      });
    });
  });

  drawCleaningSummary(ctx, dates, schedules);
  return canvas;
}

function drawDayCard(ctx, { x, y, width, height, dateKey, schedules }) {
  roundedRect(ctx, x, y, width, height, 14);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.strokeStyle = '#dce3ec';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = '#202a3b';
  ctx.font = '800 24px Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(formatDayHeading(dateKey), x + 18, y + 35);

  const gap = 12;
  const statusWidth = (width - 36 - gap) / 2;
  drawApartmentStatus(ctx, x + 18, y + 53, statusWidth, 70, '123', schedules['123'][dateKey]);
  drawApartmentStatus(ctx, x + 18 + statusWidth + gap, y + 53, statusWidth, 70, '1248', schedules['1248'][dateKey]);
}

function drawApartmentStatus(ctx, x, y, width, height, apartment, status) {
  const theme = APARTMENTS[apartment];
  roundedRect(ctx, x, y, width, height, 11);

  if (status === 'required') {
    ctx.fillStyle = '#d62828';
    ctx.fill();
    ctx.fillStyle = theme.color;
    ctx.fillRect(x, y + 8, 7, height - 16);
  } else if (status === 'optional') {
    ctx.fillStyle = '#20242c';
    ctx.fill();
    ctx.fillStyle = theme.color;
    ctx.fillRect(x, y + 8, 7, height - 16);
  } else if (status === 'free') {
    ctx.fillStyle = theme.light;
    ctx.fill();
    ctx.strokeStyle = theme.color;
    ctx.lineWidth = 2;
    ctx.stroke();
  } else {
    ctx.fillStyle = '#edf1f5';
    ctx.fill();
    ctx.fillStyle = theme.color;
    ctx.fillRect(x, y + 8, 7, height - 16);
  }

  const isCleaning = status === 'required' || status === 'optional';
  const mainColor = isCleaning ? '#ffffff' : status === 'free' ? theme.dark : '#566477';
  ctx.fillStyle = mainColor;
  ctx.textAlign = 'left';
  ctx.font = '800 20px Arial, sans-serif';
  ctx.fillText(`AP. ${apartment}`, x + 17, y + 27);
  ctx.font = '900 23px Arial, sans-serif';
  ctx.fillText(
    status === 'required' ? 'LIMPAR!' : status === 'optional' ? 'LIMPAR' : status === 'free' ? 'LIVRE' : 'OCUPADO',
    x + 17,
    y + 55
  );
}

function drawCleaningSummary(ctx, dates, schedules) {
  const y = 1355;
  ctx.fillStyle = '#172033';
  ctx.textAlign = 'left';
  ctx.font = '800 25px Arial, sans-serif';
  ctx.fillText('DIAS DE LIMPEZA', 48, y);

  ['123', '1248'].forEach((apartment, index) => {
    const lineY = y + 47 + index * 43;
    const cleaningDates = dates.filter((dateKey) =>
      ['required', 'optional'].includes(schedules[apartment][dateKey])
    );
    ctx.fillStyle = APARTMENTS[apartment].color;
    roundedRect(ctx, 48, lineY - 20, 22, 22, 5);
    ctx.fill();

    ctx.fillStyle = '#263246';
    ctx.font = '700 22px Arial, sans-serif';
    ctx.fillText(
      `Apartamento ${apartment}: ${cleaningDates.length
        ? formatCleaningDateList(cleaningDates, schedules[apartment])
        : 'sem limpezas nestas duas semanas'}`,
      84,
      lineY
    );
  });

  ctx.fillStyle = '#687588';
  ctx.font = '600 19px Arial, sans-serif';
  ctx.fillText('VERMELHO = limpar nesse dia  •  PRETO = pode limpar nesse dia', 48, 1510);
  ctx.fillText(`Atualizado em ${new Date().toLocaleString('pt-PT', { dateStyle: 'short', timeStyle: 'short' })}`, 48, 1545);
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

function buildCleaningSchedule(dates, calendar) {
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
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(year, month - 1, day, 12);
  date.setDate(date.getDate() + days);
  return toDateKey(date);
}

function toLocalDate(dateKey) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
}

function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDayHeading(dateKey) {
  return toLocalDate(dateKey)
    .toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })
    .toLocaleUpperCase('pt-PT');
}

function formatShortDate(dateKey) {
  return toLocalDate(dateKey).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' });
}

function formatCleaningDateList(dateKeys, schedule) {
  const groups = [];

  dateKeys.forEach((dateKey) => {
    const status = schedule[dateKey];
    const last = groups[groups.length - 1];
    if (last && last.status === status && addDays(last.end, 1) === dateKey) {
      last.end = dateKey;
    } else {
      groups.push({ start: dateKey, end: dateKey, status });
    }
  });

  return groups.map((group) => {
    const suffix = group.status === 'required' ? '!' : '';
    if (group.start === group.end) return `${formatShortDate(group.start)}${suffix}`;
    return `${formatShortDate(group.start)}–${formatShortDate(group.end)}${suffix}`;
  }).join(' · ');
}

function formatDateRange(start, days) {
  const end = addDays(start, days - 1);
  const startLabel = toLocalDate(start).toLocaleDateString('pt-PT', { day: 'numeric', month: 'long' });
  const endLabel = toLocalDate(end).toLocaleDateString('pt-PT', { day: 'numeric', month: 'long', year: 'numeric' });
  return `${startLabel} a ${endLabel}`;
}

function shortRange(dates) {
  if (!dates.length) return '';
  return `${formatShortDate(dates[0])} — ${formatShortDate(dates[dates.length - 1])}`;
}

function roundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
}

function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Não foi possível criar a imagem.'));
    }, 'image/png');
  });
}

function setLoading(isLoading) {
  generateButton.disabled = isLoading;
  generateButton.textContent = isLoading ? 'A gerar...' : 'Gerar calendário de limpezas';
}

function setStatus(message, isError = false) {
  statusElement.textContent = message;
  statusElement.classList.toggle('is-error', isError);
}

function getApiOrigin() {
  const host = window.location.hostname;
  if (host === 'localhost' || host === '127.0.0.1') {
    return 'https://apartments-a4b17.web.app';
  }
  return window.location.origin;
}

function todayLocal() {
  return toDateKey(new Date());
}

function isDateKey(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));
}
