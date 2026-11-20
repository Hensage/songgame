import { Button } from './Button.jsx';
import './SongRow.scss';

const artistNames = (song) => song.artists?.map((artist) => artist.name).join(', ') ?? '';
const albumArt = (song) => song.album?.images?.[0]?.url;

function SongDetails({ song }) {
  return (
    <>
      <img className="song-row__thumbnail" alt="Thumbnail" src={albumArt(song)} />
      <div className="song-row__label">
        <div className="song-row__name">
          {song.name}
          {song.explicit && (
            <span className="explicit-badge" title="Explicit" aria-label="Explicit">
              E
            </span>
          )}
        </div>
        <div className="song-row__artist">{artistNames(song)}</div>
      </div>
    </>
  );
}

/** A song in the player's own list, with a remove button. */
export function SongRow({ song, onRemove }) {
  return (
    <div className="song-row">
      <SongDetails song={song} />
      <Button variant="danger" onClick={() => onRemove(song.id)}>
        X
      </Button>
    </div>
  );
}

/** A search suggestion that adds the song when clicked. */
export function SuggestionRow({ song, onSelect }) {
  return (
    <button type="button" className="song-row song-row--clickable" onClick={() => onSelect(song)}>
      <SongDetails song={song} />
    </button>
  );
}
