import type { APIRoute } from 'astro';
import { randomBytes } from 'crypto';
import { readData, writeData } from '../../../lib/storage';
import { sendSubscriberConfirm } from '../../../lib/email';
import { rateLimit } from '../../../lib/rateLimit';

type Lang = 'de' | 'en' | 'pl';

interface Subscriber {
  id: string;
  email: string;
  language: Lang;
  subscribedAt: string;
  confirmedAt?: string;
  status: 'pending' | 'active' | 'unsubscribed';
  token: string;
  confirmToken?: string;
}

async function loadSubscribers(): Promise<Subscriber[]> {
  try {
    const raw = await readData('subscribers.json');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export const POST: APIRoute = async ({ request, clientAddress }) => {
  const rl = rateLimit('newsletter', clientAddress || 'unknown', 5, 60 * 60 * 1000);
  if (!rl.ok) return json({ error: 'Too many requests' }, 429);

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
      if (existing.status === 'unsubscribed' || existing.status === 'pending') {
        existing.status = 'pending';
        existing.confirmToken = randomBytes(24).toString('hex');
        existing.subscribedAt = new Date().toISOString();
        await writeData('subscribers.json', JSON.stringify(subs, null, 2));
        sendSubscriberConfirm(existing).catch(err => console.error('[Newsletter confirm]', err));
        return json({ ok: true, pending: true });
      }
      await writeData('subscribers.json', JSON.stringify(subs, null, 2));
      return json({ ok: true, alreadyActive: true });
    }

    const sub: Subscriber = {
      id: Date.now().toString(36) + randomBytes(3).toString('hex'),
      email,
      language,
      subscribedAt: new Date().toISOString(),
      status: 'pending',
      token: randomBytes(24).toString('hex'),
      confirmToken: randomBytes(24).toString('hex'),
    };
    subs.push(sub);
    await writeData('subscribers.json', JSON.stringify(subs, null, 2));

    sendSubscriberConfirm(sub).catch(err => console.error('[Newsletter confirm]', err));

    return json({ ok: true, pending: true });
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
