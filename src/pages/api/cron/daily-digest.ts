import type { APIRoute } from 'astro';
import { readData } from '../../../lib/storage';
import { sendAdminDailyDigest } from '../../../lib/email';

interface Appointment {
  id: string;
  date: string;
  time: string;
  name: string;
  email: string;
  company?: string;
  topic?: string;
  status: string;
}

async function loadAppointments(): Promise<Appointment[]> {
  try {
    const raw = await readData('appointments.json');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export const GET: APIRoute = async ({ request }) => {
  const authHeader = request.headers.get('x-cron-secret');
  const cronSecret = process.env.CRON_SECRET;
  
  if (cronSecret && authHeader !== cronSecret) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const appointments = await loadAppointments();
    const todayStr = new Date().toISOString().slice(0, 10);
    
    const pendingAppts = appointments.filter(
      a => a.status === 'pending' && a.date >= todayStr
    );

    await sendAdminDailyDigest(pendingAppts);

    return new Response(JSON.stringify({ 
      ok: true, 
      sent: pendingAppts.length 
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[DailyDigest] Error:', err);
    return new Response(JSON.stringify({ error: 'Internal error' }), { status: 500 });
  }
};