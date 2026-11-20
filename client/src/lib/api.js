// Array values become repeated keys, e.g. { genre: ['rock', 'pop'] } -> genre=rock&genre=pop.
function toQuery(params) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    for (const item of Array.isArray(value) ? value : [value]) query.append(key, item);
  }
  return query.toString();
}

const request = (path, params, options) => fetch(`${path}?${toQuery(params)}`, options);

/** Thin wrappers over the server's endpoints, scoped to one player. */
export function createApi(playerID) {
  const post = (path, params = {}) => request(path, { playerID, ...params }, { method: 'POST' });

  return {
    loadInfo: async () => (await request('/loadinfo', { playerID })).json(),
    getUpdate: async () => (await request('/update', { playerID })).json(),

    /** How many songs Spotify has for any of the genres in an era; works before anyone has signed in. */
    async checkGenres(genres, era, { signal } = {}) {
      const response = await request('/genreCheck', { genre: genres, era }, { signal });
      if (!response.ok) throw new Error(`Genre check failed (${response.status})`);
      return (await response.json()).total;
    },

    async getGames() {
      const response = await request('/getGames', { playerID });
      return response.ok ? response.json() : null;
    },

    /** Resolves to `{ ok, songs }` or `{ ok: false, message }`. */
    async search(text) {
      const response = await request('/search', { playerID, query: text });
      if (!response.ok) return { ok: false, message: await response.text() };

      const songs = await response.json();
      if (!Array.isArray(songs)) return { ok: false, message: 'Game not found' };
      return { ok: true, songs };
    },

    /** Resolves to `{ ok, message }`. */
    async addSong(song) {
      const response = await fetch(`/add?${toQuery({ playerID })}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(song),
      });
      return { ok: response.ok, message: await response.text() };
    },

    joinGame: (gameID) => post('/joinGame', { gameID }),
    leaveGame: () => post('/leaveGame'),
    closeGame: () => post('/closeGame'),
    removeSong: (songID) => post('/remove', { songID }),
    clearSongs: () => post('/clear'),

    /** Resolves to `{ ok, body }`; body is the playlist URL or an error message. */
    async submit() {
      const response = await post('/submit');
      return { ok: response.ok, body: await response.text() };
    },
  };
}

/** Starts the Spotify login flow, which ends in a redirect back to the app. */
export function startLogin(params) {
  window.location.assign(`/login?${toQuery(params)}`);
}
