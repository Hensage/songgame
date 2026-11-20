const API_BASE_URL = 'https://api.spotify.com/v1';
const ACCOUNTS_BASE_URL = 'https://accounts.spotify.com';
const SEARCH_LIMIT = 10;

export const SPOTIFY_SCOPES = [
  'user-read-email',
  'user-read-private',
  'playlist-read-private',
  'playlist-modify-public',
  'playlist-modify-private',
].join(' ');

export class SpotifyError extends Error {
  constructor(message, { status, body } = {}) {
    super(message);
    this.name = 'SpotifyError';
    this.status = status;
    this.body = body;
  }
}

function quote(value) {
  return `"${String(value).replace(/["\\]/g, '')}"`;
}

export function buildSearchQuery({ query, era, genre }) {
  const parts = [];
  const yearRange = String(era ?? '').replace(/[^0-9-]/g, '');
  if (yearRange) parts.push(`year:${yearRange}`);
  if (genre) parts.push(`genre:${quote(genre)}`);
  const text = String(query ?? '').trim();
  if (text) parts.push(quote(text));
  return parts.join(' ');
}

/** Takes one track from each list in turn, skipping repeats, until `limit` are chosen. */
export function interleaveTracks(lists, limit) {
  const merged = [];
  const seen = new Set();

  for (let index = 0; merged.length < limit && lists.some((list) => index < list.length); index += 1) {
    for (const list of lists) {
      const track = list[index];
      if (!track || seen.has(track.id)) continue;

      seen.add(track.id);
      merged.push(track);
      if (merged.length >= limit) break;
    }
  }

  return merged;
}

const APP_TOKEN_MARGIN_MS = 30 * 1000;

export class SpotifyClient {
  #appToken = null;

  constructor({ clientId, clientSecret, redirectUri, fetchImpl = globalThis.fetch }) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.redirectUri = redirectUri;
    this.fetch = fetchImpl;
  }

  buildAuthorizeUrl(state) {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      scope: SPOTIFY_SCOPES,
      redirect_uri: this.redirectUri,
      state,
    });
    return `${ACCOUNTS_BASE_URL}/authorize?${params}`;
  }

  async exchangeCode(code) {
    const data = await this.#requestTokens({
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.redirectUri,
    });
    return { accessToken: data.access_token, refreshToken: data.refresh_token };
  }

  async refreshAccessToken(refreshToken) {
    const data = await this.#requestTokens({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    });
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? refreshToken,
    };
  }

  /**
   * A token for the app itself (client credentials), for requests made before
   * anyone has signed in. It can search but cannot touch a user's account.
   */
  async getAppToken() {
    if (this.#appToken && this.#appToken.expiresAt - APP_TOKEN_MARGIN_MS > Date.now()) {
      return this.#appToken.value;
    }

    const data = await this.#requestTokens({ grant_type: 'client_credentials' });
    this.#appToken = { value: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
    return this.#appToken.value;
  }

  /**
   * How many tracks match the era and any of the genres, according to Spotify.
   * Tracks in more than one selected genre are counted once per genre, so with
   * several genres this is an upper bound.
   */
  async countTracks({ era, genres = [] }) {
    const accessToken = await this.getAppToken();
    const tracks = await Promise.all(
      (genres.length > 0 ? genres : ['']).map((genre) => this.#searchOnce({ accessToken, era, genre, limit: 1 })),
    );
    return tracks.reduce((total, result) => total + (result?.total ?? 0), 0);
  }

  /** The genres Spotify lists for an artist, lower-case. Genres belong to artists, not tracks. */
  async getArtistGenres({ accessToken, artistId }) {
    const artist = await this.#apiRequest(`/artists/${encodeURIComponent(artistId)}`, { accessToken });
    return Array.isArray(artist.genres) ? artist.genres.map((genre) => String(genre).toLowerCase()) : [];
  }

  async getCurrentUser(accessToken) {
    const profile = await this.#apiRequest('/me', { accessToken });
    return { id: profile.id, displayName: profile.display_name || profile.id };
  }

  /**
   * Finds tracks that match the era and ANY of the genres. Spotify's genre filter
   * takes one genre, so this searches once per genre and mixes the results.
   */
  async searchTracks({ accessToken, query, era, genres = [] }) {
    const results = await Promise.all(
      (genres.length > 0 ? genres : ['']).map((genre) =>
        this.#searchOnce({ accessToken, query, era, genre, limit: SEARCH_LIMIT }),
      ),
    );
    return interleaveTracks(
      results.map((result) => result?.items ?? []),
      SEARCH_LIMIT,
    );
  }

  async #searchOnce({ accessToken, query, era, genre, limit }) {
    const params = new URLSearchParams({
      q: buildSearchQuery({ query, era, genre }),
      type: 'track',
      limit: String(limit),
    });
    const data = await this.#apiRequest(`/search?${params}`, { accessToken });
    return data.tracks;
  }

  async createPlaylist({ accessToken, name, description }) {
    const data = await this.#apiRequest('/me/playlists', {
      accessToken,
      method: 'POST',
      body: { name, description, public: true },
    });
    return { id: data.id, url: data.external_urls?.spotify ?? '' };
  }

  async addTracksToPlaylist({ accessToken, playlistId, uris }) {
    if (uris.length === 0) return;
    await this.#apiRequest(`/playlists/${encodeURIComponent(playlistId)}/tracks`, {
      accessToken,
      method: 'POST',
      body: { uris },
    });
  }

  async #requestTokens(form) {
    const response = await this.fetch(`${ACCOUNTS_BASE_URL}/api/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`,
      },
      body: new URLSearchParams(form).toString(),
    });
    return this.#parseResponse(response);
  }

  async #apiRequest(pathname, { accessToken, method = 'GET', body } = {}) {
    const headers = { Authorization: `Bearer ${accessToken}` };
    if (body !== undefined) headers['Content-Type'] = 'application/json';

    const response = await this.fetch(`${API_BASE_URL}${pathname}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return this.#parseResponse(response);
  }

  async #parseResponse(response) {
    const text = await response.text();
    let data = null;

    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = { raw: text };
      }
    }

    if (!response.ok) {
      const message = data?.error?.message ?? data?.error_description ?? response.statusText;
      throw new SpotifyError(`Spotify request failed (${response.status}): ${message}`, {
        status: response.status,
        body: data,
      });
    }

    return data;
  }
}