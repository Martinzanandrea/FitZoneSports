export interface RankingItem {
  name: string;
  value: number;
}

const DEFAULT_ITEMS: RankingItem[] = [
  { name: 'Palermo', value: 94 },
  { name: 'Belgrano', value: 81 },
  { name: 'Caballito', value: 73 },
  { name: 'Olivos', value: 66 },
];

interface RankingProps {
  items?: RankingItem[];
}

export function Ranking({ items = DEFAULT_ITEMS }: RankingProps) {
  return (
    <div className="ranking">
      {items.map((item, i) => (
        <div key={item.name}>
          <span className="rank-number">0{i + 1}</span>
          <strong>{item.name}</strong>
          <span className="rank-track">
            <i style={{ width: `${Math.min(100, Math.max(0, item.value))}%` }} />
          </span>
          <b>{item.value}%</b>
        </div>
      ))}
    </div>
  );
}
