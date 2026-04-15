import type { APIRoute } from 'astro';
import { readData, writeData } from '../../../lib/storage';
import { sendNewsletterToSubscriber } from '../../../lib/email';

type Lang = 'de' | 'en' | 'pl';

interface Subscriber {
  id: string;
  email: string;
  language: Lang;
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

async function loadJSON<T>(file: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readData(file));
  } catch {
    return fallback;
  }
}

export const GET: APIRoute = async ({ request }) => {
  const authHeader = request.headers.get('x-cron-secret');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== cronSecret) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const newsletters = await loadJSON<Newsletter[]>('newsletters.json', []);
    const subscribers = (await loadJSON<Subscriber[]>('subscribers.json', []))
      .filter(s => s.status === 'active');

    const now = Date.now();
    const due = newsletters.filter(
      n => n.status === 'scheduled' && n.scheduledFor && new Date(n.scheduledFor).getTime() <= now
    );

    const results: { id: string; sent: number }[] = [];

    for (const nl of due) {
      nl.status = 'sending';
      nl.updatedAt = new Date().toISOString();
      await writeData('newsletters.json', JSON.stringify(newsletters, null, 2));

      let sent = 0;
      for (const sub of subscribers) {
        try {
          await sendNewsletterToSubscriber(sub, nl);
          sent++;
        } catch (err) {
          console.error('[Cron newsletter]', sub.email, err);
        }
      }

      nl.status = 'sent';
      nl.sentAt = new Date().toISOString();
      nl.recipientCount = sent;
      nl.updatedAt = nl.sentAt;
      delete nl.scheduledFor;
      await writeData('newsletters.json', JSON.stringify(newsletters, null, 2));
      results.push({ id: nl.id, sent });
    }

    return new Response(JSON.stringify({ ok: true, processed: results }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[Cron send-scheduled]', err);
    return new Response(JSON.stringify({ error: 'Internal error' }), { status: 500 });
  }
};
