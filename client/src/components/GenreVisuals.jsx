import { useMemo, useState } from 'react';
import { ChartBarHorizontal, ChartDonut, ChartPolar, Rows } from '@phosphor-icons/react';
import { BarChart } from './BarChart.jsx';
import { Chip } from './Chip.jsx';
import { DonutChart } from './DonutChart.jsx';
import { RadarChart } from './RadarChart.jsx';
import { StackedBar } from './StackedBar.jsx';
import './GenreVisuals.scss';

const TITLE = 'Songs by genre';
// Spotify has thousands of genres, so only the most common get their own slice.
const MAX_GENRES_SHOWN = 7;
// A radar chart needs at least three axes to form a shape.
const RADAR_MIN_GENRES = 3;

// The chart types on offer. `render` draws the same `[{ label, value }]` data each way.
const CHARTS = [
  { id: 'bars', label: 'Bars', icon: ChartBarHorizontal, render: (data) => <BarChart title={TITLE} data={data} /> },
  { id: 'radar', label: 'Radar', icon: ChartPolar, render: (data) => <RadarChart title={TITLE} data={data} /> },
  { id: 'donut', label: 'Donut', icon: ChartDonut, render: (data) => <DonutChart title={TITLE} data={data} /> },
  { id: 'stacked', label: 'Stacked', icon: Rows, render: (data) => <StackedBar title={TITLE} data={data} /> },
];

/** Keeps the most common genres and adds the rest up as "Other". `data` is sorted, largest first. */
function groupSmallGenres(data) {
  if (data.length <= MAX_GENRES_SHOWN + 1) return data;

  const rest = data.slice(MAX_GENRES_SHOWN).reduce((sum, entry) => sum + entry.value, 0);
  return [...data.slice(0, MAX_GENRES_SHOWN), { label: 'Other', value: rest }];
}

/**
 * The genre breakdown of the songs added so far, with a switcher for trying different
 * chart types on the same data. `data` is `[{ label, value }]`, most common first.
 */
export function GenreVisuals({ data }) {
  const [chartId, setChartId] = useState(CHARTS[0].id);
  const shown = useMemo(() => groupSmallGenres(data), [data]);
  const radarFits = shown.length >= RADAR_MIN_GENRES;

  // Fall back to bars if the chosen radar chart no longer has enough genres to draw.
  const activeId = chartId === 'radar' && !radarFits ? CHARTS[0].id : chartId;
  const chart = CHARTS.find((option) => option.id === activeId);

  return (
    <section className="visuals">
      <h2 className="visuals__title">{TITLE}</h2>

      {shown.length === 0 ? (
        <p className="faint visuals__empty">Genres will show up here once songs are added.</p>
      ) : (
        <>
          <div className="chips visuals__switcher" role="group" aria-label="Chart type">
            {CHARTS.map(({ id, label, icon: Icon }) => (
              <Chip
                key={id}
                selected={id === activeId}
                disabled={id === 'radar' && !radarFits}
                onClick={() => setChartId(id)}
              >
                <Icon size={18} weight="bold" aria-hidden="true" />
                {label}
              </Chip>
            ))}
          </div>

          <div className="visuals__chart">{chart.render(shown)}</div>
          <p className="faint visuals__note">
            Each song counts toward every genre its artist has. Spotify doesn't list a genre for every artist.
          </p>
        </>
      )}
    </section>
  );
}
