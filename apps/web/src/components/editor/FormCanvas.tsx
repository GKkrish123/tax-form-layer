'use client';

import { useEffect, useRef, useState } from 'react';
import { useEditor } from '@/lib/store';
import { registerCanvas } from '@/lib/canvas-capture';
import { EditLayer } from './EditLayer';
import { PreviewLayer } from './PreviewLayer';

const TARGET_WIDTH = 820;

export interface CanvasGeometry {
  width: number;
  height: number;
  ptToPx: number;
}

function isImageUrl(url: string): boolean {
  return /\.(png|jpe?g|gif|webp)$/i.test(url);
}

export function FormCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const baseDocUrl = useEditor((s) => s.baseDocUrl);
  const activePage = useEditor((s) => s.activePage);
  const mode = useEditor((s) => s.mode);
  const template = useEditor((s) => s.template);

  const [geom, setGeom] = useState<CanvasGeometry | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pageSize = template.pages.find((p) => p.number === activePage)?.size ?? template.pageSize;

  useEffect(() => {
    let cancelled = false;
    setError(null);

    async function renderImage(url: string) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = url;
      await img.decode();
      if (cancelled) return;
      const displayH = (img.naturalHeight / img.naturalWidth) * TARGET_WIDTH;
      setGeom({ width: TARGET_WIDTH, height: displayH, ptToPx: TARGET_WIDTH / pageSize.width });
      const canvas = canvasRef.current;
      if (canvas) {
        const dpr = window.devicePixelRatio || 1;
        canvas.width = TARGET_WIDTH * dpr;
        canvas.height = displayH * dpr;
        canvas.style.width = `${TARGET_WIDTH}px`;
        canvas.style.height = `${displayH}px`;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.scale(dpr, dpr);
          ctx.drawImage(img, 0, 0, TARGET_WIDTH, displayH);
        }
        registerCanvas(canvas);
      }
    }

    async function renderPdf(url: string) {
      const pdfjs = await import('pdfjs-dist');
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        'pdfjs-dist/build/pdf.worker.min.mjs',
        import.meta.url,
      ).toString();
      const pdf = await pdfjs.getDocument(url).promise;
      const pageIndex = Math.min(activePage, pdf.numPages);
      const page = await pdf.getPage(pageIndex);
      const base = page.getViewport({ scale: 1 });
      const cssScale = TARGET_WIDTH / base.width;
      const displayH = base.height * cssScale;
      const dpr = window.devicePixelRatio || 1;
      const viewport = page.getViewport({ scale: cssScale * dpr });
      const canvas = canvasRef.current;
      if (!canvas || cancelled) return;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      canvas.style.width = `${TARGET_WIDTH}px`;
      canvas.style.height = `${displayH}px`;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      await page.render({ canvasContext: ctx, viewport }).promise;
      if (!cancelled) {
        setGeom({ width: TARGET_WIDTH, height: displayH, ptToPx: TARGET_WIDTH / pageSize.width });
        registerCanvas(canvas);
      }
    }

    const run = isImageUrl(baseDocUrl) ? renderImage(baseDocUrl) : renderPdf(baseDocUrl);
    run.catch((err: unknown) => {
      if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load form');
    });

    return () => {
      cancelled = true;
    };
  }, [baseDocUrl, activePage, pageSize.width]);

  return (
    <div className="flex h-full items-start justify-center overflow-auto p-6 sm:p-10">
      <div
        className="relative rounded-lg bg-white shadow-panel ring-1 ring-slate-200"
        style={{ width: TARGET_WIDTH, maxWidth: '100%' }}
      >
        <canvas ref={canvasRef} className="block rounded-lg bg-white" />
        {error && (
          <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-white/85 p-6 text-center text-sm text-red-600">
            {error}
          </div>
        )}
        {geom && (
          <div className="absolute left-0 top-0" style={{ width: geom.width, height: geom.height }}>
            {mode === 'edit' ? <EditLayer geom={geom} /> : <PreviewLayer geom={geom} />}
          </div>
        )}
      </div>
    </div>
  );
}
