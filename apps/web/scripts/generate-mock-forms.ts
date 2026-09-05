import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const here = dirname(fileURLToPath(import.meta.url));
const outPath = resolve(here, '../public/forms/w2-2024.pdf');

const W = 612;
const H = 792;

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
}

// Fractions mirror the annotation example so overlays register precisely.
const boxes: Box[] = [
  { x: 0.05, y: 0.06, w: 0.32, h: 0.03, label: 'a  Employee SSN' },
  { x: 0.05, y: 0.12, w: 0.32, h: 0.03, label: 'b  Employer EIN' },
  { x: 0.05, y: 0.17, w: 0.4, h: 0.09, label: 'c  Employer name, address, ZIP' },
  { x: 0.05, y: 0.3, w: 0.4, h: 0.03, label: 'e  Employee name' },
  { x: 0.5, y: 0.06, w: 0.22, h: 0.03, label: '1  Wages, tips' },
  { x: 0.75, y: 0.06, w: 0.22, h: 0.03, label: '2  Fed. tax withheld' },
  { x: 0.5, y: 0.12, w: 0.22, h: 0.03, label: '3  SS wages' },
  { x: 0.75, y: 0.12, w: 0.22, h: 0.03, label: '4  SS tax withheld' },
  { x: 0.5, y: 0.3, w: 0.02, h: 0.02, label: '13' },
  { x: 0.05, y: 0.85, w: 0.9, h: 0.09, label: '15-17  State  |  State wages  |  State income tax' },
];

async function main() {
  const doc = await PDFDocument.create();
  const page = doc.addPage([W, H]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  page.drawText('Form W-2  Wage and Tax Statement  (MOCK — 2024)', {
    x: 0.05 * W,
    y: H - 0.03 * H,
    size: 11,
    font: bold,
    color: rgb(0.1, 0.1, 0.1),
  });

  for (const b of boxes) {
    const x = b.x * W;
    const w = b.w * W;
    const h = b.h * H;
    const yBottom = H - (b.y + b.h) * H;
    page.drawRectangle({
      x,
      y: yBottom,
      width: w,
      height: h,
      borderColor: rgb(0.55, 0.6, 0.68),
      borderWidth: 0.75,
    });
    page.drawText(b.label, {
      x: x + 2,
      y: yBottom + h + 2,
      size: 6,
      font,
      color: rgb(0.4, 0.45, 0.52),
    });
  }

  const bytes = await doc.save();
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, bytes);
  console.log(`Wrote mock W-2 background → ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
