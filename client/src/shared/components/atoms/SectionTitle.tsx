import type { ReactNode } from 'react';

// Átomo: título de sección.
export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="font-title text-base font-bold text-ink mb-3">{children}</h2>;
}
