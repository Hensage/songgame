import assert from 'node:assert/strict';
import test from 'node:test';
import { createGenreLookup, stubGenresFor } from '../src/genres.js';

const silentLogger = { warn() {} };
const song = (artistId) => ({ id: 'song', artists: [{ id: artistId, name: 'Artist' }, { id: 'other1', name: 'Second' }] });

test('looks up the first artist and remembers the answer', async () => {
  const calls = [];
  const spotify = {
    async getArtistGenres(args) {
      calls.push(args);
      return ['rock', 'classic rock'];
    },
  };
  const lookup = createGenreLookup({ spotify, logger: silentLogger });

  assert.deepEqual(await lookup(song('abc123'), 'token'), ['rock', 'classic rock']);
  assert.deepEqual(await lookup(song('abc123'), 'token'), ['rock', 'classic rock']);
  assert.deepEqual(calls, [{ accessToken: 'token', artistId: 'abc123' }]);
});

test('ignores songs without a usable artist id', async () => {
  let called = false;
  const lookup = createGenreLookup({
    spotify: { async getArtistGenres() { called = true; return ['x']; } },
    logger: silentLogger,
  });

  assert.deepEqual(await lookup({ id: 'a' }, 't'), []);
  assert.deepEqual(await lookup({ id: 'a', artists: [{ name: 'No id' }] }, 't'), []);
  assert.deepEqual(await lookup(song('../../evil'), 't'), []);
  assert.deepEqual(await lookup(song('a'.repeat(41)), 't'), []);
  assert.equal(called, false);
});

test('a failed lookup gives no genres and is tried again next time', async () => {
  let attempts = 0;
  const warnings = [];
  const lookup = createGenreLookup({
    spotify: {
      async getArtistGenres() {
        attempts += 1;
        if (attempts === 1) throw new Error('Spotify is down');
        return ['pop'];
      },
    },
    logger: { warn: (message) => warnings.push(message) },
  });

  assert.deepEqual(await lookup(song('abc123'), 't'), []);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /abc123/);
  assert.deepEqual(await lookup(song('abc123'), 't'), ['pop']);
  assert.equal(attempts, 2);
});

test('stub mode makes up repeatable genres without calling Spotify', async () => {
  const lookup = createGenreLookup({ spotify: null, stub: true, logger: silentLogger });
  const genres = await lookup(song('0LcJLqbBmaGUft1e9Mm8HV'), 't');

  assert.ok(genres.length >= 1);
  assert.deepEqual(genres, stubGenresFor('0LcJLqbBmaGUft1e9Mm8HV'));
  assert.equal(new Set(genres).size, genres.length, 'no duplicates');
});
