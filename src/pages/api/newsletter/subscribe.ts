import type { APIRoute } from 'astro';
import { randomBytes } from 'crypto';
import { readData, writeData } from '../../../lib/storage';
import { sendSubscriberWelcome } from '../../../lib/email';

type Lang = 'de' | 'en' | 'pl';

interface Subscriber {
  id: string;
  email: string;
  language: Lang;
  subscribedAt: string;
  status: 'active' | 'unsubscribed';
  token: string;
}

async function loadSubscribers(): Promise<Subscriber[]> {
  try {
    const raw = await readData('subscribers.json');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const email = String(body.email || '').trim().toLowerCase();
    const language = ['de', 'en', 'pl'].includes(body.language) ? (body.language as Lang) : 'de';

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json({ error: 'Invalid email' }, 400);
    }
    if (email.length > 200) return json({ error: 'Invalid email' }, 400);

    const subs = await loadSubscribers();
    const existing = subs.find(s => s.email === email);

    if (existing) {
      existing.language = language;
      if (existing.status === 'unsubscribed') {
        existing.status = 'active';
        existing.subscribedAt = new Date().toISOString();
      }
      await writeData('subscribers.json', JSON.stringify(subs, null, 2));
      return json({ ok: true, resubscribed: existing.status === 'active' });
    }

    const sub: Subscriber = {
      id: Date.now().toString(36) + randomBytes(3).toString('hex'),
      email,
      language,
      subscribedAt: new Date().toISOString(),
      status: 'active',
      token: randomBytes(24).toString('hex'),
    };
    subs.push(sub);
    await writeData('subscribers.json', JSON.stringify(subs, null, 2));

    sendSubscriberWelcome(sub).catch(err => console.error('[Newsletter welcome]', err));

    return json({ ok: true });
  } catch (err) {
    console.error('[Newsletter subscribe]', err);
    return json({ error: 'Internal error' }, 500);
  }
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
