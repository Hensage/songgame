import './RadarChart.scss';

const SIZE = { width: 320, height: 300 };
const CENTER = { x: SIZE.width / 2, y: SIZE.height / 2 };
const RADIUS = 90;
const LABEL_OFFSET = 14;
const RINGS = 4;

const angleFor = (index, total) => -Math.PI / 2 + (index / total) * 2 * Math.PI;

function pointAt(index, total, distance) {
  const angle = angleFor(index, total);
  return { x: CENTER.x + distance * Math.cos(angle), y: CENTER.y + distance * Math.sin(angle), angle };
}

const toPoints = (points) => points.map(({ x, y }) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');

function anchorFor(angle) {
  const horizontal = Math.cos(angle);
  if (horizontal > 0.2) return 'start';
  if (horizontal < -0.2) return 'end';
  return 'middle';
}

/**
 * A radar (spider) chart: one axis per entry in `data`, drawn from the centre
 * outwards. `data` is `[{ label, value }]` and needs at least three entries.
 */
export function RadarChart({ data, title }) {
  const total = data.length;
  const max = Math.max(1, ...data.map((entry) => entry.value));
  const ringMax = Math.ceil(max / RINGS) * RINGS;

  const rings = Array.from({ length: RINGS }, (_, ring) => {
    const distance = (RADIUS * (ring + 1)) / RINGS;
    return toPoints(data.map((_, index) => pointAt(index, total, distance)));
  });

  const values = data.map((entry, index) => pointAt(index, total, (entry.value / ringMax) * RADIUS));

  return (
    <svg
      className="radar"
      viewBox={`0 0 ${SIZE.width} ${SIZE.height}`}
      role="img"
      aria-label={`${title}: ${data.map((entry) => `${entry.label} ${entry.value}`).join(', ')}`}
    >
      {rings.map((points, index) => (
        <polygon key={index} className="radar__ring" points={points} />
      ))}

      {data.map((entry, index) => {
        const end = pointAt(index, total, RADIUS);
        return <line key={entry.label} className="radar__axis" x1={CENTER.x} y1={CENTER.y} x2={end.x} y2={end.y} />;
      })}

      <polygon className="radar__area" points={toPoints(values)} />

      {values.map((point, index) => (
        <circle key={data[index].label} className="radar__dot" cx={point.x} cy={point.y} r="3.5" />
      ))}

      {data.map((entry, index) => {
        const label = pointAt(index, total, RADIUS + LABEL_OFFSET);
        return (
          <text
            key={entry.label}
            className="radar__label"
            x={label.x}
            y={label.y}
            textAnchor={anchorFor(label.angle)}
            dominantBaseline="middle"
          >
            {entry.label}
            <tspan className="radar__value" dx="4">
              {entry.value}
            </tspan>
          </text>
        );
      })}
    </svg>
  );
}
