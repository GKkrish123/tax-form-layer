'use client';

import type { Issue } from '@tax-form-layer/spec';
import { useEditor } from '@/lib/store';
import { cn } from '@/lib/utils';

export function IssuesList({
  issues,
  bound,
  total,
}: {
  issues: Issue[];
  bound: number;
  total: number;
}) {
  const selectField = useEditor((s) => s.selectField);
  const setIssuesOpen = useEditor((s) => s.setIssuesOpen);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="border-b px-3 py-2 text-[11px] text-muted-foreground">
        Coverage {bound}/{total} bound · {issues.length} issue{issues.length === 1 ? '' : 's'}
      </div>
      <div className="scroll-slim flex-1 overflow-auto p-2">
        {issues.length === 0 ? (
          <p className="px-2 py-6 text-center text-[11px] text-muted-foreground">
            No compile issues. Select a field to edit it.
          </p>
        ) : (
          issues.map((issue, i) => (
            <button
              key={`${issue.code}-${issue.fieldId}-${i}`}
              className={cn(
                'mb-1 w-full rounded-md border px-2 py-1.5 text-left text-[11px] hover:bg-accent',
                issue.severity === 'error' ? 'border-red-200' : 'border-amber-200',
              )}
              onClick={() => {
                if (issue.fieldId) {
                  const id = issue.fieldId.includes(':')
                    ? issue.fieldId.split(':').slice(1).join(':')
                    : issue.fieldId;
                  selectField(id.split('[')[0] ?? id);
                }
                setIssuesOpen(false);
              }}
            >
              <span className="font-mono text-[10px] text-muted-foreground">{issue.code}</span>
              <p className="text-foreground">{issue.message}</p>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
