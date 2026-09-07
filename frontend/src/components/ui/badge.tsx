import type { ReactNode } from 'react';

type BadgeTone = 'neutral' | 'info' | 'warning' | 'success' | 'danger';

interface BadgeProps {
  children: ReactNode;
  tone?: BadgeTone;
}

export function Badge({ children, tone = 'neutral' }: BadgeProps) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}
