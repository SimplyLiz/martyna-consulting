import type { APIRoute } from 'astro';
import { appendData } from '../../lib/storage';

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { name, email, company, subject, message } = body;

    if (!name || !email || !message) {
      return json({ error: 'Pflichtfelder fehlen.' }, 400);
    }

    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRe.test(email)) {
      return json({ error: 'Ungültige E-Mail-Adresse.' }, 400);
    }

    const entry = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      name: String(name).slice(0, 200),
      email: String(email).slice(0, 200),
      company: String(company || '').slice(0, 200),
      subject: String(subject || '').slice(0, 100),
      message: String(message).slice(0, 2000),
    };

    await appendData('contacts.ndjson', JSON.stringify(entry) + '\n');
    console.log(`[Contact] New message from ${entry.name} <${entry.email}>`);

    return json({ ok: true });
  } catch (err) {
    console.error('[Contact] Error:', err);
    return json({ error: 'Interner Fehler.' }, 500);
  }
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
