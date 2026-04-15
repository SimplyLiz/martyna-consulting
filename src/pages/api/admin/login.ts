import type { APIRoute } from 'astro';
import { verifyPassword, issueSession } from '../../../lib/auth';

const attempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 8;
const WINDOW_MS = 15 * 60 * 1000;

function limited(ip: string): boolean {
  const now = Date.now();
  const b = attempts.get(ip);
  if (!b || b.resetAt < now) {
    attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  if (b.count >= MAX_ATTEMPTS) return true;
  b.count++;
  return false;
}

export const POST: APIRoute = async ({ request, cookies, clientAddress }) => {
  const ip = clientAddress || 'unknown';
  if (limited(ip)) return json({ error: 'Too many attempts' }, 429);

  try {
    const { password } = await request.json();
    if (typeof password !== 'string' || !verifyPassword(password)) {
      return json({ error: 'Invalid credentials' }, 401);
    }
    issueSession(cookies);
    return json({ ok: true });
  } catch {
    return json({ error: 'Bad request' }, 400);
  }
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
