import { NextRequest, NextResponse } from 'next/server';
import { Field } from '@tax-form-layer/spec';
import { chatJSON, isConfigured } from '@/lib/ai/provider';
import { guessAlign, guessFormat, suggestBindings } from '@/lib/ai/heuristics';

export const runtime = 'nodejs';

interface Body {
  prompt: string;
  data?: unknown;
}

const DEFAULT_RECT = {
  x: 0.4,
  y: 0.45,
  width: 0.15,
  height: 0.03,
  rotation: 0,
  unit: 'fraction' as const,
};

function heuristicField(prompt: string, data: unknown): unknown {
  const id = `ai_${Math.random().toString(36).slice(2, 7)}`;
  const format = guessFormat(prompt);
  const align = guessAlign(prompt);
  const isCheckbox = /\b(checkbox|check box|toggle|yes\/no|tick)\b/i.test(prompt);
  const top = suggestBindings(prompt, undefined, data ?? {}, 1)[0];
  const binding = { source: 'jsonpath' as const, path: top?.path ?? '$.' };

  if (isCheckbox) {
    return {
      type: 'checkbox',
      id,
      label: prompt.slice(0, 60),
      rect: { ...DEFAULT_RECT, width: 0.02, height: 0.02 },
      binding,
      mark: 'check',
      markText: 'X',
    };
  }
  return {
    type: 'value',
    id,
    label: prompt.slice(0, 60),
    rect: DEFAULT_RECT,
    binding,
    format: format === 'currency' ? { type: 'currency' } : { type: format === 'none' ? 'none' : format },
    style: { align },
  };
}

function finalize(candidate: unknown) {
  const withRect =
    candidate && typeof candidate === 'object' && !('rect' in (candidate as object))
      ? { ...(candidate as object), rect: DEFAULT_RECT }
      : candidate;
  return Field.safeParse(withRect);
}

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (!body.prompt?.trim()) {
    return NextResponse.json({ error: 'A prompt is required' }, { status: 400 });
  }

  if (isConfigured()) {
    try {
      const candidates = suggestBindings(body.prompt, undefined, body.data ?? {}, 6);
      const raw = await chatJSON<{ field: unknown }>([
        {
          role: 'system',
          content: [
            'You create a single annotation field for a U.S. tax form as JSON.',
            'Schema (discriminated by "type"):',
            '- value: { type:"value", id, label?, boxNumber?, rect:{x,y,width,height,unit:"fraction"}, binding, format }',
            '- checkbox: { type:"checkbox", id, label?, rect, binding, mark:"check"|"cross"|"fill"|"text" }',
            '- comb: { type:"comb", id, rect, binding, format, cells:number }',
            'binding is one of: {source:"jsonpath",path} | {source:"const",value} | {source:"template",template}.',
            'format.type ∈ none|text|currency|number|percent|date|ssn|ein|phone|boolean.',
            'Coordinates are fractions of the page in [0,1]. Right-align currency.',
            'Prefer a binding path from the provided candidates when relevant.',
            'Respond ONLY as {"field": <the field object>}.',
          ].join('\n'),
        },
        {
          role: 'user',
          content: JSON.stringify({ instruction: body.prompt, candidatePaths: candidates }),
        },
      ]);
      const parsed = finalize(raw.field);
      if (parsed.success) {
        return NextResponse.json({ source: 'ai', field: parsed.data });
      }
    } catch {
    }
  }

  const parsed = finalize(heuristicField(body.prompt, body.data));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Could not generate a valid field' }, { status: 422 });
  }
  return NextResponse.json({ source: 'heuristic', field: parsed.data });
}
