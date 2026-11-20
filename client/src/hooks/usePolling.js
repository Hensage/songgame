import { useEffect, useRef } from 'react';

/**
 * Calls `task` immediately and then every `intervalMs`, never running two calls
 * at once. The latest `task` is always used without restarting the timer.
 * Returns a function that runs the task on demand.
 */
export function usePolling(task, intervalMs) {
  const taskRef = useRef(task);
  const runningRef = useRef(false);

  useEffect(() => {
    taskRef.current = task;
  });

  const runRef = useRef(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    try {
      await taskRef.current();
    } catch (error) {
      console.error('Polling failed', error);
    } finally {
      runningRef.current = false;
    }
  });

  useEffect(() => {
    const run = runRef.current;
    run();
    const timer = setInterval(run, intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);

  return runRef.current;
}
