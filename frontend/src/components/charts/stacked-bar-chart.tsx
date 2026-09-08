import { useState } from 'react';

export interface StackedBarSegment {
  key: string;
  label: string;
  value: number;
  colorVar: string;
}

export interface StackedBarRow {
  rowLabel: string;
  segments: StackedBarSegment[];
}

interface StackedBarChartProps {
  rows: StackedBarRow[];
  emptyMessage?: string;
}

/**
 * Horizontal stacked bar — one row per entity (e.g. assignee), segments by
 * status. A 2px surface gap separates touching segments; the legend carries
 * identity for every segment key across the whole chart, not per-row.
 */
export function StackedBarChart({ rows, emptyMessage }: StackedBarChartProps) {
  const [hovered, setHovered] = useState<{ row: number; segment: number } | null>(null);

  if (rows.length === 0) {
    return <p className="task-activity-empty">{emptyMessage ?? 'No data yet.'}</p>;
  }

  const maxTotal = Math.max(
    ...rows.map((row) => row.segments.reduce((sum, s) => sum + s.value, 0)),
    1,
  );

  const legendEntries = new Map<string, { label: string; colorVar: string }>();
  for (const row of rows) {
    for (const segment of row.segments) {
      if (!legendEntries.has(segment.key)) {
        legendEntries.set(segment.key, { label: segment.label, colorVar: segment.colorVar });
      }
    }
  }

  return (
    <div className="stacked-bar-chart">
      <div className="bar-chart">
        {rows.map((row, rowIndex) => {
          const total = row.segments.reduce((sum, s) => sum + s.value, 0);
          return (
            <div className="bar-chart-row" key={row.rowLabel}>
              <span className="bar-chart-label">{row.rowLabel}</span>
              <div className="stacked-bar-track">
                {row.segments
                  .filter((s) => s.value > 0)
                  .map((segment, segIndex) => {
                    const widthPercent = (segment.value / maxTotal) * 100;
                    const isHovered = hovered?.row === rowIndex && hovered.segment === segIndex;
                    return (
                      <div
                        key={segment.key}
                        className="stacked-bar-segment"
                        style={{
                          width: `${widthPercent}%`,
                          background: `var(${segment.colorVar})`,
                          opacity: hovered === null || isHovered ? 1 : 0.55,
                        }}
                        onPointerEnter={() => setHovered({ row: rowIndex, segment: segIndex })}
                        onPointerLeave={() => setHovered(null)}
                        tabIndex={0}
                        onFocus={() => setHovered({ row: rowIndex, segment: segIndex })}
                        onBlur={() => setHovered(null)}
                      >
                        {isHovered && (
                          <div className="bar-chart-tooltip">
                            <strong>{segment.value}</strong>
                            <span>{segment.label}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
              <span className="bar-chart-value">{total}</span>
            </div>
          );
        })}
      </div>
      <div className="chart-legend">
        {Array.from(legendEntries.values()).map((entry) => (
          <span className="chart-legend-item" key={entry.label}>
            <span className="chart-legend-swatch" style={{ background: `var(${entry.colorVar})` }} />
            {entry.label}
          </span>
        ))}
      </div>
    </div>
  );
}
