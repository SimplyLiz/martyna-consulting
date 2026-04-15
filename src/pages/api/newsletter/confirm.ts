import type { APIRoute } from 'astro';
import { readData, writeData } from '../../../lib/storage';
import { sendSubscriberWelcome } from '../../../lib/email';

interface Subscriber {
  id: string;
  email: string;
  language: 'de' | 'en' | 'pl';
  status: 'pending' | 'active' | 'unsubscribed';
  token: string;
  confirmToken?: string;
  confirmedAt?: string;
}

async function load(): Promise<Subscriber[]> {
  try {
    return JSON.parse(await readData('subscribers.json'));
  } catch {
    return [];
  }
}

export const GET: APIRoute = async ({ url }) => {
  const token = url.searchParams.get('token') || '';
  return handle(token);
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const { token } = await request.json();
    return handle(String(token || ''));
  } catch {
    return json({ error: 'Bad request' }, 400);
  }
};

async function handle(token: string) {
  if (!token) return json({ error: 'Missing token' }, 400);
  const subs = await load();
  const sub = subs.find(s => s.confirmToken === token);
  if (!sub) return json({ error: 'Invalid or expired token' }, 404);
  if (sub.status === 'active') return json({ ok: true, alreadyActive: true });
  sub.status = 'active';
  sub.confirmedAt = new Date().toISOString();
  delete sub.confirmToken;
  await writeData('subscribers.json', JSON.stringify(subs, null, 2));
  sendSubscriberWelcome(sub).catch(err => console.error('[Newsletter welcome]', err));
  return json({ ok: true });
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
