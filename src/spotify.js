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
  parts.push(quote(query));
  return parts.join(' ');
}

export class SpotifyClient {
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

  async getCurrentUser(accessToken) {
    const profile = await this.#apiRequest('/me', { accessToken });
    return { id: profile.id, displayName: profile.display_name || profile.id };
  }

  async searchTracks({ accessToken, query, era, genre }) {
    const params = new URLSearchParams({
      q: buildSearchQuery({ query, era, genre }),
      type: 'track',
      limit: String(SEARCH_LIMIT),
    });
    const data = await this.#apiRequest(`/search?${params}`, { accessToken });
    return data.tracks?.items ?? [];
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