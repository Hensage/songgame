import { makeId, shuffleSongs } from './random.js';

export const ADDED = 'Added';
export const SONG_LIMIT_REACHED = 'You have already added all your songs';
export const SONG_ALREADY_EXISTS = 'This song is already in the playlist';

const DEFAULT_GAME_LIFETIME_MS = 6 * 60 * 60 * 1000;
const DEFAULT_TOKEN_LIFETIME_MS = 55 * 60 * 1000;

export const NO_GENRE_LABEL = 'No genre listed';

/**
 * How many songs fall under each genre, most common first. A song counts once toward
 * every genre it has, and songs with none are grouped under `NO_GENRE_LABEL`.
 */
export function countGenres(playlist) {
  const counts = new Map();

  for (const song of playlist) {
    const genres = Array.isArray(song.genres) && song.genres.length > 0 ? song.genres : [NO_GENRE_LABEL];
    for (const genre of new Set(genres)) counts.set(genre, (counts.get(genre) ?? 0) + 1);
  }

  return [...counts]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
}

export class Game {
  constructor({
    hostPlayerID,
    hostId,
    hostName,
    accessToken,
    refreshToken,
    songsPerPerson = 3,
    era = '',
    genres = [],
    playlist = [],
    activePlayers = [],
    players = [],
    playlistURL = '',
    gameid = makeId(16),
    fullyExpires,
    expiresAt,
    kill = false,
    addHost = true,
    spotify = null,
    gameLifetimeMs = DEFAULT_GAME_LIFETIME_MS,
    tokenLifetimeMs = DEFAULT_TOKEN_LIFETIME_MS,
  }) {
    const songLimit = Number.parseInt(songsPerPerson, 10);

    this.playlist = playlist;
    this.activePlayers = activePlayers;
    this.players = players;
    this.playlistURL = playlistURL;
    this.fullyExpires = fullyExpires ?? Date.now() + gameLifetimeMs;

    this.gameid = gameid;
    this.hostPlayerID = hostPlayerID;
    this.hostid = hostId;
    this.hostName = hostName;
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    this.tokenLifetimeMs = tokenLifetimeMs;
    this.expiresAt = expiresAt ?? Date.now() + tokenLifetimeMs;

    this.songsPerPerson = Number.isInteger(songLimit) && songLimit > 0 ? songLimit : 3;
    this.era = era;
    this.genres = genres;
    this.kill = kill;

    this.countCounts = new Array(this.songsPerPerson + 1).fill(0);
    this.spotify = spotify;
    this.isRefreshingToken = false;

    if (addHost) this.addPlayerToGame(hostPlayerID);
  }

  static fromJSON(data, dependencies = {}) {
    return new Game({
      ...dependencies,
      hostPlayerID: data.hostPlayerID,
      hostId: data.hostid,
      hostName: data.hostName,
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      songsPerPerson: data.songsPerPerson,
      era: data.era,
      // Games saved before multi-select stored a single `genre` string.
      genres: Array.isArray(data.genres) ? data.genres : data.genre ? [data.genre] : [],
      playlist: Array.isArray(data.playlist) ? data.playlist : [],
      activePlayers: Array.isArray(data.activePlayers) ? data.activePlayers : [],
      players: Array.isArray(data.players) ? data.players : [],
      playlistURL: data.playlistURL ?? '',
      gameid: data.gameid,
      fullyExpires: data.fullyExpires,
      // Saved tokens may have expired while the server was down; force the
      // first sweep tick to refresh them.
      expiresAt: 0,
      kill: Boolean(data.kill),
      addHost: false,
    });
  }

  /** Fields persisted to the games JSON file. */
  toJSON() {
    return {
      playlist: this.playlist,
      activePlayers: this.activePlayers,
      players: this.players,
      playlistURL: this.playlistURL,
      gameid: this.gameid,
      hostPlayerID: this.hostPlayerID,
      hostid: this.hostid,
      hostName: this.hostName,
      accessToken: this.accessToken,
      refreshToken: this.refreshToken,
      fullyExpires: this.fullyExpires,
      kill: this.kill,
      songsPerPerson: this.songsPerPerson,
      era: this.era,
      genres: this.genres,
    };
  }

  isHost(playerID) {
    return playerID === this.hostPlayerID;
  }

