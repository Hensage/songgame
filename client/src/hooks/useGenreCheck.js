import { useEffect, useState } from 'react';

const DEBOUNCE_MS = 400;

/**
 * Looks up how many songs match any of the genres in an era, waiting for the
 * inputs to settle. Returns `{ status: 'idle' | 'loading' | 'ready' | 'error', total }`.
 */
export function useGenreCheck(api, { genres, era, enabled }) {
  const [result, setResult] = useState({ status: 'idle', total: null });
  const genreKey = genres.join('|');

  useEffect(() => {
    if (!enabled) {
      setResult({ status: 'idle', total: null });
      return undefined;
    }

    const controller = new AbortController();
    setResult((previous) => ({ status: 'loading', total: previous.total }));

    const timer = setTimeout(async () => {
      try {
        const total = await api.checkGenres(genreKey ? genreKey.split('|') : [], era, { signal: controller.signal });
        setResult({ status: 'ready', total });
      } catch (error) {
        if (error.name !== 'AbortError') setResult({ status: 'error', total: null });
      }
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [api, genreKey, era, enabled]);

  return result;
}
