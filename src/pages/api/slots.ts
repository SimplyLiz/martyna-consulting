import type { APIRoute } from 'astro';
import { readData } from '../../lib/storage';

interface DaySchedule {
  enabled: boolean;
  slots: { start: string; end: string }[];
}

interface SlotsConfig {
  weeklySchedule: Record<string, DaySchedule>;
  slotDurationMinutes: number;
  overrides: Record<string, DaySchedule | false>;
  blockedDates: string[];
}

interface Appointment {
  date: string;
  time: string;
  status: 'confirmed' | 'cancelled';
}

async function loadConfig(): Promise<SlotsConfig> {
  const raw = await readData('slots-config.json');
  return JSON.parse(raw);
}

async function loadAppointments(): Promise<Appointment[]> {
  try {
    const raw = await readData('appointments.json');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function generateTimeSlots(
  ranges: { start: string; end: string }[],
  durationMin: number
): string[] {
  const slots: string[] = [];
  for (const range of ranges) {
    const [sh, sm] = range.start.split(':').map(Number);
    const [eh, em] = range.end.split(':').map(Number);
    let cur = sh * 60 + sm;
    const end = eh * 60 + em;
    while (cur + durationMin <= end) {
      const h = Math.floor(cur / 60);
      const m = cur % 60;
      slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
      cur += durationMin;
    }
  }
  return slots;
}

export const GET: APIRoute = async ({ url }) => {
  try {
    const params = url.searchParams;
    const config = await loadConfig();
    const appointments = await loadAppointments();

    if (params.has('date')) {
      const dateStr = params.get('date')!;
      const date = new Date(dateStr + 'T12:00:00');
      if (isNaN(date.getTime())) return json({ error: 'Ungültiges Datum.' }, 400);

      if (config.blockedDates.includes(dateStr)) return json({ slots: [] });

      const dayOfWeek = String(date.getDay());
      let schedule: DaySchedule | false;

      if (dateStr in config.overrides) {
        schedule = config.overrides[dateStr];
      } else {
        schedule = config.weeklySchedule[dayOfWeek];
      }

      if (!schedule || !schedule.enabled) return json({ slots: [] });

      const allSlots = generateTimeSlots(schedule.slots, config.slotDurationMinutes);
      const bookedTimes = appointments
        .filter(a => a.date === dateStr && a.status !== 'cancelled')
        .map(a => a.time);

      const now = new Date();
      const todayStr = now.toISOString().slice(0, 10);
      const available = allSlots.filter(slot => {
        if (bookedTimes.includes(slot)) return false;
        if (dateStr === todayStr) {
          const [h, m] = slot.split(':').map(Number);
          const slotDate = new Date();
          slotDate.setHours(h, m, 0, 0);
          return slotDate.getTime() > now.getTime() + 2 * 60 * 60 * 1000;
        }
        return true;
      });

      return json({ date: dateStr, slots: available });
    }

    if (params.has('year') && params.has('month')) {
      const year = parseInt(params.get('year')!);
      const month = parseInt(params.get('month')!);
      if (isNaN(year) || isNaN(month)) return json({ error: 'Ungültige Parameter.' }, 400);

      const daysInMonth = new Date(year, month, 0).getDate();
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const availableDates: string[] = [];

      for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const date = new Date(year, month - 1, d);

        if (date < today) continue;
        if (config.blockedDates.includes(dateStr)) continue;

        const dayOfWeek = String(date.getDay());
        let schedule: DaySchedule | false;

        if (dateStr in config.overrides) {
          schedule = config.overrides[dateStr];
        } else {
          schedule = config.weeklySchedule[dayOfWeek];
        }

        if (!schedule || !schedule.enabled) continue;

        const allSlots = generateTimeSlots(schedule.slots, config.slotDurationMinutes);
        const bookedCount = appointments.filter(
          a => a.date === dateStr && a.status !== 'cancelled'
        ).length;

        if (allSlots.length - bookedCount > 0) availableDates.push(dateStr);
      }

      return json({ year, month, availableDates });
    }

    return json({ error: 'Parameter fehlen.' }, 400);
  } catch (err) {
    console.error('[Slots] Error:', err);
    return json({ error: 'Interner Fehler.' }, 500);
  }
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
