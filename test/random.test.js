import assert from 'node:assert/strict';
import test from 'node:test';
import { makeId, shuffleSongs } from '../src/random.js';

test('makeId returns an ID of the requested length using alphanumerics', () => {
  const id = makeId(16);
  assert.equal(id.length, 16);
  assert.match(id, /^[A-Za-z0-9]+$/);
  assert.notEqual(makeId(16), makeId(16));
});

test('shuffleSongs keeps every eligible song once and respects per-player caps', () => {
  const players = ['alice', 'bob', 'carol'];
  const songs = [
    { id: 'a1', playerID: 'alice' },
    { id: 'a2', playerID: 'alice' },
    { id: 'a3', playerID: 'alice' },
    { id: 'b1', playerID: 'bob' },
    { id: 'b2', playerID: 'bob' },
    { id: 'c1', playerID: 'carol' },
  ];
  const original = structuredClone(songs);

  for (let run = 0; run < 50; run += 1) {
    const shuffled = shuffleSongs(songs, players, 2);
    assert.equal(shuffled.length, 5);
    assert.equal(new Set(shuffled.map((song) => song.id)).size, 5);

    for (const player of players) {
      const count = shuffled.filter((song) => song.playerID === player).length;
      assert.ok(count <= 2, `${player} received ${count} songs`);
    }
  }

  assert.deepEqual(songs, original, 'input array must not be mutated');
});

test('shuffleSongs ignores songs from players who are not in the game', () => {
  const songs = [
    { id: 'a1', playerID: 'alice' },
    { id: 'x1', playerID: 'stranger' },
  ];

  assert.deepEqual(shuffleSongs(songs, ['alice'], 5).map((song) => song.id), ['a1']);
});

test('shuffleSongs handles empty inputs', () => {
  assert.deepEqual(shuffleSongs([], [], 3), []);
  assert.deepEqual(shuffleSongs([{ id: 'a1', playerID: 'alice' }], [], 3), []);
});