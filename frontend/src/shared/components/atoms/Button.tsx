import type { ReactNode } from 'react';

// Átomo: botón del sistema de diseño.
export interface ButtonProps {
  children: ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit';
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  fullWidth?: boolean;
  className?: string;
}

const btnBase = 'inline-flex items-center justify-center gap-2 font-semibold rounded-xl transition-all select-none';
const btnVariants: Record<string, string> = {
  // Los colores de texto llevan `!` porque `button { color: inherit }` (theme.css,
  // sin capa) pisa las utilidades de Tailwind y dejaba el texto claro sobre lime.
  // #071a1d sobre lime ≈ 15:1 y sobre coral ≈ 7:1; ink/mist sobre glass > 7:1.
  primary: 'bg-lime text-bg! hover:brightness-110 border border-transparent',
  secondary: 'bg-white/[0.06] text-ink! border border-white/10 hover:bg-white/10',
  outline: 'bg-transparent text-lime! border-[1.5px] border-lime/60 hover:bg-lime/10',
  ghost: 'bg-transparent text-mist! border border-transparent hover:text-ink! hover:bg-white/[0.05]',
  danger: 'bg-coral text-bg! border border-transparent hover:brightness-110',
};
const btnSizes: Record<string, string> = { sm: 'px-3 text-sm', md: 'px-4 text-sm', lg: 'px-5 text-base' };
const btnHeights: Record<string, string> = { sm: 'h-9', md: 'h-11', lg: 'h-12' };

export function Button({ children, onClick, type = 'button', variant = 'primary', size = 'md', disabled, fullWidth, className = '' }: ButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${btnBase} ${btnSizes[size]} ${btnHeights[size]} ${btnVariants[variant]} ${fullWidth ? 'w-full' : ''} ${className} ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
      style={{ minHeight: '44px' }}
    >
      {children}
    </button>
  );
}
