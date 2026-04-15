import type { APIRoute } from 'astro';
import { randomBytes } from 'crypto';
import { readData, writeData } from '../../../lib/storage';
import { sendNewsletterToSubscriber } from '../../../lib/email';
import { isAuthenticated } from '../../../lib/auth';

type Lang = 'de' | 'en' | 'pl';

interface Subscriber {
  id: string;
  email: string;
  language: Lang;
  subscribedAt: string;
  status: 'active' | 'unsubscribed';
  token: string;
}

interface Newsletter {
  id: string;
  subject: { de: string; en: string; pl: string };
  body: { de: string; en: string; pl: string };
  status: 'draft' | 'scheduled' | 'sending' | 'sent';
  scheduledFor?: string;
  createdAt: string;
  updatedAt: string;
  sentAt?: string;
  recipientCount?: number;
}

async function loadNewsletters(): Promise<Newsletter[]> {
  try {
    return JSON.parse(await readData('newsletters.json'));
  } catch {
    return [];
  }
}

async function loadSubscribers(): Promise<Subscriber[]> {
  try {
    return JSON.parse(await readData('subscribers.json'));
  } catch {
    return [];
  }
}

async function saveNewsletters(nls: Newsletter[]) {
  await writeData('newsletters.json', JSON.stringify(nls, null, 2));
}

async function saveSubscribers(subs: Subscriber[]) {
  await writeData('subscribers.json', JSON.stringify(subs, null, 2));
}

function emptyLangs() {
  return { de: '', en: '', pl: '' };
}

function sanitizeLangMap(input: unknown, max: number): { de: string; en: string; pl: string } {
  const src = (input && typeof input === 'object') ? input as Record<string, unknown> : {};
  const pick = (k: string) => String(src[k] ?? '').slice(0, max);
  return { de: pick('de'), en: pick('en'), pl: pick('pl') };
}

async function sendOne(nl: Newsletter): Promise<number> {
  const subs = (await loadSubscribers()).filter(s => s.status === 'active');
  let sent = 0;
  for (const sub of subs) {
    try {
      await sendNewsletterToSubscriber(sub, nl);
      sent++;
    } catch (err) {
      console.error('[Newsletter send]', sub.email, err);
    }
  }
  return sent;
}

export const GET: APIRoute = async ({ cookies }) => {
  if (!isAuthenticated(cookies)) return json({ error: 'Unauthorized' }, 401);
  const [newsletters, subscribers] = await Promise.all([loadNewsletters(), loadSubscribers()]);
  return json({ newsletters, subscribers });
};

export const POST: APIRoute = async ({ request, cookies }) => {
  if (!isAuthenticated(cookies)) return json({ error: 'Unauthorized' }, 401);

  try {
    const { action, payload } = await request.json();
    const newsletters = await loadNewsletters();
    const now = new Date().toISOString();

    if (action === 'create') {
      const nl: Newsletter = {
        id: Date.now().toString(36) + randomBytes(3).toString('hex'),
        subject: sanitizeLangMap(payload?.subject, 300),
        body: sanitizeLangMap(payload?.body, 50000),
        status: 'draft',
        createdAt: now,
        updatedAt: now,
      };
      newsletters.unshift(nl);
      await saveNewsletters(newsletters);
      return json({ ok: true, newsletter: nl });
    }

    if (action === 'update') {
      const idx = newsletters.findIndex(n => n.id === payload?.id);
      if (idx === -1) return json({ error: 'Not found' }, 404);
      const n = newsletters[idx];
      if (n.status === 'sent') return json({ error: 'Already sent' }, 400);
      if (payload.subject !== undefined) n.subject = sanitizeLangMap(payload.subject, 300);
      if (payload.body !== undefined) n.body = sanitizeLangMap(payload.body, 50000);
      n.updatedAt = now;
      await saveNewsletters(newsletters);
      return json({ ok: true, newsletter: n });
    }

    if (action === 'schedule') {
      const idx = newsletters.findIndex(n => n.id === payload?.id);
      if (idx === -1) return json({ error: 'Not found' }, 404);
      const when = new Date(payload.scheduledFor);
      if (isNaN(when.getTime())) return json({ error: 'Invalid date' }, 400);
      if (when.getTime() < Date.now() - 60_000) return json({ error: 'Date is in the past' }, 400);
      newsletters[idx].scheduledFor = when.toISOString();
      newsletters[idx].status = 'scheduled';
      newsletters[idx].updatedAt = now;
      await saveNewsletters(newsletters);
      return json({ ok: true, newsletter: newsletters[idx] });
    }

    if (action === 'unschedule') {
      const idx = newsletters.findIndex(n => n.id === payload?.id);
      if (idx === -1) return json({ error: 'Not found' }, 404);
      if (newsletters[idx].status !== 'scheduled') return json({ error: 'Not scheduled' }, 400);
      newsletters[idx].status = 'draft';
      delete newsletters[idx].scheduledFor;
      newsletters[idx].updatedAt = now;
      await saveNewsletters(newsletters);
      return json({ ok: true, newsletter: newsletters[idx] });
    }

    if (action === 'sendNow') {
      const idx = newsletters.findIndex(n => n.id === payload?.id);
      if (idx === -1) return json({ error: 'Not found' }, 404);
      const n = newsletters[idx];
      if (n.status === 'sent' || n.status === 'sending') return json({ error: 'Already sent/sending' }, 400);
      n.status = 'sending';
      n.updatedAt = now;
      await saveNewsletters(newsletters);

      const count = await sendOne(n);
      n.status = 'sent';
      n.sentAt = new Date().toISOString();
      n.recipientCount = count;
      n.updatedAt = n.sentAt;
      delete n.scheduledFor;
      await saveNewsletters(newsletters);
      return json({ ok: true, newsletter: n });
    }

    if (action === 'delete') {
      const idx = newsletters.findIndex(n => n.id === payload?.id);
      if (idx === -1) return json({ error: 'Not found' }, 404);
      if (newsletters[idx].status === 'sent') return json({ error: 'Cannot delete sent' }, 400);
      newsletters.splice(idx, 1);
      await saveNewsletters(newsletters);
      return json({ ok: true });
    }

    if (action === 'removeSubscriber') {
      const subs = await loadSubscribers();
      const s = subs.find(x => x.id === payload?.id);
      if (!s) return json({ error: 'Not found' }, 404);
      s.status = 'unsubscribed';
      await saveSubscribers(subs);
      return json({ ok: true });
    }

    return json({ error: 'Unknown action' }, 400);
  } catch (err) {
    console.error('[Admin/newsletter]', err);
    return json({ error: 'Internal error' }, 500);
  }
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
