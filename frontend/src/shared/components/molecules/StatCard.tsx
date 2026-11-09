import type { LucideIcon } from 'lucide-react';

// Molécula: tarjeta de estadística con ícono y tendencia.
export function StatCard({ label, value, sub, icon: Icon, iconColor = '#caff3d', trend }: {
  label: string; value: string; sub?: string; icon?: LucideIcon; iconColor?: string; trend?: 'up' | 'down';
}) {
  return (
    <div className="glass rounded-[20px] p-4">
      <div className="flex items-start justify-between">
        <span className="text-[13px] font-medium text-mist">{label}</span>
        {Icon && (
          <span
            className="flex h-9 w-9 items-center justify-center rounded-full shrink-0"
            style={{ backgroundColor: `${iconColor}1A` }}
          >
            <Icon size={18} style={{ color: iconColor }} />
          </span>
        )}
      </div>
      <div className="font-title text-[28px] font-bold text-ink tracking-tight mt-2">{value}</div>
      {sub && (
        <div className={`text-[13px] mt-1 flex items-center gap-1 ${
          trend === 'up' ? 'text-[#8cf2a6]' : trend === 'down' ? 'text-coral' : 'text-mist'
        }`}>
          {trend === 'up' && '↑ '}{trend === 'down' && '↓ '}{sub}
        </div>
      )}
    </div>
  );
}
