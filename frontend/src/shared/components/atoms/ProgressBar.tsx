// Átomo: barra de progreso.
export function ProgressBar({ value, color = '#caff3d' }: { value: number; color?: string }) {
  return (
    <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
      <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, value)}%`, background: color }} />
    </div>
  );
}
