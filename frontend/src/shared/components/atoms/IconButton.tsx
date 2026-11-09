import type { LucideIcon } from 'lucide-react';

interface IconButtonProps {
  icon: LucideIcon;
  label: string;
  onClick?: () => void;
  className?: string;
}

export function IconButton({ icon: IconComp, label, onClick, className = '' }: IconButtonProps) {
  return (
    <button className={`icon-button ${className}`} aria-label={label} title={label} onClick={onClick}>
      <IconComp size={20} />
    </button>
  );
}
