import type { APIRoute } from 'astro';
import { readData, writeData } from '../../lib/storage';

interface PageView {
  path: string;
  timestamp: string;
  referrer?: string;
  sid?: string; // visitor session ID
}

async function loadPageViews(): Promise<PageView[]> {
  try {
    const raw = await readData('pageviews.json');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function savePageViews(views: PageView[]): Promise<void> {
  await writeData('pageviews.json', JSON.stringify(views, null, 2));
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { path, referrer, sid } = body;

    if (!path || typeof path !== 'string') {
      return json({ error: 'Path required' }, 400);
    }

    const views = await loadPageViews();
    views.push({
      path: path.slice(0, 200),
      timestamp: new Date().toISOString(),
      referrer: referrer?.slice(0, 500) || null,
      sid: sid?.slice(0, 50) || null,
    });

    const maxViews = 10000;
    if (views.length > maxViews) {
      views.splice(0, views.length - maxViews);
    }

    await savePageViews(views);
    return json({ ok: true });
  } catch (err) {
    console.error('[Track] Error:', err);
    return json({ error: 'Internal error' }, 500);
  }
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}