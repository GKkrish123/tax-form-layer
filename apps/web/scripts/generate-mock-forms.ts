import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const here = dirname(fileURLToPath(import.meta.url));

const W = 612;
const H = 792;

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
}

interface MockForm {
  file: string;
  title: string;
  boxes: Box[];
}

const forms: MockForm[] = [
  {
    file: 'w2-2024.pdf',
    title: 'Form W-2  Wage and Tax Statement  (MOCK — 2024)',
    boxes: [
      { x: 0.05, y: 0.06, w: 0.32, h: 0.03, label: 'a  Employee SSN' },
      { x: 0.05, y: 0.12, w: 0.32, h: 0.03, label: 'b  Employer EIN' },
      { x: 0.05, y: 0.17, w: 0.4, h: 0.09, label: 'c  Employer name, address, ZIP' },
      { x: 0.05, y: 0.3, w: 0.4, h: 0.03, label: 'e  Employee name' },
      { x: 0.5, y: 0.06, w: 0.22, h: 0.03, label: '1  Wages, tips' },
      { x: 0.75, y: 0.06, w: 0.22, h: 0.03, label: '2  Fed. tax withheld' },
      { x: 0.5, y: 0.12, w: 0.22, h: 0.03, label: '3  SS wages' },
      { x: 0.75, y: 0.12, w: 0.22, h: 0.03, label: '4  SS tax withheld' },
      { x: 0.5, y: 0.3, w: 0.02, h: 0.02, label: '13' },
      { x: 0.54, y: 0.34, w: 0.02, h: 0.02, label: 'Stat Y' },
      { x: 0.62, y: 0.34, w: 0.02, h: 0.02, label: 'Stat N' },
      { x: 0.05, y: 0.85, w: 0.9, h: 0.09, label: '15-17  State  |  State wages  |  State income tax' },
      { x: 0.05, y: 0.94, w: 0.4, h: 0.02, label: 'See statement' },
    ],
  },
  {
    file: 'w4-2024.pdf',
    title: "Form W-4  Employee's Withholding Certificate  (MOCK — 2024)",
    boxes: [
      { x: 0.05, y: 0.08, w: 0.48, h: 0.035, label: 'First name and middle initial / Last name' },
      { x: 0.56, y: 0.08, w: 0.39, h: 0.035, label: 'Social security number' },
      { x: 0.05, y: 0.18, w: 0.02, h: 0.02, label: 'Single' },
      { x: 0.38, y: 0.18, w: 0.02, h: 0.02, label: 'MFJ' },
      { x: 0.71, y: 0.18, w: 0.02, h: 0.02, label: 'HoH' },
      { x: 0.05, y: 0.26, w: 0.48, h: 0.035, label: 'Spouse name' },
      { x: 0.56, y: 0.26, w: 0.39, h: 0.035, label: 'Spouse SSN' },
      { x: 0.56, y: 0.36, w: 0.39, h: 0.035, label: '3  Claim dependents' },
      { x: 0.56, y: 0.44, w: 0.39, h: 0.035, label: '4c  Extra withholding' },
    ],
  },
  {
    file: 'w9-2024.pdf',
    title: 'Form W-9  Request for Taxpayer Identification Number  (MOCK — 2024)',
    boxes: [
      { x: 0.05, y: 0.08, w: 0.9, h: 0.035, label: '1  Name' },
      { x: 0.05, y: 0.14, w: 0.9, h: 0.035, label: '2  Business name' },
      { x: 0.05, y: 0.22, w: 0.02, h: 0.02, label: 'Individual' },
      { x: 0.28, y: 0.22, w: 0.02, h: 0.02, label: 'C Corp' },
      { x: 0.51, y: 0.22, w: 0.02, h: 0.02, label: 'Partnership' },
      { x: 0.74, y: 0.22, w: 0.02, h: 0.02, label: 'LLC' },
      { x: 0.05, y: 0.32, w: 0.4, h: 0.03, label: 'SSN' },
      { x: 0.52, y: 0.32, w: 0.43, h: 0.03, label: 'EIN' },
      { x: 0.05, y: 0.4, w: 0.9, h: 0.07, label: '5–6  Address, city, state, ZIP' },
      { x: 0.05, y: 0.52, w: 0.02, h: 0.02, label: 'Certify' },
    ],
  },
  {
    file: '1099-nec-2024.pdf',
    title: 'Form 1099-NEC  Nonemployee Compensation  (MOCK — 2024)',
    boxes: [
      { x: 0.05, y: 0.08, w: 0.48, h: 0.12, label: "PAYER'S name, street address, city, state, ZIP, TIN" },
      { x: 0.56, y: 0.08, w: 0.38, h: 0.03, label: "RECIPIENT'S TIN" },
      { x: 0.05, y: 0.24, w: 0.48, h: 0.04, label: "RECIPIENT'S name" },
      { x: 0.56, y: 0.18, w: 0.38, h: 0.04, label: '1  Nonemployee compensation' },
      { x: 0.56, y: 0.26, w: 0.38, h: 0.04, label: '4  Federal income tax withheld' },
      { x: 0.56, y: 0.34, w: 0.02, h: 0.02, label: '2nd TIN' },
    ],
  },
  {
    file: '1099-int-2024.pdf',
    title: 'Form 1099-INT  Interest Income  (MOCK — 2024)',
    boxes: [
      { x: 0.05, y: 0.08, w: 0.48, h: 0.12, label: "PAYER'S name, street address, city, state, ZIP, TIN" },
      { x: 0.56, y: 0.08, w: 0.38, h: 0.03, label: "RECIPIENT'S TIN" },
      { x: 0.05, y: 0.24, w: 0.48, h: 0.04, label: "RECIPIENT'S name" },
      { x: 0.56, y: 0.18, w: 0.38, h: 0.04, label: '1  Interest income' },
      { x: 0.56, y: 0.26, w: 0.38, h: 0.04, label: '4  Federal income tax withheld' },
      { x: 0.56, y: 0.34, w: 0.38, h: 0.04, label: '8  Tax-exempt interest' },
      { x: 0.56, y: 0.42, w: 0.02, h: 0.02, label: '2nd TIN' },
    ],
  },
  {
    file: '1099-misc-2024.pdf',
    title: 'Form 1099-MISC  Miscellaneous Information  (MOCK — 2024)',
    boxes: [
      { x: 0.05, y: 0.08, w: 0.48, h: 0.12, label: "PAYER'S name, street address, city, state, ZIP, TIN" },
      { x: 0.56, y: 0.08, w: 0.38, h: 0.03, label: "RECIPIENT'S TIN" },
      { x: 0.05, y: 0.24, w: 0.48, h: 0.04, label: "RECIPIENT'S name" },
      { x: 0.56, y: 0.16, w: 0.38, h: 0.035, label: '1  Rents' },
      { x: 0.56, y: 0.22, w: 0.38, h: 0.035, label: '2  Royalties' },
      { x: 0.56, y: 0.28, w: 0.38, h: 0.035, label: '3  Other income' },
      { x: 0.56, y: 0.34, w: 0.38, h: 0.035, label: '4  Federal income tax withheld' },
      { x: 0.56, y: 0.42, w: 0.02, h: 0.02, label: '2nd TIN' },
    ],
  },
];

async function writeForm(outPath: string, title: string, boxes: Box[]) {
  const doc = await PDFDocument.create();
  const page = doc.addPage([W, H]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  page.drawText(title, {
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
  console.log(`Wrote mock form → ${outPath}`);
}

async function main() {
  for (const form of forms) {
    await writeForm(resolve(here, '../public/forms', form.file), form.title, form.boxes);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
