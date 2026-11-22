import './BarChart.scss';

/** Horizontal bars, longest first. `data` is `[{ label, value }]`. */
export function BarChart({ data, title }) {
  const sorted = [...data].sort((a, b) => b.value - a.value);
  const max = Math.max(1, ...sorted.map((entry) => entry.value));

  return (
    <ul className="bars" aria-label={title}>
      {sorted.map((entry) => (
        <li key={entry.label} className="bars__row">
          <span className="bars__label">{entry.label}</span>
          <span className="bars__track">
            <span className="bars__fill" style={{ width: `${(entry.value / max) * 100}%` }} />
          </span>
          <span className="bars__value">{entry.value}</span>
        </li>
      ))}
    </ul>
  );
}
