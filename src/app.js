import { readFile } from 'node:fs/promises';
import path from 'node:path';
import express from 'express';
import { makeId } from './random.js';
import { SpotifyError } from './spotify.js';

const DEFAULT_SONGS_PER_PERSON = 3;
const MIN_SONGS_PER_PERSON = 1;
const MAX_SONGS_PER_PERSON = 10;
const FIRST_GAME_YEAR = 1950;
const GENRE_COUNT_TTL_MS = 10 * 60 * 1000;
const GENRE_COUNT_CACHE_SIZE = 500;
const MAX_GENRE_LENGTH = 80;
const MAX_GENRES = 5;

// Stub counts are fake: they grow with the genre names' length so the lobby can
// show both its "few songs" and "plenty of songs" states without Spotify.
function stubMatchCount(genres) {
  return genres.length === 0 ? 100000 : genres.reduce((total, genre) => total + genre.length * 20, 0);
}

/** Genres from a repeated `genre` query value: trimmed, lower-case, unique, and capped. */
function readGenres(value) {
  const values = Array.isArray(value) ? value : [value];
  const genres = values
    .filter((item) => typeof item === 'string')
    .map((item) => item.trim().toLowerCase().slice(0, MAX_GENRE_LENGTH))
    .filter(Boolean);
  return [...new Set(genres)].slice(0, MAX_GENRES);
}

function readString(value) {
  return typeof value === 'string' ? value : null;
}

function readPlayerId(req) {
  const playerID = readString(req.query.playerID);
  return playerID ? playerID : null;
}

function normalizeSongCount(value) {
  const count = Number.parseInt(value, 10);
  if (!Number.isInteger(count)) return DEFAULT_SONGS_PER_PERSON;
  return Math.min(Math.max(count, MIN_SONGS_PER_PERSON), MAX_SONGS_PER_PERSON);
}

function normalizeEra(value) {
  if (/^\d{4}(-\d{4})?$/.test(value ?? '')) return value;
  return `${FIRST_GAME_YEAR}-${new Date().getFullYear()}`;
}

function toGameSummary(game) {
  return {
    gameid: game.gameid,
    hostName: game.hostName,
    songsPerPerson: game.songsPerPerson,
    era: game.era,
    genres: game.genres,
    playerCount: game.players.length,
  };
}

