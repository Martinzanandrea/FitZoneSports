import { ArrowLeft, type LucideIcon } from 'lucide-react';
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

export function StatCard({ label, value, sub, icon: Icon, trend }: {
  label: string; value: string; sub?: string; icon?: LucideIcon; trend?: 'up' | 'down';
}) {
  return (
    <div className="rounded-xl p-4 bg-white border border-[#E5E7EB]">
      <div className="flex items-start justify-between">
        <span className="text-[13px] font-medium text-[#6B7280]">{label}</span>
        {Icon && <Icon size={18} className="text-[#8B2EFF]" />}
      </div>
      <div className="text-[28px] font-bold text-[#111111] tracking-tight mt-2">{value}</div>
      {sub && (
        <div className={`text-[13px] mt-1 flex items-center gap-1 ${
          trend === 'up' ? 'text-[#16A34A]' : trend === 'down' ? 'text-[#DC2626]' : 'text-[#6B7280]'
        }`}>
          {trend === 'up' && '↑ '}{trend === 'down' && '↓ '}{sub}
        </div>
      )}
    </div>
  );
}

export function ProgressBar({ value, color = '#8B2EFF' }: { value: number; color?: string }) {
  return (
    <div className="w-full h-1.5 rounded-full bg-[#F3F4F6] overflow-hidden">
      <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, value)}%`, background: color }} />
    </div>
  );
}

export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const initials = name.split(' ').map((w) => w[0]).slice(0, 2).join('');
  const colors = ['#8B2EFF', '#3B82F6', '#16A34A', '#F59E0B', '#DC2626'];
  const color = colors[name.charCodeAt(0) % colors.length];
  return (
    <div
      className="rounded-full flex items-center justify-center font-bold shrink-0"
      style={{ width: size, height: size, background: `${color}1A`, border: `1px solid ${color}40`, color, fontSize: size * 0.35 }}
    >
      {initials}
    </div>
  );
}

export function Donut({ active, inactive, size = 80 }: { active: number; inactive: number; size?: number }) {
  const total = active + inactive;
  const r = size / 2 - 8;
  const circ = 2 * Math.PI * r;
  const activePct = total > 0 ? active / total : 0;
  const offset = circ * (1 - activePct);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#F3F4F6" strokeWidth={10} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#8B2EFF" strokeWidth={10}
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-sm font-bold text-[#111111]">{Math.round(activePct * 100)}%</span>
      </div>
    </div>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function formatMoney(n: number): string {
  return '$' + n.toLocaleString('es-AR');
}

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
        <h2 className="text-[22px] font-bold text-[#111111] tracking-tight">{title}</h2>
      </div>
      {action}
    </div>
  );
}
export function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 text-sm font-medium text-[#6B7280] hover:text-[#8B2EFF] transition-colors mb-1"
      style={{ minHeight: 44 }}
    >
      <ArrowLeft size={18} />
      Volver
    </button>
  );
}