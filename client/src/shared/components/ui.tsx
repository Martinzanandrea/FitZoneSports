import { type ReactNode } from 'react';

type BadgeVariant = 'green' | 'red' | 'amber' | 'violet' | 'gray';
const badgeStyles: Record<BadgeVariant, string> = {
  green: 'bg-[#F0FDF4] text-[#16A34A]',
  red: 'bg-[#FEF2F2] text-[#DC2626]',
  amber: 'bg-[#FFFBEB] text-[#D97706]',
  violet: 'bg-[#F3E8FF] text-[#8B2EFF]',
  gray: 'bg-[#F3F4F6] text-[#6B7280]',
};

export function Badge({ variant, children }: { variant: BadgeVariant; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full text-xs font-semibold px-2.5 py-0.5 ${badgeStyles[variant]}`}>
      {children}
    </span>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl p-4 bg-white border border-[#E5E7EB] ${className}`}>
      {children}
    </div>
  );
}

interface ButtonProps {
  children: ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit';
  variant?: 'primary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  fullWidth?: boolean;
  className?: string;
}

const btnBase = 'inline-flex items-center justify-center gap-2 font-semibold rounded-xl transition-all select-none';
const btnVariants: Record<string, string> = {
  primary: 'bg-[#8B2EFF] text-white hover:bg-[#7A25E6]',
  outline: 'bg-transparent text-[#8B2EFF] border-[1.5px] border-[#8B2EFF] hover:bg-[#F3E8FF]',
  ghost: 'bg-[#F3F4F6] text-[#374151] border border-[#E5E7EB] hover:bg-[#E5E7EB]',
  danger: 'bg-[#FEF2F2] text-[#DC2626] border border-[#FECACA] hover:bg-[#FEE2E2]',
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

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="text-base font-bold text-[#111111] mb-3">{children}</h2>;
}

export function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full text-sm font-medium px-4 h-9 inline-flex items-center whitespace-nowrap transition-colors ${
        active ? 'bg-[#8B2EFF] text-white' : 'bg-[#F3F4F6] text-[#6B7280] border border-[#E5E7EB] hover:border-[#8B2EFF]'
      }`}
      style={{ minHeight: '44px' }}
    >
      {label}
    </button>
  );
}