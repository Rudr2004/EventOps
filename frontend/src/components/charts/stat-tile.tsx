interface StatTileProps {
  label: string;
  value: string | number;
  tone?: 'neutral' | 'accent' | 'danger';
}

export function StatTile({ label, value, tone = 'neutral' }: StatTileProps) {
  return (
    <div className={`stat-tile stat-tile-${tone}`}>
      <span className="stat-tile-label">{label}</span>
      <span className="stat-tile-value">{value}</span>
    </div>
  );
}
