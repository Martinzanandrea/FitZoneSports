// Átomo: chip seleccionable (filtros).
export function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full text-sm font-medium px-4 h-9 inline-flex items-center whitespace-nowrap transition-colors ${
        active ? 'bg-lime text-bg' : 'bg-white/[0.05] text-mist border border-white/10 hover:border-lime/60'
      }`}
      style={{ minHeight: '44px' }}
    >
      {label}
    </button>
  );
}
