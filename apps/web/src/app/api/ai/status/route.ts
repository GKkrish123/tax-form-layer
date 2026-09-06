import { NextResponse } from 'next/server';
import { isBindingRankingEnabled, isConfigured, aiModels } from '@/lib/ai/provider';

export const runtime = 'nodejs';

export function GET() {
  return NextResponse.json({
    configured: isConfigured(),
    bindingRanking: isBindingRankingEnabled(),
    models: isConfigured() ? aiModels : null,
  });
}
