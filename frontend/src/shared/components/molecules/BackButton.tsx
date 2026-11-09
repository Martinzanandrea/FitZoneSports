import { ArrowLeft } from 'lucide-react';

// Molécula: botón "Volver" (usado por PageHeader).
export function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 text-sm font-medium text-mist hover:text-lime transition-colors mb-1"
      style={{ minHeight: 44 }}
    >
      <ArrowLeft size={18} />
      Volver
    </button>
  );
}
