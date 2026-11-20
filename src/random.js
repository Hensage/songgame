import { randomInt } from 'node:crypto';

const ID_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

export function makeId(length = 16) {
  let id = '';
  for (let index = 0; index < length; index += 1) {
    id += ID_ALPHABET[randomInt(ID_ALPHABET.length)];
  }
  return id;
}

function weightedRandom(probabilities) {
  const random = Math.random();
  let sum = 0;
  for (let index = 0; index < probabilities.length; index += 1) {
    sum += probabilities[index];
    if (random < sum) return index;
  }
  return probabilities.length - 1;
}

/**
 * Interleaves everyone's songs so the final playlist does not play one
 * person's picks back to back. Players with more remaining songs are more
 * likely to be picked (softmax over remaining quotas).
 *
 * Returns a new array; the input is not modified.
 */
export function shuffleSongs(songs, players, maxSongsPerPlayer) {
  const pool = [...songs];
  const quotas = players.map((player) => {
    const songCount = pool.filter((song) => song.playerID === player).length;
    return Math.min(songCount, maxSongsPerPlayer);
  });
  const totalToPick = quotas.reduce((sum, quota) => sum + quota, 0);
  const result = [];

  while (result.length < totalToPick) {
    const weights = quotas.map((quota) => (quota > 0 ? Math.exp(quota) : 0));
    const weightSum = weights.reduce((sum, weight) => sum + weight, 0);
    if (weightSum <= 0) break;

    const playerIndex = weightedRandom(weights.map((weight) => weight / weightSum));
    const candidates = pool.filter((song) => song.playerID === players[playerIndex]);

    if (candidates.length === 0) {
      quotas[playerIndex] = 0;
      continue;
    }

    quotas[playerIndex] -= 1;
    const song = candidates[randomInt(candidates.length)];
    result.push(song);
    pool.splice(pool.indexOf(song), 1);
  }

  return result;
}