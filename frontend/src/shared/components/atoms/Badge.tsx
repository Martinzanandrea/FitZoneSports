import type { ReactNode } from 'react';

// Átomo: etiqueta de estado. Las variantes históricas se conservan y mapean
// a los tonos del diseño.
export type BadgeVariant =
  | 'green'
  | 'red'
  | 'amber'
  | 'gray'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'neutral';

const badgeTones: Record<BadgeVariant, string> = {
  green: 'badge-success',
  success: 'badge-success',
  red: 'badge-danger',
  danger: 'badge-danger',
  amber: 'badge-warning',
  warning: 'badge-warning',
  info: 'badge-info',
  gray: 'badge-neutral',
  neutral: 'badge-neutral',
};

export function Badge({ variant, children }: { variant: BadgeVariant; children: ReactNode }) {
  return (
    <span className={`badge ${badgeTones[variant]}`}>
      <i />
      {children}
    </span>
  );
}
