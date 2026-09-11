import { NextRequest, NextResponse } from 'next/server';
import { parseTemplate } from '@tax-form-layer/spec';
import { listTemplates, saveTemplateVersion } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET() {
  const templates = await listTemplates();
  return NextResponse.json({ templates });
}

interface SaveBody {
  template: unknown;
  message?: string;
}

export async function POST(req: NextRequest) {
  let body: SaveBody;
  try {
    body = (await req.json()) as SaveBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = parseTemplate(body.template);
  if (!parsed.ok) {
    return NextResponse.json({ error: 'Invalid template', issues: parsed.errors }, { status: 422 });
  }

  try {
    const saved = await saveTemplateVersion({
      slug: parsed.template.id,
      title: parsed.template.title,
      specVersion: parsed.template.specVersion,
      document: parsed.template,
      ...(body.message ? { message: body.message } : {}),
    });
    return NextResponse.json(saved, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Save failed' },
      { status: 500 },
    );
  }
}