export function createApp({ config, store, spotify, createGame, lookupGenres = async () => [] }) {
  const app = express();
  const loginStates = new Map();
  const genreCounts = new Map();

  app.disable('x-powered-by');
  app.use(express.json());
  app.use(express.static(config.clientDir));

  function requirePlayerId(req, res) {
    const playerID = readPlayerId(req);
    if (!playerID) res.status(400).send('Missing playerID');
    return playerID;
  }

  function purgeExpiredLoginStates() {
    const cutoff = Date.now() - config.loginStateTtlMs;
    for (const [state, login] of loginStates) {
      if (login.createdAt < cutoff) loginStates.delete(state);
    }
  }

  // The React app decides between lobby and game itself, using /loadinfo.
  app.get('/', (req, res) => {
    res.sendFile(path.join(config.clientDir, 'index.html'));
  });

  app.get('/getGames', (req, res) => {
    const playerID = readPlayerId(req);
    const otherGames = [];
    let yourGame;

    for (const game of store.all()) {
      if (game.playlistURL !== '') continue;

      const summary = toGameSummary(game);
      if (playerID && game.isHost(playerID)) {
        yourGame = summary;
      } else {
        otherGames.push(summary);
      }
    }

    res.json({ otherGames, ...(yourGame ? { yourGame } : {}) });
  });

  app.post('/joinGame', (req, res) => {
    const playerID = requirePlayerId(req, res);
    if (!playerID) return;

    const gameID = readString(req.query.gameID);
    if (!gameID) {
      res.status(400).send('Missing gameID');
      return;
    }

    let changed = false;
    const currentGame = store.findByPlayerId(playerID);
    if (currentGame) changed = currentGame.removePlayerFromGame(playerID) || changed;

    const targetGame = store.findById(gameID);
    if (!targetGame) {
      if (changed) store.save();
      res.sendStatus(404);
      return;
    }

    targetGame.addPlayerToGame(playerID);
    store.save();
    res.sendStatus(200);
  });

  app.post('/leaveGame', (req, res) => {
    const playerID = requirePlayerId(req, res);
    if (!playerID) return;

    const game = store.findByPlayerId(playerID);
    if (!game) {
      res.sendStatus(404);
      return;
    }

    game.removePlayerFromGame(playerID);
    store.save();
    res.sendStatus(200);
  });

  app.post('/closeGame', (req, res) => {
    const playerID = requirePlayerId(req, res);
    if (!playerID) return;

    const game = store.findByPlayerId(playerID);
    if (!game) {
      res.sendStatus(404);
      return;
    }

    if (game.isHost(playerID)) {
      store.remove(game.gameid);
    } else {
      game.removePlayerFromGame(playerID);
    }

    store.save();
    res.sendStatus(200);
  });

  // Lets the host see whether a genre and era combination has songs before signing in.
  app.get('/genreCheck', async (req, res) => {
    const genres = readGenres(req.query.genre);
    const era = normalizeEra(readString(req.query.era));
    const key = `${[...genres].sort().join(',')}|${era}`;

    const cached = genreCounts.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      res.json({ total: cached.total });
      return;
    }

    const total = config.stub ? stubMatchCount(genres) : await spotify.countTracks({ era, genres });

    if (genreCounts.size >= GENRE_COUNT_CACHE_SIZE) genreCounts.delete(genreCounts.keys().next().value);
    genreCounts.set(key, { total, expiresAt: Date.now() + GENRE_COUNT_TTL_MS });
    res.json({ total });
  });

  app.get('/login', (req, res) => {
    const playerID = requirePlayerId(req, res);
    if (!playerID) return;

    purgeExpiredLoginStates();

    const state = makeId(16);
    loginStates.set(state, {
      playerID,
      songCount: normalizeSongCount(req.query.songCount),
      era: normalizeEra(readString(req.query.era)),
      genres: readGenres(req.query.genre),
      createdAt: Date.now(),
    });

    if (config.stub) {
      res.redirect(`${config.redirectUri}?state=${encodeURIComponent(state)}`);
      return;
    }

    res.redirect(spotify.buildAuthorizeUrl(state));
  });

  app.get('/callback', async (req, res) => {
    const state = readString(req.query.state);
    if (!state) {
      res.redirect('/#error=state_mismatch');
      return;
    }

    const login = loginStates.get(state);
    loginStates.delete(state);
    if (!login) {
      res.status(400).send('This login has expired. Please start again.');
      return;
    }

    let game;
    if (config.stub) {
      game = createGame({
        hostPlayerID: login.playerID,
        hostId: makeId(16),
        hostName: 'STUBACCOUNT',
        accessToken: 'TOKEN',
        refreshToken: 'REFRESHTOKEN',
        songsPerPerson: login.songCount,
        era: login.era,
        genres: login.genres,
      });
    } else {
      if (readString(req.query.error)) {
        res.status(400).send('Spotify authorization was cancelled.');
        return;
      }

      const code = readString(req.query.code);
      if (!code) {
        res.status(400).send('Missing Spotify authorization code.');
        return;
      }

      const tokens = await spotify.exchangeCode(code);
      const profile = await spotify.getCurrentUser(tokens.accessToken);

      game = createGame({
        hostPlayerID: login.playerID,
        hostId: profile.id,
        hostName: profile.displayName,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        songsPerPerson: login.songCount,
        era: login.era,
        genres: login.genres,
      });
    }

    store.add(game);
    store.save();
    res.redirect(`/?playerID=${encodeURIComponent(login.playerID)}`);
  });

  app.get('/search', async (req, res) => {
    const query = readString(req.query.query)?.trim() ?? '';
    if (!query) {
      res.status(400).send('No query provided');
      return;
    }

    const playerID = requirePlayerId(req, res);
    if (!playerID) return;

    const game = store.findByPlayerId(playerID);
    if (!game) {
      res.json({ validGame: false });
      return;
    }

    if (config.stub) {
      const stub = JSON.parse(await readFile(config.stubSearchPath, 'utf8'));
      res.json(stub.tracks.items);
      return;
    }

    const items = await spotify.searchTracks({
      accessToken: game.accessToken,
      query,
      era: game.era,
      genres: game.genres,
    });
    res.json(items);
  });

  app.get('/loadinfo', (req, res) => {
    const playerID = requirePlayerId(req, res);
    if (!playerID) return;

    const game = store.findByPlayerId(playerID);
    if (!game) {
      res.json({ validGame: false });
      return;
    }

    res.json({
      validGame: true,
      hostName: game.hostName,
      isPlayerHost: game.isHost(playerID),
      songsPerPerson: game.songsPerPerson,
      era: game.era,
      genres: game.genres,
    });
  });

  app.get('/update', (req, res) => {
    const playerID = requirePlayerId(req, res);
    if (!playerID) return;

    const game = store.findByPlayerId(playerID);
    if (!game) {
      res.json({ validGame: false });
      return;
    }

    res.json(game.update(playerID));
  });

  app.post('/remove', (req, res) => {
    const playerID = requirePlayerId(req, res);
    if (!playerID) return;

    const songID = readString(req.query.songID);
    if (!songID) {
      res.status(400).send('Missing songID');
      return;
    }

    const game = store.findByPlayerId(playerID);
    if (!game) {
      res.sendStatus(404);
      return;
    }

    game.removeSong(playerID, songID);
    store.save();
    res.sendStatus(200);
  });

  app.post('/submit', async (req, res) => {
    const playerID = requirePlayerId(req, res);
    if (!playerID) return;

    const game = store.findByPlayerId(playerID);
    if (!game) {
      res.sendStatus(404);
      return;
    }
    if (!game.isHost(playerID)) {
      res.status(403).send('not host');
      return;
    }

    const result = await game.submit({ stub: config.stub });
    if (!result.ok) {
      res.status(400).send(result.message);
      return;
    }

    store.save();
    res.send(result.playlistURL);
  });

  app.post('/clear', (req, res) => {
    const playerID = requirePlayerId(req, res);
    if (!playerID) return;

    const game = store.findByPlayerId(playerID);
    if (!game) {
      res.sendStatus(404);
      return;
    }
    if (!game.isHost(playerID)) {
      res.status(403).send('not host');
      return;
    }

    game.clear();
    store.save();
    res.sendStatus(200);
  });

  app.post('/add', async (req, res) => {
    const playerID = requirePlayerId(req, res);
    if (!playerID) return;

    const song = req.body;
    if (typeof song !== 'object' || song === null || !readString(song.id) || !readString(song.uri)) {
      res.status(400).send('Invalid song');
      return;
    }

    const game = store.findByPlayerId(playerID);
    if (!game) {
      res.sendStatus(404);
      return;
    }

    song.playerID = playerID;
    const result = game.addSong(song);
    // The song object is the one stored in the playlist, so the genres attach to it.
    if (result.ok) song.genres = await lookupGenres(song, game.accessToken);
    store.save();
    res.status(result.ok ? 200 : 409).send(result.message);
  });

  app.use((error, req, res, next) => {
    if (res.headersSent) {
      next(error);
      return;
    }

    if (error instanceof SpotifyError) {
      console.error(`Spotify request failed on ${req.method} ${req.originalUrl}:`, error.message);
      res.status(502).send('Error fetching data from Spotify');
      return;
    }

    if (error.status && error.status < 500) {
      res.status(error.status).send(error.message);
      return;
    }

    console.error(`Unhandled error on ${req.method} ${req.originalUrl}:`, error);
    res.status(500).send('Something went wrong');
  });

  return app;
}