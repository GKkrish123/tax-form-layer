import { NextRequest, NextResponse } from 'next/server';
import { parseTemplate } from '@tax-form-layer/spec';
import { planTemplate } from '@tax-form-layer/engine';
import { renderPdf } from '@tax-form-layer/engine/pdf';
import { renderPng } from '@tax-form-layer/engine/png';
import { loadBasePdf } from '@/lib/load-base-pdf';

export const runtime = 'nodejs';

interface RenderBody {
  template: unknown;
  data: unknown;
  baseUrl?: string;
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

  const plan = planTemplate(parsed.template, body.data);
  const format = req.nextUrl.searchParams.get('format');

  if (format === 'png') {
    const png = renderPng(plan);
    return new NextResponse(Buffer.from(png), {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Content-Disposition': `inline; filename="${parsed.template.id}.png"`,
        'Cache-Control': 'no-store',
      },
    });
  }

  const base = await loadBasePdf(body.baseUrl ?? parsed.template.medium.source);
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
