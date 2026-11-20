import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSearchQuery, SpotifyClient, SpotifyError } from '../src/spotify.js';

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
    client.searchTracks({ accessToken: 'bad', query: 'love', era: '1950-1999', genre: '' }),
    (error) => error instanceof SpotifyError && error.status === 401 && /Invalid access token/.test(error.message),
  );
});