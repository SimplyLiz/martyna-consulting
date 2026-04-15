/**
 * Storage abstraction.
 * - Local dev: reads/writes from <project>/data/
 * - Vercel: copies seed files to /tmp/claritas-data/ on first access,
 *   then reads/writes from there. Data survives warm invocations but
 *   resets on cold starts. Upgrade to Vercel KV/Blob for full persistence.
 */
import { readFile, writeFile, mkdir, copyFile, access } from 'fs/promises';
import { join } from 'path';

const IS_VERCEL = Boolean(process.env.VERCEL);
const LOCAL_DATA = join(process.cwd(), 'data');
const VERCEL_DATA = '/tmp/claritas-data';

const DATA_DIR = IS_VERCEL ? VERCEL_DATA : LOCAL_DATA;

async function ensureDir() {
  await mkdir(DATA_DIR, { recursive: true });
}

async function seedIfMissing(filename: string) {
  if (!IS_VERCEL) return;
  const target = join(VERCEL_DATA, filename);
  try {
    await access(target);
  } catch {
    // File doesn't exist in /tmp yet — copy from bundled data
    const src = join(LOCAL_DATA, filename);
    try {
      await copyFile(src, target);
    } catch {
      // Seed file also missing — write empty defaults
      const defaults: Record<string, string> = {
        'appointments.json': '[]',
        'contacts.ndjson': '',
        'subscribers.json': '[]',
        'newsletters.json': '[]',
      };
      if (filename in defaults) {
        await writeFile(target, defaults[filename], 'utf-8');
      }
    }
  }
}

export async function readData(filename: string): Promise<string> {
  await ensureDir();
  await seedIfMissing(filename);
  return readFile(join(DATA_DIR, filename), 'utf-8');
}

export async function writeData(filename: string, content: string): Promise<void> {
  await ensureDir();
  await writeFile(join(DATA_DIR, filename), content, 'utf-8');
}

export async function appendData(filename: string, line: string): Promise<void> {
  await ensureDir();
  await seedIfMissing(filename);
  const existing = await readData(filename).catch(() => '');
  await writeData(filename, existing + line);
}
