export const FIRST_YEAR = 1950;
export const CURRENT_YEAR = new Date().getFullYear();

/** Whether an era string like "1990-1999" covers every year (so it filters nothing). */
export function isFullEra(era) {
  const [after, before] = String(era).split('-').map(Number);
  return after <= FIRST_YEAR && before >= CURRENT_YEAR;
}

/** Describes a game's filters for people, for example "rock, 1990-1999". Empty if there are none. */
export function describeFilters({ genres = [], era }) {
  const parts = [];
  if (genres.length > 0) parts.push(genres.join(' or '));
  if (era && !isFullEra(era)) parts.push(era);
  return parts.join(', ');
}
