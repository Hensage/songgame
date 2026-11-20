import { useState } from 'react';
import { Button } from '../components/Button.jsx';
import { Modal } from '../components/Modal.jsx';
import { ArrowsOut, PaperPlaneTilt, SignOut, Trash } from '@phosphor-icons/react';
import { ProgressBar } from '../components/ProgressBar.jsx';
import { GenreVisuals } from '../components/GenreVisuals.jsx';
import { SongRow } from '../components/SongRow.jsx';
import { usePolling } from '../hooks/usePolling.js';
import { AddSongModal } from './AddSongModal.jsx';
import './Game.scss';

const POLL_INTERVAL_MS = 1000;
const isPixel = () => navigator.userAgent.includes('Pixel');

async function attempt(label, action) {
  try {
    return await action();
  } catch (error) {
    console.error(`Could not ${label}`, error);
    return undefined;
  }
}

function CountsModal({ view, onClose }) {
  return (
    <Modal
      title="Player song counts"
      onClose={onClose}
      footer={
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      }
    >
      {view.countCounts.map((count, index) => (
        <div className="count-row" key={index}>
          <div className="count-row__icon">
            <img src="/track.svg" alt="" />
            <span>{index}</span>
          </div>
          <div className="count-row__bar">
            <ProgressBar percent={view.playerCount > 0 ? (count / view.playerCount) * 100 : 0} label={count} />
          </div>
        </div>
      ))}

      <GenreVisuals data={view.genreCounts ?? []} />
    </Modal>
  );
}

function EndGameModal({ playlistLink, onClose }) {
  const pixel = isPixel();
  let text = 'The host has submitted the playlist and now has the spotify link. The game can now begin! You can now leave the game.';
  if (playlistLink) text = 'The link to the playlist here';
  else if (pixel) text = "Game's done bitch";

  return (
    <Modal
      title="Playlist building phase is over"
      dismissible={false}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          {playlistLink && <Button onClick={() => window.open(playlistLink, '_blank', 'noopener')}>Link to Spotify</Button>}
        </>
      }
    >
      <div>{text}</div>
      {!playlistLink && pixel && <img className="end-game__photo" src="/domphoto.jpg" alt="" />}
    </Modal>
  );
}

export function Game({ api, info, onExit }) {
  const [view, setView] = useState(null);
  const [ended, setEnded] = useState(false);
  const [playlistLink, setPlaylistLink] = useState('');
  const [modal, setModal] = useState(null);

  const refresh = usePolling(async () => {
    const next = await api.getUpdate();

    if (!next.validGame) {
      onExit();
      return;
    }

    if (!next.isPlaying) {
      if (next.playlistURL) setPlaylistLink(next.playlistURL);
      setEnded(true);
      return;
    }

    setView(next);
  }, POLL_INTERVAL_MS);

  const closeModal = () => setModal(null);

  async function removeSong(songID) {
    await attempt('remove song', () => api.removeSong(songID));
    refresh();
  }

  async function clearSongs() {
    await attempt('clear songs', () => api.clearSongs());
    refresh();
  }

  async function submitGame() {
    const result = await attempt('submit playlist', () => api.submit());

    if (!result) {
      alert('Could not submit playlist');
    } else if (!result.ok) {
      alert(result.body);
      return;
    } else {
      setPlaylistLink(result.body);
    }

    refresh();
  }

  async function leaveGame() {
    await attempt('leave game', () => api.leaveGame());
    onExit();
  }

  async function closeGame() {
    await attempt('close game', () => api.closeGame());
    onExit();
  }

  const items = view?.items ?? [];
  const songsPerPerson = view?.songsPerPerson ?? info.songsPerPerson;

  return (
    <main className="page game">
      <header className="game__header">
        <h1 className="game__title">{info.hostName}'s game</h1>
        <Button variant="secondary" size="small" icon={SignOut} onClick={() => setModal('leave')}>
          Leave game
        </Button>
      </header>

      <div className="row game__stats">
        <div className="game__stat">
          Player count
          <div className="faint">{view?.playerCount ?? 0}</div>
        </div>
        <Button variant="icon" aria-label="Player song counts" disabled={!view} onClick={() => setModal('counts')}>
          <ArrowsOut size={24} />
        </Button>
        <div className="game__stat">
          Song count
          <div className="faint">{view ? `${view.count} / ${view.playerCount * view.songsPerPerson}` : '0 / 0'}</div>
        </div>
      </div>

      <section className="game__songs">
        <div className="game__songs-header">
          <h2 className="game__songs-title">Your songs</h2>
          <span className="faint">
            {items.length} / {songsPerPerson}
          </span>
        </div>
        {items.length === 0 && <p className="faint game__empty">Songs you add will show up here.</p>}
        <div className="stack scroll-list">
          {items.map((song) => (
            <SongRow key={song.id} song={song} onRemove={removeSong} />
          ))}
        </div>
      </section>

      <Button className="game__add" disabled={items.length >= songsPerPerson} onClick={() => setModal('add')}>
        Add new song
      </Button>

      {info.isPlayerHost && (
        <div className="row game__host-actions">
          <Button variant="secondary" grow icon={Trash} onClick={() => setModal('clear')}>
            Clear all songs
          </Button>
          <Button variant="secondary" grow icon={PaperPlaneTilt} onClick={() => setModal('submit')}>
            Submit to spotify
          </Button>
        </div>
      )}

      {modal === 'add' && (
        <AddSongModal
          api={api}
          filters={{ genres: info.genres, era: info.era }}
          onClose={closeModal}
          onAdded={() => {
            closeModal();
            refresh();
          }}
        />
      )}

      {modal === 'counts' && view && <CountsModal view={view} onClose={closeModal} />}

      {modal === 'submit' && (
        <Modal
          title="Submit to Spotify?"
          onClose={closeModal}
          footer={
            <>
              <Button variant="secondary" onClick={closeModal}>
                No
              </Button>
              <Button
                onClick={() => {
                  closeModal();
                  submitGame();
                }}
              >
                Yes
              </Button>
            </>
          }
        >
          This will stop all other players from adding songs, and the game will begin
        </Modal>
      )}

      {modal === 'clear' && (
        <Modal
          title="Clear all songs?"
          onClose={closeModal}
          footer={
            <>
              <Button onClick={closeModal}>No</Button>
              <Button
                variant="secondary"
                onClick={() => {
                  closeModal();
                  clearSongs();
                }}
              >
                Yes
              </Button>
            </>
          }
        />
      )}

      {modal === 'leave' && (
        <Modal
          title="Leave Game?"
          onClose={closeModal}
          footer={
            <>
              <Button onClick={closeModal}>Stay</Button>
              <Button variant="secondary" onClick={leaveGame}>
                Leave
              </Button>
              {info.isPlayerHost && (
                <Button variant="secondary" onClick={closeGame}>
                  Leave &amp; close
                </Button>
              )}
            </>
          }
        >
          <p>Are you sure you want to leave the game?</p>
          <p>You can rejoin the game at any time.</p>
          {info.isPlayerHost && <p>Or as host, you can fully close the game for everyone as well</p>}
        </Modal>
      )}

      {ended && <EndGameModal playlistLink={playlistLink} onClose={closeGame} />}
    </main>
  );
}
