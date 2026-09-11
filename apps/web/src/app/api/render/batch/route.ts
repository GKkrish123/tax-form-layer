import { NextRequest, NextResponse } from 'next/server';
import { parseTemplate } from '@tax-form-layer/spec';
import { planTemplate } from '@tax-form-layer/engine';
import { renderPdf } from '@tax-form-layer/engine/pdf';
import { loadBasePdf } from '@/lib/load-base-pdf';
import { zipStore } from '@/lib/zip';

export const runtime = 'nodejs';

interface BatchBody {
  template: unknown;
  data: unknown[];
  baseUrl?: string;
}

export async function POST(req: NextRequest) {
  let body: BatchBody;
  try {
    body = (await req.json()) as BatchBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!Array.isArray(body.data) || body.data.length === 0) {
    return NextResponse.json({ error: 'data must be a non-empty array' }, { status: 400 });
  }

  const parsed = parseTemplate(body.template);
  if (!parsed.ok) {
    return NextResponse.json({ error: 'Invalid template', issues: parsed.errors }, { status: 422 });
  }

  const base = await loadBasePdf(body.baseUrl ?? parsed.template.medium.source);
  const files: Array<{ name: string; data: Uint8Array }> = [];

  for (let i = 0; i < body.data.length; i++) {
    const plan = planTemplate(parsed.template, body.data[i]);
    const pdf = await renderPdf(plan, base ? { basePdf: base } : {});
    files.push({ name: `${parsed.template.id}-${i + 1}.pdf`, data: pdf });
  }

  const zip = zipStore(files);
  return new NextResponse(Buffer.from(zip), {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${parsed.template.id}.batch.zip"`,
      'Cache-Control': 'no-store',
    },
  });
}
