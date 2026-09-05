import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseTemplate } from '@tax-form-layer/spec';
import { planTemplate } from '@tax-form-layer/engine';
import { renderPdf } from '@tax-form-layer/engine/pdf';

export const runtime = 'nodejs';

interface RenderBody {
  template: unknown;
  data: unknown;
  baseUrl?: string;
}

async function loadBasePdf(baseUrl: string | undefined): Promise<Uint8Array | undefined> {
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

export async function POST(req: NextRequest) {
  let body: RenderBody;
  try {
    body = (await req.json()) as RenderBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = parseTemplate(body.template);
  if (!parsed.ok) {
    return NextResponse.json({ error: 'Invalid template', issues: parsed.errors }, { status: 422 });
  }

  const base = await loadBasePdf(body.baseUrl ?? parsed.template.medium.source);
  const plan = planTemplate(parsed.template, body.data);
  const pdfBytes = await renderPdf(plan, base ? { basePdf: base } : {});

  return new NextResponse(Buffer.from(pdfBytes), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${parsed.template.id}.pdf"`,
      'Cache-Control': 'no-store',
    },
  });
}
