const COLORS = ['#60a5fa', '#34d399', '#fbbf24', '#c084fc', '#fb7185', '#22d3ee', '#fb923c'];

function localISO(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function attendanceDays(today = new Date()) {
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12);
  start.setDate(start.getDate() - (start.getDay() + 6) % 7 - 21);
  return Array.from({ length: 28 }, (_, index) => {
    const date = new Date(start);
    date.setDate(date.getDate() + index);
    return { date: localISO(date), day: date.getDate(), today: localISO(date) === localISO(today), future: localISO(date) > localISO(today) };
  });
}

export function attendanceColors(trainings) {
  return new Map([...new Set(trainings)].map((training, index) => [training, COLORS[index % COLORS.length]]));
}

export function renderAttendance(container, days, workouts, colors) {
  container.replaceChildren();
  const dateFormat = new Intl.DateTimeFormat('pt-PT', { day: 'numeric', month: 'long', year: 'numeric' });
  days.forEach(day => {
    const sessions = workouts.filter(workout => workout.date === day.date);
    const dayColors = [...new Set(sessions.map(workout => colors.get(workout.treino) || COLORS[0]))];
    const cell = document.createElement('span');
    cell.className = 'gym-attendance-day';
    cell.textContent = String(day.day);
    cell.dataset.future = String(day.future);
    cell.dataset.present = String(sessions.length > 0);
    if (day.today) cell.setAttribute('aria-current', 'date');
    const label = `${dateFormat.format(new Date(`${day.date}T12:00:00`))}: ${sessions.length ? sessions.map(session => session.treino).join(', ') : day.future ? 'Por realizar' : 'Sem treino'}`;
    cell.title = label;
    cell.setAttribute('role', 'img');
    cell.setAttribute('aria-label', label);
    if (dayColors.length === 1) cell.style.background = dayColors[0];
    if (dayColors.length > 1) {
      cell.style.background = `linear-gradient(135deg, ${dayColors.map((color, index) => `${color} ${index * 100 / dayColors.length}% ${(index + 1) * 100 / dayColors.length}%`).join(', ')})`;
    }
    container.appendChild(cell);
  });
}
