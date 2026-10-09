/**
 * True when a fetch rejected because its `AbortSignal.timeout()` fired. The
 * runtime may surface it as a `TimeoutError` or as an `AbortError`.
 */
export function isTimeoutError(error: unknown): boolean {
  return error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
}

/** Milliseconds elapsed since `start` (from `performance.now()`), rounded. */
export function elapsedMs(start: number): number {
  return Math.round(performance.now() - start);
}
