import type { ReactNode } from 'react';

// Layout split-screen del diseño Figma (foto lateral + panel de form).
// Solo markup: la lógica de auth vive en cada página.
export function AuthLayout({
  children,
  photoUrl,
  headline,
  subheadline,
  tag,
}: {
  children: ReactNode;
  photoUrl: string;
  headline: string;
  subheadline: string;
  tag?: string;
}) {
  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-[#0A0A0A]">
      <div className="relative lg:w-1/2 h-48 lg:h-auto flex-shrink-0 overflow-hidden">
        <img src={photoUrl} alt="Gimnasio" className="absolute inset-0 w-full h-full object-cover" />
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.4) 50%, rgba(0,0,0,0.15) 100%)',
          }}
        />
        <div className="absolute top-6 left-6 flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #8B2EFF, #A855F7)' }}
          >
            <span className="text-white text-xs font-black">FZ</span>
          </div>
          <span className="text-white font-black text-base tracking-tight">FitZone</span>
        </div>
        {tag && (
          <div className="absolute top-6 right-6">
            <span className="bg-white/10 backdrop-blur-md border border-white/20 text-white text-xs font-bold px-3 py-1.5 rounded-full">
              {tag}
            </span>
          </div>
        )}
        <div className="absolute bottom-8 left-8 right-8 hidden lg:block">
          <h2 className="text-4xl font-black tracking-tight text-white leading-tight mb-3 whitespace-pre-line">
            {headline}
          </h2>
          <p className="text-white/70 text-base font-medium">{subheadline}</p>
        </div>
      </div>
      <div className="flex-1 bg-white overflow-y-auto">
        <div className="min-h-full flex items-start lg:items-center justify-center py-8 px-6">
          <div className="w-full max-w-sm">{children}</div>
        </div>
      </div>
    </div>
  );
}

export function AuthInput({
  label,
  type = 'text',
  placeholder,
  icon,
  value,
  onChange,
  rightEl,
  autoComplete,
}: {
  label: string;
  type?: string;
  placeholder: string;
  icon: ReactNode;
  value: string;
  onChange: (v: string) => void;
  rightEl?: ReactNode;
  autoComplete?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
        {label}
      </label>
      <div className="relative">
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">{icon}</div>
        <input
          type={type}
          placeholder={placeholder}
          value={value}
          autoComplete={autoComplete}
          onChange={(e) => onChange(e.target.value)}
          className="w-full pl-11 pr-11 py-3.5 rounded-2xl border-2 border-gray-100 bg-gray-50 text-gray-900 text-sm font-medium placeholder:text-gray-300 outline-none transition-all focus:border-[#8B2EFF] focus:bg-white focus:ring-4 focus:ring-[#8B2EFF]/10"
          style={{ minHeight: 44 }}
        />
        {rightEl && <div className="absolute right-4 top-1/2 -translate-y-1/2">{rightEl}</div>}
      </div>
    </div>
  );
}
