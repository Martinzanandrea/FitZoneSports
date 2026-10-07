interface LoadingStateProps {
  rows?: number;
  label?: string;
}

export function LoadingState({ rows = 3, label = 'Cargando' }: LoadingStateProps) {
  return (
    <div className="flex flex-col gap-2" role="status" aria-label={label}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="glass skeleton-row rounded-[18px] p-4">
          <i />
          <div>
            <i />
            <i />
          </div>
        </div>
      ))}
    </div>
  );
}
