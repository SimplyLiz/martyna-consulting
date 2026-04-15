import type { APIRoute } from 'astro';
import { readData, writeData } from '../../../lib/storage';
import { sendConfirmationEmail, sendRejectionEmail, sendRescheduleEmail, sendMessageEmail } from '../../../lib/email';
import { isAuthenticated } from '../../../lib/auth';

interface PageView {
  path: string;
  timestamp: string;
  referrer?: string;
}

async function loadConfig() {
  const raw = await readData('slots-config.json');
  return JSON.parse(raw);
}

async function loadAppointments() {
  try {
    const raw = await readData('appointments.json');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export const GET: APIRoute = async ({ cookies }) => {
  if (!isAuthenticated(cookies)) return json({ error: 'Unauthorized' }, 401);
  try {
    const config = await loadConfig();
    const appointments = await loadAppointments();
    let pageviews: PageView[] = [];
    try {
      const raw = await readData('pageviews.json');
      pageviews = JSON.parse(raw);
    } catch {}
    return json({ config, appointments, pageviews });
  } catch {
    return json({ error: 'Fehler beim Laden.' }, 500);
  }
};

export const POST: APIRoute = async ({ request, cookies }) => {
  if (!isAuthenticated(cookies)) return json({ error: 'Unauthorized' }, 401);

  try {
    const body = await request.json();
    const { action, payload } = body;
    const config = await loadConfig();

    if (action === 'updateWeekly') {
      const { day, enabled, slots } = payload;
      if (!['0','1','2','3','4','5','6'].includes(day)) return json({ error: 'Ungültiger Tag.' }, 400);
      config.weeklySchedule[day] = { enabled: Boolean(enabled), slots: slots || [] };

    } else if (action === 'setOverride') {
      const { date, enabled, slots } = payload;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return json({ error: 'Ungültiges Datum.' }, 400);
      config.overrides[date] = enabled ? { enabled: true, slots: slots || [] } : false;

    } else if (action === 'removeOverride') {
      delete config.overrides[payload.date];

    } else if (action === 'blockDate') {
      if (!config.blockedDates.includes(payload.date)) config.blockedDates.push(payload.date);

    } else if (action === 'unblockDate') {
      config.blockedDates = config.blockedDates.filter((d: string) => d !== payload.date);

    } else if (action === 'setDuration') {
      config.slotDurationMinutes = parseInt(payload.minutes);

    } else if (action === 'confirmAppointment') {
      const appointments = await loadAppointments();
      const idx = appointments.findIndex((a: { id: string }) => a.id === payload.id);
      if (idx === -1) return json({ error: 'Termin nicht gefunden.' }, 404);
      appointments[idx].status = 'confirmed';
      await writeData('appointments.json', JSON.stringify(appointments, null, 2));
      await sendConfirmationEmail(appointments[idx]);
      return json({ ok: true, appointment: appointments[idx] });

    } else if (action === 'rejectAppointment') {
      const appointments = await loadAppointments();
      const idx = appointments.findIndex((a: { id: string }) => a.id === payload.id);
      if (idx === -1) return json({ error: 'Termin nicht gefunden.' }, 404);
      appointments[idx].status = 'rejected';
      await writeData('appointments.json', JSON.stringify(appointments, null, 2));
      await sendRejectionEmail(appointments[idx]);
      return json({ ok: true, appointment: appointments[idx] });

    } else if (action === 'rescheduleAppointment') {
      const appointments = await loadAppointments();
      const idx = appointments.findIndex((a: { id: string }) => a.id === payload.id);
      if (idx === -1) return json({ error: 'Termin nicht gefunden.' }, 404);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(payload.date)) return json({ error: 'Ungültiges Datum.' }, 400);
      if (!/^\d{2}:\d{2}$/.test(payload.time)) return json({ error: 'Ungültige Uhrzeit.' }, 400);
      const oldDate = appointments[idx].date;
      const oldTime = appointments[idx].time;
      appointments[idx].date = payload.date;
      appointments[idx].time = payload.time;
      appointments[idx].status = 'confirmed';
      await writeData('appointments.json', JSON.stringify(appointments, null, 2));
      await sendRescheduleEmail(appointments[idx], oldDate, oldTime);
      return json({ ok: true, appointment: appointments[idx] });

    } else if (action === 'sendMessageToCustomer') {
      const appointments = await loadAppointments();
      const idx = appointments.findIndex((a: { id: string }) => a.id === payload.id);
      if (idx === -1) return json({ error: 'Termin nicht gefunden.' }, 404);
      appointments[idx].adminMessage = String(payload.message).slice(0, 2000);
      await writeData('appointments.json', JSON.stringify(appointments, null, 2));
      await sendMessageEmail(appointments[idx]);
      return json({ ok: true, appointment: appointments[idx] });

    } else if (action === 'cancelAppointment') {
      const appointments = await loadAppointments();
      const idx = appointments.findIndex((a: { id: string }) => a.id === payload.id);
      if (idx === -1) return json({ error: 'Termin nicht gefunden.' }, 404);
      appointments[idx].status = 'cancelled';
      await writeData('appointments.json', JSON.stringify(appointments, null, 2));
      return json({ ok: true });

    } else {
      return json({ error: 'Unbekannte Aktion.' }, 400);
    }

    await writeData('slots-config.json', JSON.stringify(config, null, 2));
    return json({ ok: true, config });
  } catch (err) {
    console.error('[Admin/slots] Error:', err);
    return json({ error: 'Interner Fehler.' }, 500);
  }
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
