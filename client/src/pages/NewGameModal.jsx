import { useEffect, useState } from 'react';
import { Button } from '../components/Button.jsx';
import { Chip } from '../components/Chip.jsx';
import { Modal } from '../components/Modal.jsx';
import { ToggleSection } from '../components/ToggleSection.jsx';
import { useGenreCheck } from '../hooks/useGenreCheck.js';
import { CURRENT_YEAR, FIRST_YEAR, isFullEra } from '../lib/filters.js';
import { GENRE_FAMILIES, MAX_GENRES } from '../lib/genreFamilies.js';
import { GenrePicker } from './GenrePicker.jsx';
import './NewGameModal.scss';

const SONG_COUNTS = [1, 2, 3, 4, 5, 6];
const DEFAULT_SONG_COUNT = 3;
// Below this many matches, players are likely to struggle to find songs.
const FEW_SONGS = 100;

function MatchSummary({ status, total }) {
  if (status === 'loading') return <p className="new-game__match faint">Checking for songs…</p>;
  if (status !== 'ready') return null;

  if (total === 0) {
    return <p className="new-game__match new-game__match--none">No songs match. Try a wider era or a broader genre.</p>;
  }
  if (total < FEW_SONGS) {
    return (
      <p className="new-game__match new-game__match--few">
        Only about {total} songs match, so players may struggle to find picks. Try a wider era or a broader genre.
      </p>
    );
  }
  return <p className="new-game__match new-game__match--plenty">Plenty of songs to choose from.</p>;
}

export function NewGameModal({ api, onClose, onCreate }) {
  const [songCount, setSongCount] = useState(DEFAULT_SONG_COUNT);
  const [after, setAfter] = useState(FIRST_YEAR);
  const [before, setBefore] = useState(CURRENT_YEAR);
  const [selected, setSelected] = useState([]);
  const [genreText, setGenreText] = useState('');
  const [allGenres, setAllGenres] = useState([]);

  const era = `${after}-${before}`;
  const filtered = selected.length > 0 || !isFullEra(era);
  const match = useGenreCheck(api, { genres: selected, era, enabled: filtered });
  const full = selected.length >= MAX_GENRES;
  // Chosen genres that aren't one of the quick picks still need a chip so they can be removed.
  const extraGenres = selected.filter((genre) => !GENRE_FAMILIES.some((family) => family.genre === genre));

  useEffect(() => {
    let cancelled = false;

    fetch('/spotifyGenres.json')
      .then((response) => response.json())
      .then((list) => {
        if (!cancelled) setAllGenres(list);
      })
      .catch((error) => console.error('Could not load genres', error));

    return () => {
      cancelled = true;
    };
  }, []);

  // Keep the two year sliders from crossing over.
  const changeAfter = (year) => {
    setAfter(year);
    if (year > before) setBefore(year);
  };
  const changeBefore = (year) => {
    setBefore(year);
    if (year < after) setAfter(year);
  };

  // A song only has to match one of the chosen genres.
  function toggleGenre(genre) {
    setSelected((current) => {
      if (current.includes(genre)) return current.filter((item) => item !== genre);
      return current.length >= MAX_GENRES ? current : [...current, genre];
    });
  }

  function pickGenre(genre) {
    setGenreText('');
    setSelected((current) => (current.includes(genre) || current.length >= MAX_GENRES ? current : [...current, genre]));
  }

  return (
    <Modal
      title="New Game"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Back
          </Button>
          <Button disabled={match.status === 'ready' && match.total === 0} onClick={() => onCreate({ songCount, era, genre: selected })}>
            Create
          </Button>
        </>
      }
    >
      <div className="new-game__section">
        <div>Number of songs per person</div>
        {SONG_COUNTS.map((count) => (
          <label key={count} className="new-game__choice">
            <input type="radio" name="songcount" checked={songCount === count} onChange={() => setSongCount(count)} />
            {count}
          </label>
        ))}
      </div>

      <ToggleSection label="Filter by era of music">
        <label htmlFor="afterRange">After</label>
        <input
          id="afterRange"
          className="new-game__range"
          type="range"
          min={FIRST_YEAR}
          max={CURRENT_YEAR}
          value={after}
          onChange={(event) => changeAfter(Number(event.target.value))}
        />
        <div>{after}</div>
        <label htmlFor="beforeRange">Before</label>
        <input
          id="beforeRange"
          className="new-game__range"
          type="range"
          min={FIRST_YEAR}
          max={CURRENT_YEAR}
          value={before}
          onChange={(event) => changeBefore(Number(event.target.value))}
        />
        <div>{before}</div>
      </ToggleSection>

      <ToggleSection label="Filter by Genre">
        <div className="chips">
          <Chip selected={selected.length === 0} onClick={() => setSelected([])}>
            Any genre
          </Chip>
          {GENRE_FAMILIES.map((family) => (
            <Chip
              key={family.genre}
              selected={selected.includes(family.genre)}
              disabled={full && !selected.includes(family.genre)}
              onClick={() => toggleGenre(family.genre)}
            >
              {family.label}
            </Chip>
          ))}
          {extraGenres.map((genre) => (
            <Chip key={genre} selected onClick={() => toggleGenre(genre)}>
              {genre} ×
            </Chip>
          ))}
        </div>
        <p className="new-game__hint faint">
          {full ? `That's the most genres you can pick (${MAX_GENRES}).` : `Pick up to ${MAX_GENRES}. Songs can match any of them.`}
        </p>

        <div className="new-game__more">
          <ToggleSection label="More specific genre">
            <GenrePicker
              value={genreText}
              genres={allGenres}
              excluded={selected}
              disabled={full}
              onChange={setGenreText}
              onPick={pickGenre}
            />
          </ToggleSection>
        </div>
      </ToggleSection>

      <MatchSummary status={match.status} total={match.total} />
    </Modal>
  );
}
