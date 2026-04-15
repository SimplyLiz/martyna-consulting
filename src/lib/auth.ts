import { createHmac, timingSafeEqual } from 'crypto';
import type { AstroCookies } from 'astro';

const COOKIE_NAME = 'claritas_admin';
const MAX_AGE_SECONDS = 60 * 60 * 8; // 8h session

function getSecret(): string {
  const s = process.env.SESSION_SECRET || process.env.ADMIN_PASSWORD;
  if (!s) throw new Error('SESSION_SECRET or ADMIN_PASSWORD must be set');
  return s;
}

function sign(payload: string): string {
  return createHmac('sha256', getSecret()).update(payload).digest('hex');
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export function verifyPassword(input: string): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  return safeEqual(input, expected);
}

export function issueSession(cookies: AstroCookies): void {
  const exp = Date.now() + MAX_AGE_SECONDS * 1000;
  const payload = `v1.${exp}`;
  const token = `${payload}.${sign(payload)}`;
  cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE_SECONDS,
  });
}

export function clearSession(cookies: AstroCookies): void {
  cookies.delete(COOKIE_NAME, { path: '/' });
}

export function isAuthenticated(cookies: AstroCookies): boolean {
  const raw = cookies.get(COOKIE_NAME)?.value;
  if (!raw) return false;
  const lastDot = raw.lastIndexOf('.');
  if (lastDot < 0) return false;
  const payload = raw.slice(0, lastDot);
  const sig = raw.slice(lastDot + 1);
  if (!safeEqual(sig, sign(payload))) return false;
  const [version, expStr] = payload.split('.');
  if (version !== 'v1') return false;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < Date.now()) return false;
  return true;
}
