import { CalendarDays } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: LucideIcon;
}

export function EmptyState({ title, description, action, icon: IconComp = CalendarDays }: EmptyStateProps) {
  return (
    <div className="glass empty-state">
      <div className="empty-illustration">
        <IconComp size={38} />
        <i />
        <i />
      </div>
      <h2>{title}</h2>
      {description && <p>{description}</p>}
      {action}
    </div>
  );
}
