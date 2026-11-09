// Molécula: paginador Anterior/Siguiente.
export function Pagination({ page, totalPages, onChange }: {
  page: number; totalPages: number; onChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-3 mt-4">
      <button disabled={page <= 1} onClick={() => onChange(page - 1)}
        className="px-3 py-1.5 rounded-lg border border-white/10 text-sm text-ink disabled:opacity-40"
        style={{ minHeight: 44 }}>
        Anterior
      </button>
      <span className="text-sm text-mist">Página {page} de {totalPages}</span>
      <button disabled={page >= totalPages} onClick={() => onChange(page + 1)}
        className="px-3 py-1.5 rounded-lg border border-white/10 text-sm text-ink disabled:opacity-40"
        style={{ minHeight: 44 }}>
        Siguiente
      </button>
    </div>
  );
}
