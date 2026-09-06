import { put } from '@vercel/blob';
import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';

export const runtime = 'nodejs';

const ALLOWED: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

const MAX_BYTES = 4.5 * 1024 * 1024;

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
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'File exceeds 4.5 MB limit' }, { status: 413 });
  }

  const name = `${randomUUID()}.${ext}`;
  const kind = ext === 'pdf' ? 'pdf' : 'image';

  if (process.env.VERCEL || process.env.BLOB_READ_WRITE_TOKEN) {
    const blob = await put(`uploads/${name}`, file, {
      access: 'private',
      contentType: file.type,
      addRandomSuffix: false,
    });
    return NextResponse.json({
      url: `/api/files?pathname=${encodeURIComponent(blob.pathname)}`,
      kind,
      pathname: blob.pathname,
    });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const { writeFile, mkdir } = await import('node:fs/promises');
  const { join } = await import('node:path');
  const dir = join(process.cwd(), 'public', 'uploads');
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, name), bytes);
  return NextResponse.json({ url: `/uploads/${name}`, kind });
}
