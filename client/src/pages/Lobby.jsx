import { useState } from 'react';
import { ArrowClockwise, SignIn } from '@phosphor-icons/react';
import { Button } from '../components/Button.jsx';
import { Spinner } from '../components/Spinner.jsx';
import { usePolling } from '../hooks/usePolling.js';
import { startLogin } from '../lib/api.js';
import { NewGameModal } from './NewGameModal.jsx';
import './Lobby.scss';

const POLL_INTERVAL_MS = 1000;

const playerCount = (count) => `${count} ${count === 1 ? 'player' : 'players'}`;

function GameRow({ title, subtitle, action, icon, onClick }) {
  return (
    <div className="game-row">
      <div className="game-row__label">
        <div className="game-row__title">{title}</div>
        <div className="game-row__subtitle">{subtitle}</div>
      </div>
      <Button variant="secondary" size="small" icon={icon} onClick={onClick}>
        {action}
      </Button>
    </div>
  );
}

export function Lobby({ api, playerID, onJoined }) {
  const [games, setGames] = useState({ yourGame: null, otherGames: [] });
  const [creating, setCreating] = useState(false);
  const [loggingIn, setLoggingIn] = useState(false);

  usePolling(async () => {
    const result = await api.getGames();
    if (result) setGames({ yourGame: result.yourGame ?? null, otherGames: result.otherGames });
  }, POLL_INTERVAL_MS);

  async function joinGame(gameID) {
    try {
      await api.joinGame(gameID);
    } catch (error) {
      console.error('Could not join game', error);
    }
    onJoined();
  }

  function createGame(settings) {
    setCreating(false);
    setLoggingIn(true);
    startLogin({ playerID, ...settings });
  }

  const { yourGame, otherGames } = games;

  return (
    <main className="page lobby">
      <img className="page__logo" src="/songgame.png" alt="Song Game" />

      {!yourGame && (
        <Button disabled={loggingIn} onClick={() => setCreating(true)}>
          {loggingIn && <Spinner small />}
          Host new game
        </Button>
      )}

      {yourGame && (
        <GameRow
          title="Your game"
          subtitle={playerCount(yourGame.playerCount)}
          action="Rejoin"
          icon={ArrowClockwise}
          onClick={() => joinGame(yourGame.gameid)}
        />
      )}

      <section className="lobby__section">
        <h2 className="lobby__heading">Or join an existing game</h2>
        {otherGames.length === 0 ? (
          <div className="lobby__empty">
            <Spinner />
            No games found so far
          </div>
        ) : (
          <div className="stack scroll-list">
            {otherGames.map((game) => (
              <GameRow
                key={game.gameid}
                title={`${game.hostName}'s game`}
                subtitle={playerCount(game.playerCount)}
                action="Join"
                icon={SignIn}
                onClick={() => joinGame(game.gameid)}
              />
            ))}
          </div>
        )}
      </section>

      {creating && <NewGameModal api={api} onClose={() => setCreating(false)} onCreate={createGame} />}
    </main>
  );
}
