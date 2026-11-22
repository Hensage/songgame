import { colorFor } from '../lib/chartColors.js';
import { ChartLegend } from './ChartLegend.jsx';
import './StackedBar.scss';

/** One bar split into proportional segments, one per entry, with a legend below. */
export function StackedBar({ data, title }) {
  return (
    <div className="stacked">
      <div
        className="stacked__bar"
        role="img"
        aria-label={`${title}: ${data.map((entry) => `${entry.label} ${entry.value}`).join(', ')}`}
      >
        {data.map((entry, index) => (
          <span
            key={entry.label}
            className="stacked__segment"
            style={{ flexGrow: entry.value, background: colorFor(index) }}
            title={`${entry.label}: ${entry.value}`}
          />
        ))}
      </div>
      <ChartLegend data={data} />
    </div>
  );
}
