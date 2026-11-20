# Song Game

A party game for Spotify. One person hosts a game, everyone else joins from their
phone and adds a few songs, and the host turns the result into a shuffled Spotify
playlist that interleaves everyone's picks. 

## How it works

1. The host signs in with Spotify, picks how many songs each person adds, and can
   optionally filter by release era and genre.
2. Players open the site and join the live game from the lobby.
3. Each player searches Spotify (scoped to the host's filters) and adds songs until
   they hit their limit.
4. The host submits. The server shuffles the songs so nobody's picks play back to
   back, creates the playlist on the host's Spotify account, and shares the link.

Games live in memory and are snapshotted to a JSON file, so a restart does not lose
an in-progress game. Games expire after six hours. Refresh tokens are renewed
automatically, and each game holds roughly 55 minutes of access token at a time.

## Requirements

- Node.js 22 or newer

## Quick start

```bash
npm install
npm run build   # builds the React client into dist/
npm start
```

Open <http://localhost:3000>. With no configuration present the app runs in **stub
mode**: it skips Spotify, uses the sample search results in `stubdata/search.json`,
and "submitting" returns the chosen track URIs instead of a playlist URL. This is
the fastest way to work on the UI.

```bash
npm run dev          # API server, restarts on file changes
npm run dev:client   # Vite dev server with hot reload (proxies the API to :3000)
npm test             # unit + HTTP integration tests
```

For UI work, run `npm run dev` and `npm run dev:client` together and open the Vite
URL (<http://localhost:5173>). The Spotify login redirects back to the API port, so
test the full login flow against the built app on port 3000.

## Configuration

Values are resolved in this order, with later sources winning:

1. `config/default.json`
2. `config/<NODE_ENV>.json`
3. Environment variables
4. Explicit overrides (tests only)

The `config/` directory is optional and git-ignored. Deployments should use
environment variables.

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `3000` | HTTP port |
| `STUB` | `true` outside production | Use fake Spotify data instead of the real API |
| `SPOTIFY_CLIENT_ID` | – | Spotify app client ID |
| `SPOTIFY_CLIENT_SECRET` | – | Spotify app client secret |
| `SPOTIFY_REDIRECT_URI` | `http://localhost:<PORT>/callback` | Must match the redirect URI registered with Spotify |
| `GAMES_FILE` | `stubdata/games.json` | Where the game snapshot is written (must be a writable path) |

For local development against real Spotify, create `config/default.json`:

```json
{
  "stub": false,
  "client_id": "your-client-id",
  "client_secret": "your-client-secret",
  "redirect_uri": "http://localhost:3000/callback",
  "volumePath": "./stubdata/games.json"
}
```

Then add `http://localhost:3000/callback` as a redirect URI in the
[Spotify developer dashboard](https://developer.spotify.com/dashboard).

## Project layout

```
server.js            Entry point: loads config, starts HTTP server and sweep timer
src/
  app.js             Express routes (JSON API + the built client)
  config.js          Env/file configuration and validation
  game.js            Game domain model (players, songs, shuffle, submit)
  gameStore.js       In-memory games, JSON persistence, expiry sweep
  random.js          ID generation and the interleaving shuffle
  services.js        Dependency wiring shared by the server and tests
  spotify.js         Spotify Web API client (fetch-based, no SDK)
client/              React app (Vite). No UI library: components and SCSS are custom
  public/            Static assets copied as-is (fonts, images, genres, audio)
  src/components/    Button, Modal, Panel, ProgressBar, SongRow, ...
  src/pages/         Lobby and Game screens and their modals
  src/styles/        SCSS variables and global styles
dist/                Built client served by Express (git-ignored)
test/                node:test suites
```

## HTTP API

All endpoints take the player's ID as `?playerID=`. Player IDs are generated in the
browser and stored in `localStorage`; they are not authenticated.

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/` | Serves the React app, which shows the lobby or the game |
| `GET` | `/getGames` | Live games for the lobby |
| `POST` | `/joinGame?gameID=` | Join a game (leaves the current one first) |
| `POST` | `/leaveGame` | Leave the current game |
| `POST` | `/closeGame` | Host: close the game. Player: leave |
| `GET` | `/login` | Start the Spotify authorization flow |
| `GET` | `/callback` | Spotify OAuth callback |
| `GET` | `/search?query=` | Search the host's era/genre-filtered catalogue |
| `GET` | `/loadinfo` | Host name, host flag, song limit |
| `GET` | `/update` | Poll game state and the player's songs |
| `POST` | `/remove?songID=` | Remove one of the player's songs |
| `POST` | `/add` | Add a Spotify track (JSON body) |
| `POST` | `/clear` | Host: clear all songs |
| `POST` | `/submit` | Host: build the playlist |

## Deployment (Fly.io)

The included `Dockerfile` and `fly.toml` expect:

- a volume mounted at `/data` (already configured),
- `GAMES_FILE=/data/games.json` (already configured in `fly.toml`),
- Spotify credentials stored as secrets:

```bash
fly secrets set SPOTIFY_CLIENT_ID=... SPOTIFY_CLIENT_SECRET=...
```

Set the Spotify redirect URI to `https://<your-app>.fly.dev/callback` (the value in
`fly.toml` uses `songgame.fly.dev`). Deploys run from `.github/workflows/fly-deploy.yml`
on pushes to `main`.

## Known limitations

- A game is a single Node process. Running more than one machine would need shared
  storage and sticky sessions.
- Player identity is a browser-generated ID, so anyone who knows another player's ID
  could act as them. This is fine for a party game between friends, not for anything
  public.
- The game snapshot is rewritten on every mutation. That is plenty for a party-sized
  game but not a general-purpose datastore.