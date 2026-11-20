const STORAGE_KEY = 'playerID';

function fallbackUuid() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function createPlayerId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return fallbackUuid();
}

export function getPlayerId() {
  let playerID = null;
  try {
    playerID = localStorage.getItem(STORAGE_KEY);
  } catch {
    // localStorage can be unavailable in private/locked-down contexts.
  }

  if (!playerID) {
    playerID = createPlayerId();
    try {
      localStorage.setItem(STORAGE_KEY, playerID);
    } catch {
      // Keep the in-memory ID for this page load.
    }
  }

  return playerID;
}

export function goHome(playerID) {
  window.location.replace(`/?playerID=${encodeURIComponent(playerID)}`);
}

/** Ensures the URL carries this browser's player ID, mirroring it if not. */
export function ensurePlayerIdInUrl() {
  const playerID = getPlayerId();
  const urlPlayerID = new URLSearchParams(window.location.search).get('playerID');

  if (urlPlayerID !== playerID) {
    goHome(playerID);
  }

  return playerID;
}