  isPlayerInGame(playerID) {
    return this.activePlayers.includes(playerID);
  }

  addPlayerToGame(playerID) {
    if (this.isPlayerInGame(playerID)) return false;

    this.activePlayers.push(playerID);
    if (!this.players.includes(playerID)) this.players.push(playerID);
    return true;
  }

  removePlayerFromGame(playerID) {
    if (!this.isPlayerInGame(playerID)) return false;

    this.activePlayers.splice(this.activePlayers.indexOf(playerID), 1);

    // Keep players who already contributed songs so the final shuffle still
    // includes their picks.
    if (!this.isHost(playerID) && !this.playlist.some((song) => song.playerID === playerID)) {
      const playerIndex = this.players.indexOf(playerID);
      if (playerIndex !== -1) this.players.splice(playerIndex, 1);
    }

    return true;
  }

  getSongCountForPlayer(playerID) {
    return this.playlist.filter((song) => song.playerID === playerID).length;
  }

  addSong(song) {
    if (this.getSongCountForPlayer(song.playerID) >= this.songsPerPerson) {
      return { ok: false, message: SONG_LIMIT_REACHED };
    }
    if (this.playlist.some((existing) => existing.id === song.id)) {
      return { ok: false, message: SONG_ALREADY_EXISTS };
    }

    this.playlist.push(song);
    return { ok: true, message: ADDED };
  }

  removeSong(playerID, songId) {
    const index = this.playlist.findIndex((song) => song.id === songId && song.playerID === playerID);
    if (index === -1) return false;

    this.playlist.splice(index, 1);
    return true;
  }

  update(playerID) {
    const isPlaying = this.playlistURL === '';
    return {
      validGame: true,
      isPlaying,
      playerCount: this.players.length,
      songsPerPerson: this.songsPerPerson,
      count: this.playlist.length,
      countCounts: this.countCounts,
      genreCounts: countGenres(this.playlist),
      playlistURL: this.playlistURL,
      items: isPlaying ? this.playlist.filter((song) => song.playerID === playerID) : [],
    };
  }

  clear() {
    this.playlist = [];
  }

  async submit({ stub = false } = {}) {
    if (this.playlist.length === 0) {
      return { ok: false, message: 'No songs to submit' };
    }

    const uris = shuffleSongs(this.playlist, this.players, this.songsPerPerson)
      .map((song) => song.uri)
      .filter(Boolean);

    if (stub) {
      this.playlistURL = uris.join(',');
    } else {
      if (!this.spotify) throw new Error('Spotify client is not configured');

      const playlist = await this.spotify.createPlaylist({
        accessToken: this.accessToken,
        name: 'Song Game',
        description: `A party game where you all put ${this.songsPerPerson} songs into a Spotify playlist`,
      });
      await this.spotify.addTracksToPlaylist({
        accessToken: this.accessToken,
        playlistId: playlist.id,
        uris,
      });
      this.playlistURL = playlist.url;
    }

    this.playlist = [];
    return { ok: true, playlistURL: this.playlistURL };
  }

  async tick() {
    this.updateCountCounts();

    if (this.expiresAt <= Date.now() && !this.isRefreshingToken) {
      this.isRefreshingToken = true;
      try {
        await this.refreshAccessToken();
      } finally {
        this.isRefreshingToken = false;
      }
    }
  }

  updateCountCounts() {
    this.countCounts.fill(0);

    const songsPerPlayer = new Map(this.players.map((playerID) => [playerID, 0]));
    for (const song of this.playlist) {
      if (songsPerPlayer.has(song.playerID)) {
        songsPerPlayer.set(song.playerID, songsPerPlayer.get(song.playerID) + 1);
      }
    }

    for (const count of songsPerPlayer.values()) {
      if (count < this.countCounts.length) this.countCounts[count] += 1;
    }
  }

  async refreshAccessToken() {
    if (!this.spotify) {
      this.expiresAt = Date.now() + this.tokenLifetimeMs;
      return;
    }
    if (!this.refreshToken) {
      this.kill = true;
      return;
    }

    const tokens = await this.spotify.refreshAccessToken(this.refreshToken);
    this.accessToken = tokens.accessToken;
    if (tokens.refreshToken) this.refreshToken = tokens.refreshToken;
    this.expiresAt = Date.now() + this.tokenLifetimeMs;
  }
}