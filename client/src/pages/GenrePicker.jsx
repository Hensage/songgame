import { useMemo, useState } from 'react';
import './NewGameModal.scss';

const MAX_OPTIONS = 200;

/** A text box that suggests matching Spotify genres as you type. */
export function GenrePicker({ value, genres, onChange }) {
  const [open, setOpen] = useState(false);

  const matches = useMemo(() => {
    const term = value.toLowerCase();
    return term ? genres.filter((genre) => genre.toLowerCase().includes(term)).slice(0, MAX_OPTIONS) : [];
  }, [genres, value]);

  return (
    <div className="genre-picker">
      <input
        type="text"
        className="genre-picker__input"
        placeholder="Search..."
        aria-label="Search genres"
        autoComplete="off"
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
          setOpen(true);
        }}
        onBlur={() => setOpen(false)}
      />
      {open && matches.length > 0 && (
        <ul className="genre-picker__menu">
          {matches.map((genre) => (
            <li key={genre}>
              <button
                type="button"
                className="genre-picker__option"
                // Select on mousedown so the input's blur doesn't close the menu first.
                onMouseDown={(event) => {
                  event.preventDefault();
                  onChange(genre);
                  setOpen(false);
                }}
              >
                {genre}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
