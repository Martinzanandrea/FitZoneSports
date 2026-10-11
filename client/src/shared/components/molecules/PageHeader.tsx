import { BackButton } from './BackButton';

// Molécula: encabezado de página con título, volver opcional y acción.
export function PageHeader({
  title,
  onBack,
  action,
}: {
  title: string;
  onBack?: () => void;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div className="flex flex-col gap-1">
        {onBack && <BackButton onClick={onBack} />}
        <h2 className="font-title text-[22px] font-bold text-ink tracking-tight">{title}</h2>
      </div>
      {action}
    </div>
  );
}
