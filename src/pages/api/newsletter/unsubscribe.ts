import type { APIRoute } from 'astro';
import { readData, writeData } from '../../../lib/storage';

async function load() {
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
    const token = String(body.token || '');
    if (!token) return json({ error: 'Missing token' }, 400);

    const subs = await load();
    const sub = subs.find((s: { token: string }) => s.token === token);
    if (!sub) return json({ error: 'Not found' }, 404);

    sub.status = 'unsubscribed';
    await writeData('subscribers.json', JSON.stringify(subs, null, 2));
    return json({ ok: true });
  } catch (err) {
    console.error('[Newsletter unsubscribe]', err);
    return json({ error: 'Internal error' }, 500);
  }
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
