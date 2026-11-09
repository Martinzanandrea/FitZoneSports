import { CircleAlert } from 'lucide-react';

interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
  retryLabel?: string;
}

export function ErrorState({
  title = 'No pudimos cargar los datos',
  description = 'Revisá tu conexión e intentá de nuevo en unos segundos.',
  onRetry,
  retryLabel = 'Volver a intentar',
}: ErrorStateProps) {
  return (
    <div className="glass empty-state error-state">
      <CircleAlert size={38} />
      <h2>{title}</h2>
      <p>{description}</p>
      {onRetry && (
        <button className="btn btn-secondary" onClick={onRetry}>
          {retryLabel}
        </button>
      )}
    </div>
  );
}
