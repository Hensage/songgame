import { useEffect, useState } from 'react';
import { Button } from '../components/Button.jsx';
import { Modal } from '../components/Modal.jsx';
import { Panel } from '../components/Panel.jsx';
import { ProgressBar } from '../components/ProgressBar.jsx';
import { RadarChart } from '../components/RadarChart.jsx';
import { SongRow } from '../components/SongRow.jsx';
import { usePolling } from '../hooks/usePolling.js';
import { STUB_GENRE_COUNTS } from '../lib/stubGenreCounts.js';
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

function useLobbyAudio() {
  useEffect(() => {
    if (!isPixel()) return undefined;

    const audio = new Audio('/Lobby.mp3');
    audio.loop = true;
    // Browsers block autoplay until the user interacts; ignore.
    audio.play().catch(() => {});

    return () => audio.pause();
  }, []);
}

function CountsModal({ view, onClose }) {
  return (
    <Modal
      title="Player song counts"
      onClose={onClose}
      footer={
        <Button variant="danger" onClick={onClose}>
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

      <h2 className="count-chart__title">Songs by genre</h2>
      <RadarChart title="Songs by genre" data={STUB_GENRE_COUNTS} />
      <p className="faint count-chart__note">Sample data</p>
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
          <Button variant="danger" onClick={onClose}>
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

  useLobbyAudio();

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
      <Panel className="game__header">
        <img className="game__logo" src="/songgameLogo.png" alt="Song Game" />
        <div className="game__host">The host is {info.hostName}</div>
        <Button variant="danger" onClick={() => setModal('leave')}>
          Leave Game
        </Button>
      </Panel>

      <Panel>
        <div className="row">
          <div className="game__stat">
            Player count
            <div className="faint">{view?.playerCount ?? 0}</div>
          </div>
          <Button variant="danger" aria-label="Player song counts" disabled={!view} onClick={() => setModal('counts')}>
            <img className="game__expand-icon" src="/expand.svg" alt="" />
          </Button>
          <div className="game__stat">
            Song Count
            <div className="faint">{view ? `${view.count} / ${view.playerCount * view.songsPerPerson}` : '0 / 0'}</div>
          </div>
        </div>
      </Panel>

      <Panel>
        <div className="bold">
          Your songs
          <div className="faint">
            {items.length} / {songsPerPerson}
          </div>
        </div>
        <div className="stack scroll-list">
          {items.map((song) => (
            <SongRow key={song.id} song={song} onRemove={removeSong} />
          ))}
        </div>
      </Panel>

      <Button size="large" className="game__add" disabled={items.length >= songsPerPerson} onClick={() => setModal('add')}>
        Add new song
      </Button>

      {info.isPlayerHost && (
        <div className="row game__host-actions">
          <Button variant="danger" grow onClick={() => setModal('clear')}>
            Clear all songs
          </Button>
          <Button grow onClick={() => setModal('submit')}>
            Submit to spotify
          </Button>
        </div>
      )}

      {modal === 'add' && (
        <AddSongModal
          api={api}
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
              <Button variant="danger" onClick={closeModal}>
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
                variant="danger"
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
              <Button variant="danger" onClick={leaveGame}>
                Leave
              </Button>
              {info.isPlayerHost && (
                <Button variant="danger" onClick={closeGame}>
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
