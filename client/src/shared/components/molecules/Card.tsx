import type { ReactNode } from 'react';

// Molécula: tarjeta contenedora del sistema de diseño.
export function Card({ children, className = '', style }: { children: ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div className={`glass rounded-[22px] p-5 text-ink ${className}`} style={style}>
      {children}
    </div>
  );
}
