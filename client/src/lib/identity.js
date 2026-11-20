const STORAGE_KEY = 'playerID';

function fallbackUuid() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function createPlayerId() {
  return crypto.randomUUID ? crypto.randomUUID() : fallbackUuid();
}

/** This browser's player ID, created and stored on first use. */
export function getPlayerId() {
  let playerID = null;
  try {
    playerID = localStorage.getItem(STORAGE_KEY);
  } catch {
    // localStorage can be unavailable in private or locked-down contexts.
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
