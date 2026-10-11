import { TrendingUp } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface MetricCardProps {
  label: string;
  value: string;
  change: string;
  icon: LucideIcon;
  tone?: string;
}

export function MetricCard({ label, value, change, icon: IconComp, tone = '' }: MetricCardProps) {
  return (
    <article className={`glass metric-card ${tone}`}>
      <span className="metric-icon">
        <IconComp size={19} />
      </span>
      <div className="metric-value">{value}</div>
      <div className="metric-label">{label}</div>
      <div className="metric-change">
        <TrendingUp size={14} /> {change}
      </div>
    </article>
  );
}
