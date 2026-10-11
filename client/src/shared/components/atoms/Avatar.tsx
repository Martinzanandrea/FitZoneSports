// Átomo: avatar con iniciales y color derivado del nombre.
export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const initials = name.split(' ').map((w) => w[0]).slice(0, 2).join('');
  const colors = ['#caff3d', '#54e6d8', '#ff826c', '#8cf2a6', '#ffd071'];
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
