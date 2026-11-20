import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSearchQuery, interleaveTracks, SpotifyClient, SpotifyError } from '../src/spotify.js';

const clientOptions = {
  clientId: 'client-id',
  clientSecret: 'client-secret',
  redirectUri: 'http://localhost:3000/callback',
};

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

test('buildSearchQuery combines era, genre and the free-text query', () => {
  assert.equal(
    buildSearchQuery({ query: 'Daft Punk', era: '1990-1999', genre: 'rock' }),
    'year:1990-1999 genre:"rock" "Daft Punk"',
  );
  assert.equal(buildSearchQuery({ query: 'love', era: '1950-1999', genre: '' }), 'year:1950-1999 "love"');
});

test('buildSearchQuery works with filters only', () => {
  assert.equal(buildSearchQuery({ era: '1990-1999', genre: 'rock' }), 'year:1990-1999 genre:"rock"');
});

test('countTracks searches with an app token and returns the total', async () => {
  const calls = [];
  const client = new SpotifyClient({
    ...clientOptions,
    fetchImpl: async (url, init) => {
      calls.push({ url: String(url), init });
      if (String(url).endsWith('/api/token')) {
        return jsonResponse({ access_token: 'app-token', expires_in: 3600 });
      }
      return jsonResponse({ tracks: { total: 1234, items: [] } });
    },
  });

  assert.equal(await client.countTracks({ era: '1990-1999', genres: ['rock'] }), 1234);
  assert.equal(await client.countTracks({ era: '1990-1999', genres: ['pop'] }), 1234);

  const tokenCalls = calls.filter((call) => call.url.endsWith('/api/token'));
  assert.equal(tokenCalls.length, 1, 'the app token is reused');
  assert.match(String(tokenCalls[0].init.body), /grant_type=client_credentials/);

  const search = new URL(calls.find((call) => call.url.includes('/search')).url);
  assert.equal(search.searchParams.get('q'), 'year:1990-1999 genre:"rock"');
  assert.equal(search.searchParams.get('limit'), '1');
});

test('countTracks adds up the totals of several genres', async () => {
  const totals = { rock: 100, pop: 50 };
  const client = new SpotifyClient({
    ...clientOptions,
    fetchImpl: async (url) => {
      if (String(url).endsWith('/api/token')) return jsonResponse({ access_token: 't', expires_in: 3600 });
      const q = new URL(String(url)).searchParams.get('q');
      const genre = /genre:"([^"]+)"/.exec(q)?.[1];
      return jsonResponse({ tracks: { total: totals[genre] ?? 0, items: [] } });
    },
  });

  assert.equal(await client.countTracks({ era: '1990-1999', genres: ['rock', 'pop'] }), 150);
});

test('searchTracks matches any selected genre by searching once per genre', async () => {
  const queries = [];
  const track = (id) => ({ id, uri: `spotify:track:${id}` });
  const client = new SpotifyClient({
    ...clientOptions,
    fetchImpl: async (url) => {
      const q = new URL(String(url)).searchParams.get('q');
      queries.push(q);
      const items = q.includes('genre:"rock"') ? [track('r1'), track('r2'), track('shared')] : [track('p1'), track('shared')];
      return jsonResponse({ tracks: { total: items.length, items } });
    },
  });

  const results = await client.searchTracks({
    accessToken: 'token',
    query: 'love',
    era: '1990-1999',
    genres: ['rock', 'pop'],
  });

  assert.equal(queries.length, 2);
  assert.ok(queries.some((q) => q === 'year:1990-1999 genre:"rock" "love"'));
  assert.ok(queries.some((q) => q === 'year:1990-1999 genre:"pop" "love"'));
  assert.deepEqual(
    results.map((item) => item.id),
    ['r1', 'p1', 'r2', 'shared'],
    'results alternate between genres and drop repeats',
  );
});

test('searchTracks without genres makes a single unfiltered search', async () => {
  const queries = [];
  const client = new SpotifyClient({
    ...clientOptions,
    fetchImpl: async (url) => {
      queries.push(new URL(String(url)).searchParams.get('q'));
      return jsonResponse({ tracks: { total: 0, items: [] } });
    },
  });

  assert.deepEqual(await client.searchTracks({ accessToken: 't', query: 'love', era: '1950-1999', genres: [] }), []);
  assert.deepEqual(queries, ['year:1950-1999 "love"']);
});

