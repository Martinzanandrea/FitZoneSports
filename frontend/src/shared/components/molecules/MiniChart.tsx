const DEFAULT_VALUES = [42, 56, 48, 67, 59, 82, 76, 91, 85, 96, 88, 104];
const DEFAULT_LABELS = ['Jun', 'Sep', 'Dic', 'Mar', 'May'];

interface MiniChartProps {
  values?: number[];
  labels?: string[];
  ariaLabel?: string;
}

export function MiniChart({
  values = DEFAULT_VALUES,
  labels = DEFAULT_LABELS,
  ariaLabel = 'Evolución durante los últimos 12 meses',
}: MiniChartProps) {
  const max = Math.max(...values, 1);
  return (
    <div>
      <div className="mini-chart" aria-label={ariaLabel}>
        {values.map((value, index) => (
          <span key={index} style={{ height: `${Math.max(5, (value / max) * 100)}%` }} />
        ))}
      </div>
      <div className="chart-axis">
        {labels.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
    </div>
  );
}
