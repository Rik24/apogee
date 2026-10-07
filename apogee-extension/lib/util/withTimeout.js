/**
 * Race a promise against a timeout, clearing the timer either way.
 *
 * @param {Promise<*>} promise work to wait for.
 * @param {number} ms timeout in milliseconds.
 * @param {{ onTimeout?: () => * }} [opts] fallback invoked on timeout. When
 * omitted, the race rejects with a generic timeout error.
 * @returns the inner promise value, or the `onTimeout()` return on timeout.
 */
export function withTimeout(promise, ms, { onTimeout } = {}) {
  let timer;
  const timeout = new Promise((resolve, reject) => {
    timer = setTimeout(() => {
      if (onTimeout) {
        try {
          resolve(onTimeout());
        } catch (err) {
          reject(err);
        }
      } else {
        reject(new Error(`Timed out after ${ms}ms`));
      }
    }, ms);
  });

  return Promise.race([Promise.resolve(promise), timeout]).finally(() =>
    clearTimeout(timer),
  );
}
