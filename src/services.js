import { createApp } from './app.js';
import { Game } from './game.js';
import { GameStore } from './gameStore.js';
import { createGenreLookup } from './genres.js';
import { SpotifyClient } from './spotify.js';

/**
 * Wires the store, Spotify client and Express app together. Exposed separately
 * from the entry point so tests can start the app without opening a port.
 */
export function createServices(config, { logger = console } = {}) {
  const spotify = config.stub ? null : new SpotifyClient(config);
  const gameDependencies = {
    spotify,
    gameLifetimeMs: config.gameLifetimeMs,
    tokenLifetimeMs: config.tokenLifetimeMs,
  };

  const createGame = (fields) => new Game({ ...gameDependencies, ...fields });
  const store = new GameStore({
    gamesFilePath: config.gamesFilePath,
    gameFactory: (data) => Game.fromJSON(data, gameDependencies),
    logger,
    sweepIntervalMs: config.sweepIntervalMs,
  });
  const lookupGenres = createGenreLookup({ spotify, stub: config.stub, logger });
  const app = createApp({ config, store, spotify, createGame, lookupGenres });

  return { app, store, spotify, createGame };
}