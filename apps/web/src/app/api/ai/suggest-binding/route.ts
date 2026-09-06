import { NextRequest, NextResponse } from 'next/server';
import { chatJSON, isBindingRankingEnabled } from '@/lib/ai/provider';
import { suggestBindings, type BindingSuggestion } from '@/lib/ai/heuristics';

export const runtime = 'nodejs';

interface Body {
  label?: string;
  boxNumber?: string;
  data: unknown;
}

interface Suggestion extends BindingSuggestion {
  reason?: string;
}

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const heuristic = suggestBindings(body.label ?? '', body.boxNumber, body.data, 8);

  if (!isBindingRankingEnabled()) {
    return NextResponse.json({ source: 'heuristic', suggestions: heuristic });
  }

  try {
    const result = await chatJSON<{ suggestions: Suggestion[] }>([
      {
        role: 'system',
        content:
          'You map U.S. tax-form fields to values in a nested JSON data set. Given a field label and a list of candidate JSONPaths (with sample values), pick and rank the best matches. Respond ONLY as JSON: {"suggestions":[{"path": string, "reason": string}]}. Use exactly the provided candidate paths; do not invent new ones. Return at most 5.',
      },
      {
        role: 'user',
        content: JSON.stringify({
          field: { label: body.label, boxNumber: body.boxNumber },
          candidates: heuristic.map((h) => ({ path: h.path, value: h.valuePreview })),
        }),
      },
    ]);

    const byPath = new Map(heuristic.map((h) => [h.path, h]));
    const merged: Suggestion[] = (result.suggestions ?? [])
      .filter((s) => byPath.has(s.path))
      .map((s) => ({ ...byPath.get(s.path)!, reason: s.reason }));

    return NextResponse.json({
      source: 'ai',
      suggestions: merged.length > 0 ? merged : heuristic,
    });
  } catch {
    return NextResponse.json({ source: 'heuristic', suggestions: heuristic });
  }
}
