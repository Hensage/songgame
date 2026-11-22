import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { Game } from '../src/game.js';
import { GameStore } from '../src/gameStore.js';

const silentLogger = { log() {}, warn() {}, error() {} };

function makeGame(overrides = {}) {
  return new Game({
    hostPlayerID: 'host',
    hostId: 'spotify-user',
    hostName: 'Host',
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
    songsPerPerson: 3,
    era: '1950-1999',
    genres: [],
    ...overrides,
  });
}

test('save and load round-trips games through the JSON file', async (t) => {
  const tempDir = await mkdtemp(path.join(tmpdir(), 'songgame-store-'));
  const gamesFilePath = path.join(tempDir, 'nested', 'games.json');
  t.after(() => rm(tempDir, { recursive: true, force: true }));

  const store = new GameStore({ gamesFilePath, logger: silentLogger });
  await store.load();

  const game = makeGame();
  store.add(game);
  await store.save();
  await store.flush();

  const reloaded = new GameStore({ gamesFilePath, logger: silentLogger });
  await reloaded.load();

  assert.equal(reloaded.all().length, 1);
  assert.equal(reloaded.all()[0].gameid, game.gameid);
  assert.deepEqual(reloaded.all()[0].players, ['host']);
});

test('sweep ticks games and removes killed or expired ones', async (t) => {
  const tempDir = await mkdtemp(path.join(tmpdir(), 'songgame-sweep-'));
  const gamesFilePath = path.join(tempDir, 'games.json');
  t.after(() => rm(tempDir, { recursive: true, force: true }));

  const store = new GameStore({ gamesFilePath, logger: silentLogger });
  const ticked = [];
  const now = Date.now();

  store.games = [
    {
      gameid: 'alive',
      kill: false,
      fullyExpires: now + 60_000,
      tick: async () => ticked.push('alive'),
    },
    {
      gameid: 'killed',
      kill: true,
      fullyExpires: now + 60_000,
      tick: async () => ticked.push('killed'),
    },
    {
      gameid: 'expired',
      kill: false,
      fullyExpires: now - 1,
      tick: async () => ticked.push('expired'),
    },
  ];

  store.sweep();

  assert.deepEqual(
    store.games.map((game) => game.gameid),
    ['alive'],
  );
  assert.deepEqual(ticked, ['alive', 'killed', 'expired']);

  await store.flush();
});