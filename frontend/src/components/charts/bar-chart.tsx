import { useId, useState } from 'react';

export interface BarChartDatum {
  label: string;
  value: number;
  colorVar?: string;
}

interface BarChartProps {
  data: BarChartDatum[];
  height?: number;
  valueFormatter?: (value: number) => string;
  emptyMessage?: string;
}

const CHART_VARS = ['--chart-1', '--chart-2', '--chart-3', '--chart-4', '--chart-5', '--chart-6', '--chart-7', '--chart-8'];

/**
 * Horizontal categorical bar chart. Bars are capped at 24px, rounded on the
 * data end, square at the baseline; a 2px surface gap separates them. Hover
 * shows a tooltip (value leads, label follows) since the tooltip only
 * supplements the already-visible direct label at the bar tip.
 */
export function BarChart({ data, height = 28, valueFormatter, emptyMessage }: BarChartProps) {
  const gradientId = useId();
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (data.length === 0) {
    return <p className="task-activity-empty">{emptyMessage ?? 'No data yet.'}</p>;
  }

  const maxValue = Math.max(...data.map((d) => d.value), 1);
  const format = valueFormatter ?? ((v: number) => v.toLocaleString());

  return (
    <div className="bar-chart" role="img" aria-label="Bar chart">
      {data.map((datum, index) => {
        const widthPercent = (datum.value / maxValue) * 100;
        const colorVar = datum.colorVar ?? CHART_VARS[index % CHART_VARS.length];
        const isHovered = hoveredIndex === index;

        return (
          <div
            key={`${gradientId}-${datum.label}`}
            className="bar-chart-row"
            onPointerEnter={() => setHoveredIndex(index)}
            onPointerLeave={() => setHoveredIndex(null)}
            onFocus={() => setHoveredIndex(index)}
            onBlur={() => setHoveredIndex(null)}
            tabIndex={0}
          >
            <span className="bar-chart-label">{datum.label}</span>
            <div className="bar-chart-track" style={{ height }}>
              <div
                className="bar-chart-fill"
                style={{
                  width: `${Math.max(widthPercent, 2)}%`,
                  background: `var(${colorVar})`,
                  height,
                  opacity: hoveredIndex === null || isHovered ? 1 : 0.55,
                }}
              />
            </div>
            <span className="bar-chart-value">{format(datum.value)}</span>
            {isHovered && (
              <div className="bar-chart-tooltip">
                <strong>{format(datum.value)}</strong>
                <span>{datum.label}</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
