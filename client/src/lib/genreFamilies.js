// The most genres a game can use. Each one is a separate Spotify search, so the
// server enforces the same cap (MAX_GENRES in src/app.js).
export const MAX_GENRES = 5;

// Broad genres shown as quick picks in the New Game modal. Each `genre` must be
// an entry in public/spotifyGenres.json; the modal's match count shows how many
// songs Spotify finds for it, so a poor mapping is easy to spot and adjust here.
export const GENRE_FAMILIES = [
  { label: 'Pop', genre: 'pop' },
  { label: 'Rock', genre: 'rock' },
  { label: 'Hip-hop', genre: 'hip hop' },
  { label: 'R&B', genre: 'r&b' },
  { label: 'Country', genre: 'country' },
  { label: 'Electronic', genre: 'edm' },
  { label: 'House', genre: 'house' },
  { label: 'Jazz', genre: 'jazz' },
  { label: 'Metal', genre: 'metal' },
  { label: 'Punk', genre: 'punk' },
  { label: 'Indie', genre: 'indie rock' },
  { label: 'Soul', genre: 'soul' },
  { label: 'Funk', genre: 'funk' },
  { label: 'Folk', genre: 'folk' },
  { label: 'Blues', genre: 'blues' },
  { label: 'Reggae', genre: 'reggae' },
  { label: 'Latin', genre: 'latin pop' },
  { label: 'K-pop', genre: 'k-pop' },
  { label: 'Classical', genre: 'classical' },
  { label: 'Disco', genre: 'disco' },
];
