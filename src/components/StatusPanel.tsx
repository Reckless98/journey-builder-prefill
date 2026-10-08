import type { ReactNode } from 'react';

interface StatusPanelProps {
  title: string;
  children?: ReactNode;
  /** `alert` is announced immediately, for failures. `status` is announced politely. */
  role?: 'status' | 'alert';
  /** Shows a spinner next to the title. */
  busy?: boolean;
  action?: ReactNode;
}

/** A centred message that stands in for content: loading, failure or nothing to show. */
export function StatusPanel({ title, children, role, busy = false, action }: StatusPanelProps) {
  return (
    <div
      role={role}
      className="flex flex-col items-center gap-3 rounded-xl border border-slate-200 bg-white px-6 py-14 text-center"
    >
      <div className="flex items-center gap-3">
        {busy && (
          <span
            aria-hidden="true"
            className="size-4 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-600 motion-reduce:animate-none"
          />
        )}
        <p className="font-medium text-slate-900">{title}</p>
      </div>
      {children && <div className="max-w-prose text-sm text-slate-600">{children}</div>}
      {action}
    </div>
  );
}
