import { useMemo, useState } from 'react';
import { MagnifyingGlass } from '@phosphor-icons/react';
import './NewGameModal.scss';

const MAX_OPTIONS = 200;

/**
 * A text box that suggests matching Spotify genres as you type. Choosing a
 * suggestion, or pressing Enter on an exact match, calls `onPick`.
 * Genres in `excluded` (already chosen) are left out of the suggestions.
 */
export function GenrePicker({ value, genres, excluded = [], disabled = false, onChange, onPick }) {
  const [open, setOpen] = useState(false);

  const matches = useMemo(() => {
    const term = value.trim().toLowerCase();
    if (!term) return [];
    return genres.filter((genre) => genre.includes(term) && !excluded.includes(genre)).slice(0, MAX_OPTIONS);
  }, [genres, excluded, value]);

  function pick(genre) {
    onPick(genre);
    setOpen(false);
  }

  return (
    <div className="genre-picker">
      <MagnifyingGlass className="genre-picker__icon" size={22} weight="bold" aria-hidden="true" />
      <input
        type="search"
        enterKeyHint="search"
        className="genre-picker__input"
        placeholder={disabled ? 'Remove a genre to add another' : 'Search...'}
        aria-label="Search genres"
        autoComplete="off"
        disabled={disabled}
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
          setOpen(true);
        }}
        onKeyDown={(event) => {
          const term = value.trim().toLowerCase();
          if (event.key === 'Enter' && genres.includes(term) && !excluded.includes(term)) pick(term);
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
                // Pick on mousedown so the input's blur doesn't close the menu first.
                onMouseDown={(event) => {
                  event.preventDefault();
                  pick(genre);
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
