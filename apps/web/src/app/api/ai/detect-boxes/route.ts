import { NextRequest, NextResponse } from 'next/server';
import { Field } from '@tax-form-layer/spec';
import { chatJSON, isConfigured } from '@/lib/ai/provider';
import { guessAlign, guessFormat } from '@/lib/ai/heuristics';

export const runtime = 'nodejs';
export const maxDuration = 60;

interface Body {
  imageDataUrl: string;
}

interface DetectedBox {
  label?: string;
  boxNumber?: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export async function POST(req: NextRequest) {
  if (!isConfigured()) {
    return NextResponse.json(
      { error: 'AI vision is not configured. Set AI_API_KEY (and AI_VISION_MODEL).' },
      { status: 501 },
    );
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (!body.imageDataUrl?.startsWith('data:image')) {
    return NextResponse.json({ error: 'imageDataUrl (data:image/...) is required' }, { status: 400 });
  }

  try {
    const result = await chatJSON<{ boxes: DetectedBox[] }>(
      [
        {
          role: 'system',
          content:
            'You are a document layout detector for U.S. tax forms. Identify fillable boxes/fields in the image. For each, return a bounding box in NORMALIZED coordinates (fractions of the image dimensions, origin top-left): x, y, width, height, all in [0,1]. Include a concise "label" and the printed "boxNumber" if visible. Respond ONLY as JSON: {"boxes":[{"label","boxNumber","x","y","width","height"}]}.',
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Detect the fillable boxes in this blank tax form.' },
            { type: 'image_url', image_url: { url: body.imageDataUrl } },
          ],
        },
      ],
      { vision: true, temperature: 0, maxTokens: 3000 },
    );

    const fields = (result.boxes ?? [])
      .map((b, i) => buildField(b, i))
      .filter((f): f is NonNullable<typeof f> => f !== null);

    return NextResponse.json({ source: 'ai', fields });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Detection failed' },
      { status: 502 },
    );
  }
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, Number(n)));
}

function buildField(box: DetectedBox, index: number) {
  const label = box.label ?? `Field ${index + 1}`;
  const hint = `${label} ${box.boxNumber ?? ''}`;
  const formatType = guessFormat(hint);
  const align = guessAlign(hint);

  const format =
    formatType === 'currency'
      ? {
          type: 'currency' as const,
          locale: 'en-US',
          currency: 'USD',
          decimals: 2,
          symbol: false,
          grouping: true,
          negative: 'parentheses' as const,
        }
      : formatType === 'date'
        ? { type: 'date' as const, outputFormat: 'MM/DD/YYYY', locale: 'en-US' }
        : formatType === 'ssn'
          ? { type: 'ssn' as const, mask: false }
          : formatType === 'ein'
            ? { type: 'ein' as const }
            : formatType === 'phone'
              ? { type: 'phone' as const }
              : formatType === 'percent'
                ? { type: 'percent' as const, locale: 'en-US', decimals: 2, scale: false }
                : formatType === 'text'
                  ? { type: 'text' as const, case: 'none' as const }
                  : { type: 'none' as const };

  const candidate = {
    type: 'value' as const,
    id: `detected_${index + 1}`,
    label,
    ...(box.boxNumber ? { boxNumber: String(box.boxNumber) } : {}),
    rect: {
      x: clamp01(box.x),
      y: clamp01(box.y),
      width: Math.max(0.01, clamp01(box.width)),
      height: Math.max(0.008, clamp01(box.height)),
      rotation: 0,
      unit: 'fraction' as const,
    },
    binding: { source: 'jsonpath' as const, path: '$.' },
    format,
    ...(align !== 'left' ? { style: { align } } : {}),
  };
  const parsed = Field.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}
