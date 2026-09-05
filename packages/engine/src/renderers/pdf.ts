import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb, degrees, type RGB } from 'pdf-lib';
import type { StandardFont } from '@tax-form-layer/spec';
import type { DrawOp, MarkDrawOp, RenderPlan, TextDrawOp } from '../plan/types.js';
import { layoutText, type TextMeasurer } from '../layout/text.js';

const FONT_MAP: Record<StandardFont, StandardFonts> = {
  Helvetica: StandardFonts.Helvetica,
  'Helvetica-Bold': StandardFonts.HelveticaBold,
  'Helvetica-Oblique': StandardFonts.HelveticaOblique,
  'Helvetica-BoldOblique': StandardFonts.HelveticaBoldOblique,
  'Times-Roman': StandardFonts.TimesRoman,
  'Times-Bold': StandardFonts.TimesRomanBold,
  'Times-Italic': StandardFonts.TimesRomanItalic,
  'Times-BoldItalic': StandardFonts.TimesRomanBoldItalic,
  Courier: StandardFonts.Courier,
  'Courier-Bold': StandardFonts.CourierBold,
  'Courier-Oblique': StandardFonts.CourierOblique,
  'Courier-BoldOblique': StandardFonts.CourierBoldOblique,
};

function hexToRgb(hex: string): RGB {
  let h = hex.replace('#', '');
  if (h.length === 3)
    h = h
      .split('')
      .map((c) => c + c)
      .join('');
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  return rgb(r, g, b);
}

export interface RenderPdfOptions {
  /**
   * Bytes of the blank base form PDF. When omitted, blank white pages sized per the
   * plan are generated so a template can be previewed without artwork.
   */
  basePdf?: Uint8Array | ArrayBuffer;
}

export async function renderPdf(
  plan: RenderPlan,
  options: RenderPdfOptions = {},
): Promise<Uint8Array> {
  const doc = options.basePdf
    ? await PDFDocument.load(options.basePdf)
    : await PDFDocument.create();

  const fontCache = new Map<StandardFont, PDFFont>();
  const getFont = async (name: StandardFont): Promise<PDFFont> => {
    const cached = fontCache.get(name);
    if (cached) return cached;
    const font = await doc.embedFont(FONT_MAP[name]);
    fontCache.set(name, font);
    return font;
  };

  for (const planPage of plan.pages) {
    const page = resolvePage(doc, planPage.backgroundRef, planPage.size, !options.basePdf);
    if (!page) continue;
    const pageHeight = page.getHeight();

    for (const op of planPage.ops) {
      if (op.kind === 'text') {
        await drawText(op, page, pageHeight, getFont);
      } else {
        drawMark(op, page, pageHeight, await getFont('Helvetica'));
      }
    }
  }

  return doc.save();
}

function resolvePage(
  doc: PDFDocument,
  backgroundRef: number | string,
  size: { width: number; height: number },
  generateBlank: boolean,
): PDFPage | undefined {
  if (generateBlank) {
    return doc.addPage([size.width, size.height]);
  }
  const index = typeof backgroundRef === 'number' ? backgroundRef : 0;
  const pages = doc.getPages();
  return pages[index];
}

async function drawText(
  op: TextDrawOp,
  page: PDFPage,
  pageHeight: number,
  getFont: (name: StandardFont) => Promise<PDFFont>,
): Promise<void> {
  const font = await getFont(op.style.font);
  const measurer: TextMeasurer = {
    widthOf: (text, fontSize) => font.widthOfTextAtSize(text, fontSize),
  };
  const layout = layoutText(op, measurer);
  const color = hexToRgb(op.style.color);

  for (const line of layout.lines) {
    if (line.text === '') continue;
    page.drawText(line.text, {
      x: line.x,
      y: pageHeight - line.baseline,
      size: layout.fontSize,
      font,
      color,
      rotate: op.rect.rotation ? degrees(-op.rect.rotation) : undefined,
    });
  }
}

function drawMark(op: MarkDrawOp, page: PDFPage, pageHeight: number, font: PDFFont): void {
  const color = hexToRgb(op.color);
  const { x, y, width, height } = op.rect;
  const bottom = pageHeight - (y + height);
  const top = pageHeight - y;
  const right = x + width;
  const thickness = Math.max(0.75, Math.min(width, height) * 0.12);

  switch (op.mark) {
    case 'fill':
      page.drawRectangle({ x, y: bottom, width, height, color });
      break;
    case 'cross':
      page.drawLine({ start: { x, y: bottom }, end: { x: right, y: top }, thickness, color });
      page.drawLine({ start: { x, y: top }, end: { x: right, y: bottom }, thickness, color });
      break;
    case 'check': {
      const midX = x + width * 0.4;
      const midY = bottom + height * 0.25;
      page.drawLine({
        start: { x: x + width * 0.1, y: bottom + height * 0.55 },
        end: { x: midX, y: midY },
        thickness,
        color,
      });
      page.drawLine({
        start: { x: midX, y: midY },
        end: { x: right - width * 0.05, y: top - height * 0.15 },
        thickness,
        color,
      });
      break;
    }
    case 'text': {
      const size = Math.min(height, width) * 0.9;
      const textWidth = font.widthOfTextAtSize(op.markText, size);
      page.drawText(op.markText, {
        x: x + (width - textWidth) / 2,
        y: bottom + (height - size * 0.7) / 2,
        size,
        font,
        color,
      });
      break;
    }
  }
}
