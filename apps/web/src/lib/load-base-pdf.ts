import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export async function loadBasePdf(baseUrl: string | undefined): Promise<Uint8Array | undefined> {
  if (!baseUrl) return undefined;
  try {
    if (baseUrl.startsWith('http://') || baseUrl.startsWith('https://')) {
      const res = await fetch(baseUrl);
      if (!res.ok) return undefined;
      return new Uint8Array(await res.arrayBuffer());
    }
    const clean = baseUrl.replace(/^\/+/, '');
    const abs = join(process.cwd(), 'public', clean);
    return new Uint8Array(await readFile(abs));
  } catch {
    return undefined;
  }
}
