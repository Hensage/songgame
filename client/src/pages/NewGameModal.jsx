import { useEffect, useState } from 'react';
import { Button } from '../components/Button.jsx';
import { Modal } from '../components/Modal.jsx';
import { ToggleSection } from '../components/ToggleSection.jsx';
import { GenrePicker } from './GenrePicker.jsx';
import './NewGameModal.scss';

const FIRST_YEAR = 1950;
const CURRENT_YEAR = new Date().getFullYear();
const SONG_COUNTS = [1, 2, 3, 4, 5, 6];
const DEFAULT_SONG_COUNT = 3;

export function NewGameModal({ onClose, onCreate }) {
  const [songCount, setSongCount] = useState(DEFAULT_SONG_COUNT);
  const [after, setAfter] = useState(FIRST_YEAR);
  const [before, setBefore] = useState(CURRENT_YEAR);
  const [genreText, setGenreText] = useState('');
  const [genres, setGenres] = useState([]);

  useEffect(() => {
    let cancelled = false;

    fetch('/spotifyGenres.json')
      .then((response) => response.json())
      .then((list) => {
        if (!cancelled) setGenres(list);
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

  function create() {
    const term = genreText.trim().toLowerCase();
    onCreate({
      songCount,
      era: `${after}-${before}`,
      genre: genres.includes(term) ? term : '',
    });
  }

  return (
    <Modal
      title="New Game"
      onClose={onClose}
      footer={
        <>
          <Button variant="danger" onClick={onClose}>
            Back
          </Button>
          <Button onClick={create}>Create</Button>
        </>
      }
    >
      <div className="new-game__section">
        <div>Number of songs per person</div>
        {SONG_COUNTS.map((count) => (
          <label key={count} className="new-game__choice">
            <input
              type="radio"
              name="songcount"
              checked={songCount === count}
              onChange={() => setSongCount(count)}
            />
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
        <GenrePicker value={genreText} genres={genres} onChange={setGenreText} />
      </ToggleSection>
    </Modal>
  );
}
