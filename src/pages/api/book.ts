import type { APIRoute } from 'astro';
import { readData, writeData } from '../../lib/storage';
import { rateLimit } from '../../lib/rateLimit';

interface Appointment {
  id: string;
  date: string;
  time: string;
  name: string;
  email: string;
  company?: string;
  topic?: string;
  status: 'pending' | 'confirmed' | 'rejected' | 'cancelled';
  adminMessage?: string;
  createdAt: string;
}

async function loadAppointments(): Promise<Appointment[]> {
  try {
    const raw = await readData('appointments.json');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function saveAppointments(appointments: Appointment[]): Promise<void> {
  await writeData('appointments.json', JSON.stringify(appointments, null, 2));
}

export const POST: APIRoute = async ({ request, clientAddress }) => {
  const rl = rateLimit('book', clientAddress || 'unknown', 5, 60 * 60 * 1000);
  if (!rl.ok) return json({ error: 'Zu viele Buchungsversuche. Bitte später erneut versuchen.' }, 429);

  try {
    const body = await request.json();
    const { date, time, name, email, company, topic } = body;

    if (!date || !time || !name || !email) {
      return json({ error: 'Pflichtfelder fehlen.' }, 400);
    }

    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRe.test(email)) return json({ error: 'Ungültige E-Mail-Adresse.' }, 400);

    const dateRe = /^\d{4}-\d{2}-\d{2}$/;
    const timeRe = /^\d{2}:\d{2}$/;
    if (!dateRe.test(date) || !timeRe.test(time)) {
      return json({ error: 'Ungültiges Datum oder Uhrzeit.' }, 400);
    }

    const appointments = await loadAppointments();
    const alreadyBooked = appointments.some(
      a => a.date === date && a.time === time && a.status !== 'cancelled' && a.status !== 'rejected'
    );

    if (alreadyBooked) {
      return json({ error: 'Dieser Termin ist leider nicht mehr verfügbar. Bitte wählen Sie einen anderen.' }, 409);
    }

    const newAppointment: Appointment = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      date: String(date).slice(0, 10),
      time: String(time).slice(0, 5),
      name: String(name).slice(0, 200),
      email: String(email).slice(0, 200),
      company: String(company || '').slice(0, 200),
      topic: String(topic || '').slice(0, 1000),
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    appointments.push(newAppointment);
    await saveAppointments(appointments);

    console.log(`[Book] ${newAppointment.date} ${newAppointment.time} — ${newAppointment.name} <${newAppointment.email}>`);

    return json({ ok: true, id: newAppointment.id });
  } catch (err) {
    console.error('[Book] Error:', err);
    return json({ error: 'Interner Fehler. Bitte versuchen Sie es erneut.' }, 500);
  }
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