test('interleaveTracks alternates lists, drops repeats and respects the limit', () => {
  const tracks = (...ids) => ids.map((id) => ({ id }));
  const merged = interleaveTracks([tracks('a', 'b', 'c'), tracks('x', 'a', 'y')], 4);

  assert.deepEqual(merged.map((item) => item.id), ['a', 'x', 'b', 'c']);
  assert.deepEqual(interleaveTracks([[], []], 5), []);
});

test('getArtistGenres reads the artist and lower-cases the genres', async () => {
  const calls = [];
  const client = new SpotifyClient({
    ...clientOptions,
    fetchImpl: async (url, init) => {
      calls.push({ url: String(url), init });
      return jsonResponse({ id: 'abc123', genres: ['Dance Pop', 'ROCK'] });
    },
  });

  assert.deepEqual(await client.getArtistGenres({ accessToken: 'token', artistId: 'abc123' }), ['dance pop', 'rock']);
  assert.equal(calls[0].url, 'https://api.spotify.com/v1/artists/abc123');
  assert.equal(calls[0].init.headers.Authorization, 'Bearer token');
});

test('getArtistGenres copes with an artist that has no genres field', async () => {
  const client = new SpotifyClient({ ...clientOptions, fetchImpl: async () => jsonResponse({ id: 'abc123' }) });

  assert.deepEqual(await client.getArtistGenres({ accessToken: 't', artistId: 'abc123' }), []);
});

test('buildSearchQuery strips quotes and non-numeric era characters', () => {
  assert.equal(
    buildSearchQuery({ query: 'say "hello"', era: '19x90', genre: 'pop"' }),
    'year:1990 genre:"pop" "say hello"',
  );
});

test('createPlaylist posts to /me/playlists with the access token', async () => {
  const calls = [];
  const client = new SpotifyClient({
    ...clientOptions,
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return jsonResponse({ id: 'playlist-1', external_urls: { spotify: 'https://open.spotify.com/playlist/playlist-1' } });
    },
  });

  const playlist = await client.createPlaylist({
    accessToken: 'access-token',
    name: 'Song Game',
    description: 'A party game',
  });

  assert.equal(playlist.id, 'playlist-1');
  assert.equal(playlist.url, 'https://open.spotify.com/playlist/playlist-1');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://api.spotify.com/v1/me/playlists');
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(calls[0].init.headers.Authorization, 'Bearer access-token');
  assert.deepEqual(JSON.parse(calls[0].init.body), {
    name: 'Song Game',
    description: 'A party game',
    public: true,
  });
});

test('addTracksToPlaylist sends URIs in the body and skips empty lists', async () => {
  const calls = [];
  const client = new SpotifyClient({
    ...clientOptions,
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return jsonResponse({ snapshot_id: 'snapshot' });
    },
  });

  await client.addTracksToPlaylist({ accessToken: 'token', playlistId: 'playlist-1', uris: [] });
  assert.equal(calls.length, 0);

  await client.addTracksToPlaylist({
    accessToken: 'token',
    playlistId: 'playlist-1',
    uris: ['spotify:track:a', 'spotify:track:b'],
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://api.spotify.com/v1/playlists/playlist-1/tracks');
  assert.deepEqual(JSON.parse(calls[0].init.body), { uris: ['spotify:track:a', 'spotify:track:b'] });
});

test('exchangeCode sends credentials using Basic auth', async () => {
  const calls = [];
  const client = new SpotifyClient({
    ...clientOptions,
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return jsonResponse({ access_token: 'new-access', refresh_token: 'new-refresh' });
    },
  });

  const tokens = await client.exchangeCode('auth-code');

  assert.deepEqual(tokens, { accessToken: 'new-access', refreshToken: 'new-refresh' });
  assert.equal(calls[0].url, 'https://accounts.spotify.com/api/token');
  assert.equal(
    calls[0].init.headers.Authorization,
    `Basic ${Buffer.from('client-id:client-secret').toString('base64')}`,
  );

  const body = new URLSearchParams(calls[0].init.body);
  assert.equal(body.get('grant_type'), 'authorization_code');
  assert.equal(body.get('code'), 'auth-code');
  assert.equal(body.get('redirect_uri'), clientOptions.redirectUri);
});

test('Spotify errors carry the status and message', async () => {
  const client = new SpotifyClient({
    ...clientOptions,
    fetchImpl: async () => jsonResponse({ error: { status: 401, message: 'Invalid access token' } }, 401),
  });

  await assert.rejects(
    client.searchTracks({ accessToken: 'bad', query: 'love', era: '1950-1999', genres: [] }),
    (error) => error instanceof SpotifyError && error.status === 401 && /Invalid access token/.test(error.message),
  );
});