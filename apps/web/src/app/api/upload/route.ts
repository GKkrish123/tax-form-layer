import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';

export const runtime = 'nodejs';

const ALLOWED: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

const MAX_BYTES = 20 * 1024 * 1024; // 20 MB

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }
  const ext = ALLOWED[file.type];
  if (!ext) {
    return NextResponse.json(
      { error: `Unsupported type ${file.type}. Allowed: PDF, PNG, JPEG, WebP.` },
      { status: 415 },
    );
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.byteLength > MAX_BYTES) {
    return NextResponse.json({ error: 'File exceeds 20 MB limit' }, { status: 413 });
  }

  const name = `${randomUUID()}.${ext}`;
  const kind = ext === 'pdf' ? 'pdf' : 'image';

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const { put } = await import('@vercel/blob');
    const blob = await put(`uploads/${name}`, file, {
      access: 'public',
      contentType: file.type,
    });
    return NextResponse.json({ url: blob.url, kind });
  }

  const { writeFile, mkdir } = await import('node:fs/promises');
  const { join } = await import('node:path');
  const dir = join(process.cwd(), 'public', 'uploads');
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, name), bytes);
  return NextResponse.json({ url: `/uploads/${name}`, kind });
}
