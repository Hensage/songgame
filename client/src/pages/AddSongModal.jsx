import { useEffect, useRef, useState } from 'react';
import { MagnifyingGlass } from '@phosphor-icons/react';
import { Alert } from '../components/Alert.jsx';
import { Button } from '../components/Button.jsx';
import { Modal } from '../components/Modal.jsx';
import { SuggestionRow } from '../components/SongRow.jsx';
import { Spinner } from '../components/Spinner.jsx';
import { describeFilters } from '../lib/filters.js';
import './Game.scss';

const ERROR_VISIBLE_MS = 1000;

export function AddSongModal({ api, filters, onClose, onAdded }) {
  const [text, setText] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState('');
  const errorTimer = useRef();

  useEffect(() => () => clearTimeout(errorTimer.current), []);

  function showError(message) {
    setError(message);
    clearTimeout(errorTimer.current);
    errorTimer.current = setTimeout(() => setError(''), ERROR_VISIBLE_MS);
  }

  async function search() {
    if (searching) return;

    setSearching(true);
    setSearched(false);
    setSuggestions([]);
    setError('');

    try {
      const result = await api.search(text);
      if (result.ok) {
        setSuggestions(result.songs);
        setSearched(true);
      } else {
        showError(result.message);
      }
    } catch (searchError) {
      console.error('Song search failed', searchError);
      showError('Could not search for songs');
    } finally {
      setSearching(false);
    }
  }

  async function add(song) {
    setSuggestions([]);
    setText('');

    try {
      const result = await api.addSong(song);
      if (!result.ok) {
        showError(result.message);
        return;
      }
      onAdded();
    } catch (addError) {
      console.error('Could not add song', addError);
      showError('Could not add song');
    }
  }

  return (
    <Modal
      title="Add new song"
      onClose={onClose}
      closeDisabled={searching}
      footer={
        <Button variant="secondary" disabled={searching} onClick={onClose}>
          Close
        </Button>
      }
    >
      <div className="add-song">
        {error && <Alert>{error}</Alert>}
        <div className="add-song__search">
          <MagnifyingGlass className="add-song__search-icon" size={22} weight="bold" aria-hidden="true" />
          <input
            type="search"
            enterKeyHint="search"
            aria-label="Song title"
            placeholder="Song title"
            autoComplete="off"
            autoFocus
            value={text}
            disabled={searching}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') search();
            }}
          />
        </div>
        {searching && <Spinner className="add-song__loader" />}
        {searched && suggestions.length === 0 && (
          <p className="add-song__empty faint">
            No songs found
            {describeFilters(filters) && ` for ${describeFilters(filters)}`}. Try different words.
          </p>
        )}
        <div className="add-song__results">
          {suggestions.map((song) => (
            <SuggestionRow key={song.id} song={song} onSelect={add} />
          ))}
        </div>
      </div>
    </Modal>
  );
}
