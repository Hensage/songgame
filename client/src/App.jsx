import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from './components/Button.jsx';
import { Spinner } from './components/Spinner.jsx';
import { createApi } from './lib/api.js';
import { getPlayerId } from './lib/identity.js';
import { Game } from './pages/Game.jsx';
import { Lobby } from './pages/Lobby.jsx';

/**
 * Shows the lobby until the server says this player is in a game, then the game.
 * `refreshInfo` is the single way to move between the two.
 */
export function App() {
  const playerID = useMemo(getPlayerId, []);
  const api = useMemo(() => createApi(playerID), [playerID]);
  const [info, setInfo] = useState(null);
  const [failed, setFailed] = useState(false);

  const refreshInfo = useCallback(async () => {
    try {
      setInfo(await api.loadInfo());
      setFailed(false);
    } catch (error) {
      console.error('Could not load game info', error);
      setFailed(true);
    }
  }, [api]);

  useEffect(() => {
    // The Spotify callback redirects here with ?playerID=; the stored ID is what counts.
    if (window.location.search) window.history.replaceState(null, '', window.location.pathname);
    refreshInfo();
  }, [refreshInfo]);

  if (failed && !info) {
    return (
      <main className="page">
        <p>Could not reach the server.</p>
        <Button onClick={refreshInfo}>Try again</Button>
      </main>
    );
  }

  if (!info) {
    return (
      <main className="page">
        <Spinner />
      </main>
    );
  }

  return info.validGame ? (
    <Game api={api} info={info} onExit={refreshInfo} />
  ) : (
    <Lobby api={api} playerID={playerID} onJoined={refreshInfo} />
  );
}
