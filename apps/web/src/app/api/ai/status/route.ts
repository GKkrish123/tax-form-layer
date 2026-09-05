import { NextResponse } from 'next/server';
import { isConfigured, aiModels } from '@/lib/ai/provider';

export const runtime = 'nodejs';

export function GET() {
  return NextResponse.json({
    configured: isConfigured(),
    models: isConfigured() ? aiModels : null,
  });
}
