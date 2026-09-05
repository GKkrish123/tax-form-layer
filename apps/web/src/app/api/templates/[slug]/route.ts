import { NextRequest, NextResponse } from 'next/server';
import { getTemplateDocument, listVersions } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const versionParam = req.nextUrl.searchParams.get('version');
  const version = versionParam ? Number(versionParam) : undefined;

  const [document, versions] = await Promise.all([
    getTemplateDocument(slug, version),
    listVersions(slug),
  ]);

  if (!document) {
    return NextResponse.json({ error: 'Template not found' }, { status: 404 });
  }
  return NextResponse.json({ document, versions });
}
