'use client';

import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { FilePlus2, Loader2 } from 'lucide-react';
import { useEditor } from '@/lib/store';
import { blankTemplate } from '@/lib/blank-template';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type BaseChoice = 'upload' | 'sample' | 'blank';

export function NewFormDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const loadTemplate = useEditor((s) => s.loadTemplate);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const [title, setTitle] = useState('Untitled form');
  const [jurisdiction, setJurisdiction] = useState('US-IRS');
  const [formNumber, setFormNumber] = useState('');
  const [taxYear, setTaxYear] = useState(new Date().getFullYear() - 1);
  const [mediumKind, setMediumKind] = useState<'pdf' | 'image'>('pdf');
  const [base, setBase] = useState<BaseChoice>('sample');
  const [fileName, setFileName] = useState<string | null>(null);

  async function resolveSource(): Promise<{ source?: string; kind: 'pdf' | 'image' }> {
    if (base === 'sample') return { source: '/forms/w2-2024.pdf', kind: 'pdf' };
    if (base === 'blank') return { kind: mediumKind };
    const file = fileRef.current?.files?.[0];
    if (!file) throw new Error('Choose a file to upload');
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch('/api/upload', { method: 'POST', body: fd });
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(j.error ?? 'Upload failed');
    }
    const j = (await res.json()) as { url: string; kind: 'pdf' | 'image' };
    return { source: j.url, kind: j.kind };
  }

  async function create() {
    setBusy(true);
    try {
      const { source, kind } = await resolveSource();
      const template = blankTemplate({
        title: title.trim() || 'Untitled form',
        jurisdiction: jurisdiction.trim() || 'US',
        formNumber: formNumber.trim() || 'FORM',
        taxYear: Number(taxYear) || new Date().getFullYear(),
        mediumKind: kind,
        source,
      });
      loadTemplate(template, { dirty: true });
      toast.success('New form created', { description: template.id });
      onOpenChange(false);
    } catch (err) {
      toast.error('Could not create form', {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FilePlus2 className="h-4 w-4" /> New form
          </DialogTitle>
          <DialogDescription>
            Create a blank annotation template over a base document.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-1">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Jurisdiction</Label>
            <Input value={jurisdiction} onChange={(e) => setJurisdiction(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Form number</Label>
            <Input
              value={formNumber}
              placeholder="e.g. 1040"
              onChange={(e) => setFormNumber(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>Tax year</Label>
            <Input
              type="number"
              value={taxYear}
              onChange={(e) => setTaxYear(Number(e.target.value))}
            />
          </div>
          <div className="space-y-1">
            <Label>Base document</Label>
            <Select value={base} onValueChange={(v) => setBase(v as BaseChoice)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sample">Sample W-2 (PDF)</SelectItem>
                <SelectItem value="upload">Upload…</SelectItem>
                <SelectItem value="blank">Blank page</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {base === 'upload' && (
            <div className="col-span-2 space-y-1">
              <Label>File (PDF / PNG / JPEG)</Label>
              <Input
                ref={fileRef}
                type="file"
                accept="application/pdf,image/png,image/jpeg,image/webp"
                className="h-auto py-1.5"
                onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
              />
              {fileName && <p className="text-[11px] text-muted-foreground">{fileName}</p>}
            </div>
          )}

          {base === 'blank' && (
            <div className="space-y-1">
              <Label>Medium</Label>
              <Select value={mediumKind} onValueChange={(v) => setMediumKind(v as 'pdf' | 'image')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pdf">PDF</SelectItem>
                  <SelectItem value="image">Image</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={create} disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Create form
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
