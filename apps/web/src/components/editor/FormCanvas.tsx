'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useEditor } from '@/lib/store';
import { registerCanvas } from '@/lib/canvas-capture';
import { EditLayer } from './EditLayer';
import { PreviewLayer } from './PreviewLayer';

const MAX_FORM_WIDTH = 920;
const MIN_FORM_WIDTH = 280;
const WIDTH_STEP = 16;

export interface CanvasGeometry {
  width: number;
  height: number;
  ptToPx: number;
  scale: number;
}

function isImageUrl(url: string): boolean {
  return /\.(png|jpe?g|gif|webp)$/i.test(url);
}

function snapWidth(raw: number): number {
  const clamped = Math.min(MAX_FORM_WIDTH, Math.max(MIN_FORM_WIDTH, raw));
  return Math.max(MIN_FORM_WIDTH, Math.round(clamped / WIDTH_STEP) * WIDTH_STEP);
}

export function FormCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const renderWidthRef = useRef(0);
  const displayWidthRef = useRef(0);
  const renderGen = useRef(0);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfCache = useRef<{ url: string; doc: any } | null>(null);
  const readyRef = useRef(false);

  const baseDocUrl = useEditor((s) => s.baseDocUrl);
  const activePage = useEditor((s) => s.activePage);
  const mode = useEditor((s) => s.mode);
  const aiBusy = useEditor((s) => s.aiBusy);
  const pageWidth = useEditor((s) => {
    const page = s.template.pages.find((p) => p.number === s.activePage);
    return (page?.size ?? s.template.pageSize).width;
  });

  const [targetWidth, setTargetWidth] = useState(MAX_FORM_WIDTH);
  const [geom, setGeom] = useState<CanvasGeometry | null>(null);
  const [scale, setScale] = useState(1);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;

    let timer: ReturnType<typeof setTimeout> | null = null;

    const applyDisplayScale = (raw: number) => {
      displayWidthRef.current = raw;
      const rendered = renderWidthRef.current;
      if (rendered > 0 && raw > 0) {
        const next = raw / rendered;
        setScale((prev) => (Math.abs(prev - next) < 0.001 ? prev : next));
        setGeom((prev) =>
          prev && Math.abs(prev.scale - next) >= 0.001 ? { ...prev, scale: next } : prev,
        );
      }
    };

    const publishRenderWidth = (raw: number) => {
      if (raw <= 0) return;
      const next = snapWidth(raw);
      applyDisplayScale(raw);
      if (next === renderWidthRef.current) return;
      renderWidthRef.current = next;
      setTargetWidth(next);
    };

    const onResize = (raw: number) => {
      applyDisplayScale(raw);
      if (timer) clearTimeout(timer);
      if (!readyRef.current) {
        publishRenderWidth(raw);
        return;
      }
      timer = setTimeout(() => publishRenderWidth(raw), 150);
    };

    const ro = new ResizeObserver((entries) => {
      const raw = entries[0]?.contentRect.width ?? el.clientWidth;
      onResize(raw);
    });
    ro.observe(el);
    onResize(el.clientWidth);

    return () => {
      ro.disconnect();
      if (timer) clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (pdfCache.current && pdfCache.current.url !== baseDocUrl) {
      try {
        void pdfCache.current.doc.destroy?.();
      } catch {
        /* ignore */
      }
      pdfCache.current = null;
    }
  }, [baseDocUrl]);

  useEffect(() => {
    const gen = ++renderGen.current;
    let cancelled = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let renderTask: { promise: Promise<void>; cancel: () => void } | null = null;

    async function renderImage(url: string, width: number) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = url;
      await img.decode();
      if (cancelled || gen !== renderGen.current) return;

      const displayH = (img.naturalHeight / img.naturalWidth) * width;
      const canvas = canvasRef.current;
      if (!canvas) return;

      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(displayH * dpr));
      canvas.style.width = `${width}px`;
      canvas.style.height = `${displayH}px`;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.drawImage(img, 0, 0, width, displayH);
      finish(width, displayH, canvas);
    }

    async function renderPdf(url: string, width: number) {
      const pdfjs = await import('pdfjs-dist');
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        'pdfjs-dist/build/pdf.worker.min.mjs',
        import.meta.url,
      ).toString();

      let doc = pdfCache.current?.url === url ? pdfCache.current.doc : null;
      if (!doc) {
        doc = await pdfjs.getDocument(url).promise;
        if (cancelled || gen !== renderGen.current) return;
        pdfCache.current = { url, doc };
      }

      const pageIndex = Math.min(activePage, doc.numPages);
      const page = await doc.getPage(pageIndex);
      if (cancelled || gen !== renderGen.current) return;

      const base = page.getViewport({ scale: 1 });
      const cssScale = width / base.width;
      const displayH = base.height * cssScale;
      const dpr = window.devicePixelRatio || 1;
      const viewport = page.getViewport({ scale: cssScale * dpr });
      const canvas = canvasRef.current;
      if (!canvas) return;

      canvas.width = Math.max(1, Math.round(viewport.width));
      canvas.height = Math.max(1, Math.round(viewport.height));
      canvas.style.width = `${width}px`;
      canvas.style.height = `${displayH}px`;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(1, 0, 0, 1, 0, 0);

      const task = page.render({ canvasContext: ctx, viewport });
      renderTask = task;
      await task.promise;
      if (cancelled || gen !== renderGen.current) return;

      finish(width, displayH, canvas);
    }

    function finish(width: number, displayH: number, canvas: HTMLCanvasElement) {
      registerCanvas(canvas);
      const s = displayWidthRef.current > 0 ? displayWidthRef.current / width : 1;
      setGeom({ width, height: displayH, ptToPx: width / pageWidth, scale: s });
      setScale(s);
      readyRef.current = true;
      setError(null);
    }

    const run = isImageUrl(baseDocUrl)
      ? renderImage(baseDocUrl, targetWidth)
      : renderPdf(baseDocUrl, targetWidth);

    run.catch((err: unknown) => {
      if (cancelled || gen !== renderGen.current) return;
      if (
        err &&
        typeof err === 'object' &&
        'name' in err &&
        (err as { name: string }).name === 'RenderingCancelledException'
      ) {
        return;
      }
      setError(err instanceof Error ? err.message : 'Failed to load form');
    });

    return () => {
      cancelled = true;
      try {
        renderTask?.cancel();
      } catch {
        /* ignore */
      }
    };
  }, [baseDocUrl, activePage, pageWidth, targetWidth]);

  return (
    <div className="flex h-full justify-center overflow-auto p-3 [scrollbar-gutter:stable] sm:p-5 lg:p-8">
      <div ref={frameRef} className="w-full max-w-[920px]">
        <div
          className="relative overflow-hidden rounded-lg bg-white shadow-panel ring-1 ring-slate-200"
          style={{ width: '100%', height: geom ? geom.height * scale : undefined }}
        >
          <div
            className="origin-top-left"
            style={{
              width: geom?.width,
              height: geom?.height,
              transform: `scale(${scale})`,
            }}
          >
            <canvas ref={canvasRef} className="block bg-white" />
            {error && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/85 p-6 text-center text-sm text-red-600">
                {error}
              </div>
            )}
            {aiBusy === 'detect-boxes' && !error && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-slate-950/45 backdrop-blur-[2px]">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-lg">
                  <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
                </div>
                <div className="mx-3 rounded-lg bg-white/95 px-4 py-2 text-center shadow-lg">
                  <p className="text-sm font-medium text-slate-900">Scanning for boxes…</p>
                  <p className="text-xs text-slate-500">AI is reading the form layout</p>
                </div>
              </div>
            )}
            {geom && (
              <div
                className="pointer-events-none absolute left-0 top-0 [&>*]:pointer-events-auto"
                style={{ width: geom.width, height: geom.height }}
              >
                {mode === 'edit' ? <EditLayer geom={geom} /> : <PreviewLayer geom={geom} />}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
