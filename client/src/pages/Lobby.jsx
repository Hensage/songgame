import { useState } from 'react';
import { Button } from '../components/Button.jsx';
import { Panel } from '../components/Panel.jsx';
import { Spinner } from '../components/Spinner.jsx';
import { usePolling } from '../hooks/usePolling.js';
import { startLogin } from '../lib/api.js';
import { NewGameModal } from './NewGameModal.jsx';
import './Lobby.scss';

const POLL_INTERVAL_MS = 1000;

function GameRow({ label, action, onClick }) {
  return (
    <div className="game-row">
      <div className="game-row__label">{label}</div>
      <Button onClick={onClick}>{action}</Button>
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
        <Button size="large" disabled={loggingIn} onClick={() => setCreating(true)}>
          {loggingIn && <Spinner small />}
          Host new game
        </Button>
      )}

      {yourGame && (
        <Panel padded>
          <GameRow label="Your Game" action="Rejoin" onClick={() => joinGame(yourGame.gameid)} />
        </Panel>
      )}

      <section className="lobby__section">
        <div className="bold">Or join an existing game</div>
        <Panel padded>
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
                  label={`${game.hostName}'s Game`}
                  action="Join"
                  onClick={() => joinGame(game.gameid)}
                />
              ))}
            </div>
          )}
        </Panel>
      </section>

      {creating && <NewGameModal onClose={() => setCreating(false)} onCreate={createGame} />}
    </main>
  );
}
