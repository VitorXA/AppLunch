// Cálculo de data/hora local no fuso configurado e janelas de refeição.

export function localTime(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type).value;
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    minutes: Number(get('hour')) * 60 + Number(get('minute')),
  };
}

export function toMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

/** Retorna a refeição cuja janela contém `now` (ou null) e a data local de hoje. */
export function currentMeal(meals, timeZone, now) {
  const t = localTime(now, timeZone);
  const meal = meals.find((m) => t.minutes >= toMinutes(m.start) && t.minutes < toMinutes(m.end)) ?? null;
  return { meal, date: t.date };
}
