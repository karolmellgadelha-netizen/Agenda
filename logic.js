/*
 * Lógica pura do app (sem acesso ao DOM), para poder ser testada no Node.
 * No navegador fica disponível em window.AgendaLogic.
 */
(function (root) {
  'use strict';

  const pad = (n) => String(n).padStart(2, '0');

  function toISO(d) {
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function parseISO(s) {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  function daysInMonth(y, m) {
    return new Date(y, m + 1, 0).getDate();
  }

  /** O compromisso acontece neste dia (considerando repetição)? */
  function occursOn(ev, iso) {
    if (!ev || !ev.date || iso < ev.date) return false;
    if ((ev.skip || []).includes(iso)) return false;

    const s = parseISO(ev.date);
    const d = parseISO(iso);

    switch (ev.repeat) {
      case 'daily':
        return true;
      case 'weekly':
        return s.getDay() === d.getDay();
      case 'monthly':
        // Se o mês é mais curto (ex.: dia 31), cai no último dia do mês.
        return d.getDate() === Math.min(s.getDate(), daysInMonth(d.getFullYear(), d.getMonth()));
      case 'yearly':
        return (
          s.getMonth() === d.getMonth() &&
          d.getDate() === Math.min(s.getDate(), daysInMonth(d.getFullYear(), d.getMonth()))
        );
      default:
        return iso === ev.date;
    }
  }

  /** Compromissos de um dia, ordenados (dia todo primeiro, depois por horário). */
  function eventsOn(events, iso) {
    return events
      .filter((ev) => occursOn(ev, iso))
      .sort((a, b) => {
        const ta = a.time || '';
        const tb = b.time || '';
        if (ta !== tb) return ta < tb ? -1 : 1;
        return (a.title || '').localeCompare(b.title || '', 'pt-BR');
      });
  }

  function isDone(ev, iso) {
    return !!(ev.done && ev.done[iso]);
  }

  /**
   * Lembretes que devem disparar agora.
   * `notified` é um objeto {chave: 1} com o que já foi avisado.
   * Só avisa até 1h depois do horário, para não despejar lembretes velhos.
   */
  function dueNow(events, now, notified) {
    const iso = toISO(now);
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const out = [];

    for (const ev of eventsOn(events, iso)) {
      if (!ev.time || ev.remind == null || ev.remind < 0) continue;
      if (isDone(ev, iso)) continue;

      const [h, m] = ev.time.split(':').map(Number);
      const evMin = h * 60 + m;
      const key = ev.id + '|' + iso + '|' + ev.time;
      if (notified[key]) continue;

      if (nowMin >= evMin - ev.remind && nowMin <= evMin + 60) {
        out.push({ ev, iso, key, minutesLeft: evMin - nowMin });
      }
    }
    return out;
  }

  // ---------- Exportar para o Calendário do iPhone (.ics) ----------

  function icsEscape(s) {
    return String(s || '')
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\r?\n/g, '\\n');
  }

  function buildICS(ev) {
    const compact = ev.date.replace(/-/g, '');
    const now = new Date();
    const stamp =
      now.getUTCFullYear() + pad(now.getUTCMonth() + 1) + pad(now.getUTCDate()) +
      'T' + pad(now.getUTCHours()) + pad(now.getUTCMinutes()) + pad(now.getUTCSeconds()) + 'Z';

    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Minha Agenda//PT-BR',
      'CALSCALE:GREGORIAN',
      'BEGIN:VEVENT',
      'UID:' + ev.id + '@minha-agenda',
      'DTSTAMP:' + stamp,
    ];

    if (ev.time) {
      lines.push('DTSTART:' + compact + 'T' + ev.time.replace(':', '') + '00');
      lines.push('DURATION:PT1H');
    } else {
      const next = parseISO(ev.date);
      next.setDate(next.getDate() + 1);
      lines.push('DTSTART;VALUE=DATE:' + compact);
      lines.push('DTEND;VALUE=DATE:' + toISO(next).replace(/-/g, ''));
    }

    lines.push('SUMMARY:' + icsEscape(ev.title));
    if (ev.notes) lines.push('DESCRIPTION:' + icsEscape(ev.notes));
    if (ev.category) lines.push('CATEGORIES:' + icsEscape(ev.category));

    const freq = { daily: 'DAILY', weekly: 'WEEKLY', monthly: 'MONTHLY', yearly: 'YEARLY' }[ev.repeat];
    if (freq) lines.push('RRULE:FREQ=' + freq);

    // Alarme: o Calendário do iPhone avisa com o app fechado.
    if (ev.time && ev.remind != null && ev.remind >= 0) {
      lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + icsEscape(ev.title));
      lines.push('TRIGGER:' + (ev.remind === 0 ? 'PT0S' : '-PT' + ev.remind + 'M'));
      lines.push('END:VALARM');
    } else if (!ev.time) {
      lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + icsEscape(ev.title));
      lines.push('TRIGGER:PT9H'); // 9h da manhã
      lines.push('END:VALARM');
    }

    lines.push('END:VEVENT', 'END:VCALENDAR');
    return lines.join('\r\n') + '\r\n';
  }

  const api = { toISO, parseISO, daysInMonth, occursOn, eventsOn, isDone, dueNow, buildICS };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AgendaLogic = api;
})(typeof window !== 'undefined' ? window : globalThis);
