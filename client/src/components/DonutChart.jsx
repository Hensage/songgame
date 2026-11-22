import { colorFor } from '../lib/chartColors.js';
import { ChartLegend } from './ChartLegend.jsx';
import './DonutChart.scss';

const CENTER = 100;
const RADIUS = 70;
const STROKE = 26;
const GAP = 3;

/** A ring split into one arc per entry, with the total in the middle and a legend below. */
export function DonutChart({ data, title }) {
  const total = data.reduce((sum, entry) => sum + entry.value, 0);
  const circumference = 2 * Math.PI * RADIUS;

  let offset = 0;
  const arcs = data.map((entry, index) => {
    const length = total > 0 ? (entry.value / total) * circumference : 0;
    const arc = { entry, index, dash: Math.max(length - GAP, 0), offset };
    offset += length;
    return arc;
  });

  return (
    <div className="donut">
      <svg
        className="donut__ring"
        viewBox="0 0 200 200"
        role="img"
        aria-label={`${title}: ${data.map((entry) => `${entry.label} ${entry.value}`).join(', ')}`}
      >
        <g transform={`rotate(-90 ${CENTER} ${CENTER})`}>
          {arcs.map(({ entry, index, dash, offset: start }) => (
            <circle
              key={entry.label}
              cx={CENTER}
              cy={CENTER}
              r={RADIUS}
              fill="none"
              stroke={colorFor(index)}
              strokeWidth={STROKE}
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeDashoffset={-start}
            />
          ))}
        </g>
        <text className="donut__total" x={CENTER} y={CENTER + 2} textAnchor="middle">
          {total}
        </text>
        <text className="donut__caption" x={CENTER} y={CENTER + 20} textAnchor="middle">
          songs
        </text>
      </svg>
      <ChartLegend data={data} />
    </div>
  );
}
