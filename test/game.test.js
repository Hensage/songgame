import assert from 'node:assert/strict';
import test from 'node:test';
import { Game, SONG_ALREADY_EXISTS, SONG_LIMIT_REACHED } from '../src/game.js';

function createFakeSpotify() {
  const calls = { created: [], added: [], refreshed: 0 };

  return {
    calls,
    async createPlaylist(input) {
      calls.created.push(input);
      return { id: 'playlist-1', url: 'https://open.spotify.com/playlist/playlist-1' };
    },
    async addTracksToPlaylist(input) {
      calls.added.push(input);
    },
    async refreshAccessToken(refreshToken) {
      calls.refreshed += 1;
      assert.equal(refreshToken, 'refresh-token');
      return { accessToken: 'new-access-token', refreshToken: 'new-refresh-token' };
    },
  };
}

function createGame(overrides = {}) {
  return new Game({
    hostPlayerID: 'host',
    hostId: 'spotify-user',
    hostName: 'Host',
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
    songsPerPerson: 2,
    era: '1990-1999',
    genre: 'rock',
    spotify: createFakeSpotify(),
    ...overrides,
  });
}

function song(id, playerID) {
  return { id, uri: `spotify:track:${id}`, name: id, playerID };
}

test('the host joins their own game', () => {
  const game = createGame();

  assert.equal(game.isHost('host'), true);
  assert.equal(game.isPlayerInGame('host'), true);
  assert.deepEqual(game.players, ['host']);
  assert.equal(game.addPlayerToGame('host'), false);
});

test('players are tracked separately while active and after leaving', () => {
  const game = createGame();
  game.addPlayerToGame('guest');

  assert.deepEqual(game.activePlayers, ['host', 'guest']);
  assert.equal(game.removePlayerFromGame('guest'), true);
  assert.deepEqual(game.activePlayers, ['host']);
  assert.deepEqual(game.players, ['host'], 'a player without songs is forgotten');

  game.addPlayerToGame('guest');
  game.addSong(song('g1', 'guest'));
  game.removePlayerFromGame('guest');
  assert.deepEqual(game.players, ['host', 'guest'], 'players with songs stay for the final shuffle');
});

test('only the host can remove songs, and only their own', () => {
  const game = createGame();
  game.addPlayerToGame('guest');
  game.addSong(song('h1', 'host'));
  game.addSong(song('g1', 'guest'));

  assert.equal(game.removeSong('host', 'g1'), false);
  assert.equal(game.removeSong('guest', 'g1'), true);
  assert.deepEqual(game.playlist.map((item) => item.id), ['h1']);
});

test('addSong enforces the per-player limit and rejects duplicates', () => {
  const game = createGame();
  game.addPlayerToGame('guest');

  assert.deepEqual(game.addSong(song('g1', 'guest')), { ok: true, message: 'Added' });
  assert.deepEqual(game.addSong(song('g1', 'guest')), { ok: false, message: SONG_ALREADY_EXISTS });
  assert.deepEqual(game.addSong(song('g2', 'guest')), { ok: true, message: 'Added' });
  assert.deepEqual(game.addSong(song('g3', 'guest')), { ok: false, message: SONG_LIMIT_REACHED });
});

test('update only returns the requesting player songs while the game is live', () => {
  const game = createGame();
  game.addPlayerToGame('guest');
  game.addSong(song('h1', 'host'));
  game.addSong(song('g1', 'guest'));
  game.updateCountCounts();

  const state = game.update('guest');
  assert.equal(state.validGame, true);
  assert.equal(state.isPlaying, true);
  assert.equal(state.playerCount, 2);
  assert.equal(state.songsPerPerson, 2);
  assert.equal(state.count, 2);
  assert.deepEqual(state.items.map((item) => item.id), ['g1']);
  assert.deepEqual(state.countCounts, [0, 2, 0]);

  game.playlistURL = 'https://open.spotify.com/playlist/playlist-1';
  assert.deepEqual(game.update('guest').items, []);
});

test('counts ignore songs from players that are no longer tracked', () => {
  const game = createGame();
  game.addSong(song('ghost', 'someone-else'));
  game.updateCountCounts();

  assert.deepEqual(game.countCounts, [1, 0, 0]);
});

test('submit shuffles the playlist into a new Spotify playlist and clears it', async () => {
  const game = createGame();
  game.addPlayerToGame('guest');
  game.addSong(song('h1', 'host'));
  game.addSong(song('h2', 'host'));
  game.addSong(song('g1', 'guest'));
  game.addSong(song('g2', 'guest'));

  const result = await game.submit();

  assert.equal(result.ok, true);
  assert.equal(result.playlistURL, 'https://open.spotify.com/playlist/playlist-1');
  assert.deepEqual(game.playlist, []);
  assert.equal(game.playlistURL, 'https://open.spotify.com/playlist/playlist-1');

  assert.equal(game.spotify.calls.created.length, 1);
  assert.equal(game.spotify.calls.created[0].accessToken, 'access-token');
  assert.match(game.spotify.calls.created[0].description, /2 songs/);

  assert.equal(game.spotify.calls.added.length, 1);
  const addedUris = game.spotify.calls.added[0].uris;
  assert.equal(addedUris.length, 4);
  assert.deepEqual(new Set(addedUris), new Set(['spotify:track:h1', 'spotify:track:h2', 'spotify:track:g1', 'spotify:track:g2']));
});

test('submit refuses an empty playlist', async () => {
  const game = createGame();
  assert.deepEqual(await game.submit(), { ok: false, message: 'No songs to submit' });
});

test('stub submit records the chosen URIs instead of calling Spotify', async () => {
  const game = createGame({ spotify: null });
  game.addSong(song('h1', 'host'));

  const result = await game.submit({ stub: true });
  assert.equal(result.ok, true);
  assert.equal(result.playlistURL, 'spotify:track:h1');
});

test('tick refreshes expired access tokens once', async () => {
  const game = createGame();
  game.expiresAt = Date.now() - 1;

  await game.tick();

  assert.equal(game.spotify.calls.refreshed, 1);
  assert.equal(game.accessToken, 'new-access-token');
  assert.equal(game.refreshToken, 'new-refresh-token');
  assert.ok(game.expiresAt > Date.now());
});

test('tick kills the game when the refresh token is gone', async () => {
  const game = createGame({ refreshToken: '' });
  game.expiresAt = Date.now() - 1;

  await game.tick();

  assert.equal(game.kill, true);
});

test('restored games refresh their access token on the next tick', async () => {
  const spotify = createFakeSpotify();
  const original = createGame({ spotify });
  const restored = Game.fromJSON(JSON.parse(JSON.stringify(original)), { spotify });

  assert.ok(restored.expiresAt <= Date.now(), 'saved tokens are treated as needing a refresh');

  await restored.tick();
  assert.equal(spotify.calls.refreshed, 1);
  assert.equal(restored.accessToken, 'new-access-token');
});

test('serialisation round-trips the persisted game state', () => {
  const game = createGame();
  game.addPlayerToGame('guest');
  game.addSong(song('g1', 'guest'));

  const serialised = JSON.parse(JSON.stringify(game));
  assert.equal('spotify' in serialised, false);
  assert.equal('countCounts' in serialised, false);

  const restored = Game.fromJSON(serialised);

  assert.equal(restored.gameid, game.gameid);
  assert.equal(restored.hostName, game.hostName);
  assert.equal(restored.fullyExpires, game.fullyExpires);
  assert.deepEqual(restored.players, game.players);
  assert.deepEqual(restored.playlist, game.playlist);
});