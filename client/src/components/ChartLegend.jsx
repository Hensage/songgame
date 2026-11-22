import { colorFor } from '../lib/chartColors.js';
import './ChartLegend.scss';

/** A colour key for a chart: a dot, the label, the count and its share of the total. */
export function ChartLegend({ data }) {
  const total = data.reduce((sum, entry) => sum + entry.value, 0) || 1;

  return (
    <ul className="legend">
      {data.map((entry, index) => (
        <li key={entry.label} className="legend__item">
          <span className="legend__dot" style={{ background: colorFor(index) }} aria-hidden="true" />
          <span className="legend__label">{entry.label}</span>
          <span className="legend__value">{entry.value}</span>
          <span className="legend__share faint">{Math.round((entry.value / total) * 100)}%</span>
        </li>
      ))}
    </ul>
  );
}
