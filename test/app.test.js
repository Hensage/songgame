import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { loadConfig } from '../src/config.js';
import { createServices } from '../src/services.js';

const silentLogger = { log() {}, warn() {}, error() {} };

function song(number) {
  return {
    id: `song-${number}`,
    uri: `spotify:track:song-${number}`,
    name: `Song ${number}`,
    artists: [{ name: 'Artist' }],
    album: { images: [{ url: 'https://example.com/art.jpg' }] },
    explicit: number % 2 === 0,
  };
}

test('stub mode game flow', async (t) => {
  const tempDir = await mkdtemp(path.join(tmpdir(), 'songgame-'));
  const config = loadConfig({
    stub: true,
    gamesFilePath: path.join(tempDir, 'games.json'),
    redirectUri: 'http://localhost/callback',
    port: 0,
  });

  const { app, store } = createServices(config, { logger: silentLogger });
  await store.load();

  const server = await new Promise((resolve) => {
    const listener = app.listen(0, () => resolve(listener));
  });
  const baseURL = `http://127.0.0.1:${server.address().port}`;

  const api = (pathname, params = {}) => {
    const query = new URLSearchParams(params).toString();
    return `${baseURL}${pathname}${query ? `?${query}` : ''}`;
  };
  const post = (pathname, params) => fetch(api(pathname, params), { method: 'POST' });
  const addSong = (playerID, value) =>
    fetch(api('/add', { playerID }), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(value),
    });
  const json = async (pathname, params) => (await fetch(api(pathname, params))).json();

  t.after(async () => {
    store.stopSweep();
    await store.flush();
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    await rm(tempDir, { recursive: true, force: true });
  });

  async function hostGame(playerID, params = { songCount: '3', era: '1990-1999', genre: '' }) {
    const login = await fetch(api('/login', { playerID, ...params }), {
      redirect: 'manual',
    });
    assert.equal(login.status, 302);

    const state = new URL(login.headers.get('location')).searchParams.get('state');
    assert.ok(state);

    const callback = await fetch(api('/callback', { state }), { redirect: 'manual' });
    assert.equal(callback.status, 302);

    return store.findByPlayerId(playerID);
  }

  let game;

  await t.test('creates a game through the stub login flow', async () => {
    game = await hostGame('host-1');

    assert.ok(game);
    assert.equal(game.hostName, 'STUBACCOUNT');
    assert.equal(game.songsPerPerson, 3);
    assert.equal(game.era, '1990-1999');
    assert.equal(game.isHost('host-1'), true);
  });

  await t.test('persists games without in-memory fields', async () => {
    store.save();
    await store.flush();

    const saved = JSON.parse(await readFile(config.gamesFilePath, 'utf8'));
    assert.equal(saved.length, 1);
    assert.equal(saved[0].gameid, game.gameid);
    assert.equal('countCounts' in saved[0], false);
    assert.equal('spotify' in saved[0], false);
  });

  await t.test('lobby responses only expose public game details', async () => {
    const lobby = await json('/getGames', { playerID: 'host-1' });

    assert.ok(lobby.yourGame);
    assert.deepEqual(Object.keys(lobby.yourGame).sort(), [
      'era',
      'gameid',
      'genres',
      'hostName',
      'playerCount',
      'songsPerPerson',
    ]);
    assert.equal(lobby.otherGames.length, 0);

    const serialised = JSON.stringify(lobby);
    assert.equal(serialised.includes('TOKEN'), false);
    assert.equal(serialised.includes('hostid'), false);
  });

  await t.test('lets another player join and load game info', async () => {
    const join = await post('/joinGame', { playerID: 'guest-1', gameID: game.gameid });
    assert.equal(join.status, 200);

    assert.deepEqual(await json('/loadinfo', { playerID: 'guest-1' }), {
      validGame: true,
      hostName: 'STUBACCOUNT',
      isPlayerHost: false,
      songsPerPerson: 3,
      era: '1990-1999',
      genres: [],
    });
  });

  await t.test('enforces the song limit and duplicate songs', async () => {
    assert.equal((await addSong('guest-1', song(1))).status, 200);
    assert.equal(await (await addSong('guest-1', song(1))).text(), 'This song is already in the playlist');
    assert.equal((await addSong('guest-1', song(2))).status, 200);
    assert.equal((await addSong('guest-1', song(3))).status, 200);

    const overLimit = await addSong('guest-1', song(4));
    assert.equal(overLimit.status, 409);
    assert.equal(await overLimit.text(), 'You have already added all your songs');
  });

  await t.test('updates show only the requesting player songs and fresh counts', async () => {
    await game.tick();

    const state = await json('/update', { playerID: 'guest-1' });
    assert.equal(state.validGame, true);
    assert.equal(state.isPlaying, true);
    assert.equal(state.playerCount, 2);
    assert.equal(state.count, 3);
    assert.deepEqual(state.items.map((item) => item.id), ['song-1', 'song-2', 'song-3']);
    assert.equal(state.items.find((item) => item.id === 'song-2').explicit, true);
    assert.equal(state.items.find((item) => item.id === 'song-1').explicit, false);
    assert.deepEqual(state.countCounts, [1, 0, 0, 1]);
  });

  await t.test('serves stub search results', async () => {
    const results = await json('/search', { playerID: 'guest-1', query: 'love' });

    assert.ok(Array.isArray(results));
    assert.ok(results.length > 0);
    assert.ok(results.some((track) => track.explicit === true));
    assert.ok(results[0].id);
    assert.ok(results[0].uri);
  });

  await t.test('only the host can submit the playlist', async () => {
    const forbidden = await post('/submit', { playerID: 'guest-1' });
    assert.equal(forbidden.status, 403);
    assert.equal(await forbidden.text(), 'not host');
  });

  let playlistLink;

  await t.test('submitting clears the playlist and records the result', async () => {
    const response = await post('/submit', { playerID: 'host-1' });
    assert.equal(response.status, 200);

    playlistLink = await response.text();
    const uris = playlistLink.split(',');
    assert.equal(uris.length, 3);
    assert.deepEqual(
      new Set(uris),
      new Set(['spotify:track:song-1', 'spotify:track:song-2', 'spotify:track:song-3']),
    );
    assert.deepEqual(game.playlist, []);
  });

  await t.test('finished games disappear from the lobby but stay readable in game', async () => {
    const state = await json('/update', { playerID: 'guest-1' });
    assert.equal(state.isPlaying, false);
    assert.equal(state.playlistURL, playlistLink);
    assert.deepEqual(state.items, []);

    const lobby = await json('/getGames', { playerID: 'guest-1' });
    assert.equal(lobby.otherGames.length, 0);
  });

  await t.test('players can leave without closing the game for the host', async () => {
    assert.equal((await post('/closeGame', { playerID: 'guest-1' })).status, 200);
    assert.deepEqual(await json('/update', { playerID: 'guest-1' }), { validGame: false });
    assert.equal((await json('/update', { playerID: 'host-1' })).validGame, true);
  });

  await t.test('the host can close the game for everyone', async () => {
    assert.equal((await post('/closeGame', { playerID: 'host-1' })).status, 200);
    assert.deepEqual(await json('/getGames', { playerID: 'guest-1' }), { otherGames: [] });
  });

  await t.test('rejects malformed and unknown requests', async () => {
    assert.equal((await fetch(api('/update'))).status, 400);
    assert.equal((await fetch(api('/callback', { state: 'unknown' }))).status, 400);
    assert.equal((await addSong('nobody', song(9))).status, 404);
    assert.equal(
      (await fetch(api('/add', { playerID: 'host-1' }), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'missing id and uri' }),
      })).status,
      400,
    );
  });

  await t.test('reports a match count for a genre and era before login', async () => {
    const any = await json('/genreCheck', { era: '1990-1999' });
    const rock = await json('/genreCheck', { genre: ' Rock ', era: '1990-1999' });

    assert.equal(typeof any.total, 'number');
    assert.ok(any.total > rock.total);
    assert.deepEqual(await json('/genreCheck', { genre: 'rock', era: '1990-1999' }), rock);
    assert.equal((await fetch(api('/genreCheck', { genre: 'rock', era: 'garbage' }))).status, 200);
  });

  await t.test('hosts a game with several genres, de-duplicated and capped', async () => {
    const params = new URLSearchParams({ playerID: 'host-3', songCount: '2', era: '1990-1999' });
    for (const genre of ['Rock', 'pop', 'rock ', 'jazz', 'funk', 'soul', 'punk']) params.append('genre', genre);

    const login = await fetch(`${baseURL}/login?${params}`, { redirect: 'manual' });
    const state = new URL(login.headers.get('location')).searchParams.get('state');
    await fetch(api('/callback', { state }), { redirect: 'manual' });

    const info = await json('/loadinfo', { playerID: 'host-3' });
    assert.deepEqual(info.genres, ['rock', 'pop', 'jazz', 'funk', 'soul']);

    const params2 = new URLSearchParams({ era: '1990-1999' });
    params2.append('genre', 'rock');
    params2.append('genre', 'pop');
    const several = await (await fetch(`${baseURL}/genreCheck?${params2}`)).json();
    const rockOnly = await json('/genreCheck', { genre: 'rock', era: '1990-1999' });
    assert.ok(several.total > rockOnly.total, 'counts add up across genres');

    await post('/closeGame', { playerID: 'host-3' });
  });

  await t.test('records artist genres on added songs and counts them in updates', async () => {
    await hostGame('host-4', { songCount: '3', era: '1990-1999' });

    const tracks = await json('/search', { playerID: 'host-4', query: 'love' });
    const abba = tracks.find((track) => track.artists[0].name === 'ABBA');
    const bowie = tracks.find((track) => track.artists[0].name === 'David Bowie');
    assert.equal((await addSong('host-4', abba)).status, 200);
    assert.equal((await addSong('host-4', bowie)).status, 200);

    const stored = store.findByPlayerId('host-4').playlist;
    assert.ok(stored.every((entry) => entry.genres.length > 0), 'each song got its artist genres');

    const state = await json('/update', { playerID: 'host-4' });
    assert.ok(state.genreCounts.length > 0);
    assert.ok(state.genreCounts.every((entry) => entry.label !== 'No genre listed'));
    const tags = stored.reduce((total, entry) => total + new Set(entry.genres).size, 0);
    assert.equal(
      state.genreCounts.reduce((total, entry) => total + entry.value, 0),
      tags,
      'every genre of every song is counted once',
    );

    // A song whose artist id isn't a valid Spotify id is still added, just without genres.
    const odd = { ...song(9), artists: [{ id: '../evil', name: 'Odd' }] };
    assert.equal((await addSong('host-4', odd)).status, 200);
    assert.deepEqual(store.findByPlayerId('host-4').playlist.at(-1).genres, []);
    const after = await json('/update', { playerID: 'host-4' });
    assert.equal(after.genreCounts.find((entry) => entry.label === 'No genre listed').value, 1);

    await post('/closeGame', { playerID: 'host-4' });
  });

  await t.test('defaults the era range to the current year', async () => {
    const newGame = await hostGame('host-2', { songCount: '1' });

    assert.equal(newGame.era, `1950-${new Date().getFullYear()}`);
    assert.equal(newGame.songsPerPerson, 1);
    assert.deepEqual(newGame.genres, []);

    await post('/closeGame', { playerID: 'host-2' });
  });
});