import type { CSSProperties } from 'react';

interface DonutProps {
  value: number;
  label: string;
}

export function Donut({ value, label }: DonutProps) {
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <div
      className="donut"
      role="img"
      aria-label={`${label}: ${clamped}%`}
      style={{ '--progress': `${clamped * 3.6}deg` } as CSSProperties}
    >
      <div>
        <strong>{clamped}%</strong>
        <span>{label}</span>
      </div>
    </div>
  );
}
