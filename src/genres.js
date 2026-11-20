// Spotify puts genres on artists, not tracks, so a song's genres are the genres of its
// primary artist. This looks them up when a song is added and caches them per artist.

const ARTIST_ID = /^[A-Za-z0-9]{1,40}$/;
const CACHE_LIMIT = 1000;
const STUB_GENRES = ['pop', 'rock', 'hip hop', 'electronic', 'jazz', 'country', 'soul', 'indie rock'];

/** Made-up but repeatable genres for an artist, so stub mode has something to chart. */
export function stubGenresFor(artistId) {
  const seed = [...artistId].reduce((sum, character) => sum + character.charCodeAt(0), 0);
  const picks = [seed % STUB_GENRES.length, (seed * 7 + 3) % STUB_GENRES.length];
  if (seed % 3 === 0) picks.push((seed * 5 + 1) % STUB_GENRES.length);
  return [...new Set(picks)].map((index) => STUB_GENRES[index]);
}

/**
 * Returns `lookup(song, accessToken)`, resolving to the genres of the song's first artist.
 * It never throws: a missing artist id or a failed Spotify call gives an empty list, so a
 * song can always be added. Failures are not cached, so they are retried next time.
 */
export function createGenreLookup({ spotify, stub = false, logger = console }) {
  const cache = new Map();

  return async function lookup(song, accessToken) {
    const artistId = song?.artists?.[0]?.id;
    if (typeof artistId !== 'string' || !ARTIST_ID.test(artistId)) return [];
    if (cache.has(artistId)) return cache.get(artistId);

    let genres;
    try {
      genres = stub ? stubGenresFor(artistId) : await spotify.getArtistGenres({ accessToken, artistId });
    } catch (error) {
      logger.warn(`Could not load genres for artist ${artistId}: ${error.message}`);
      return [];
    }

    if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value);
    cache.set(artistId, genres);
    return genres;
  };
}
