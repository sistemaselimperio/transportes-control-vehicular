/** Runs `fn` until it succeeds, waiting longer after each failure (exponential backoff). */
export async function withRetry<T>(
  fn: () => Promise<T>,
  {
    attempts = 5,
    baseDelayMs = 1000,
    onRetry,
  }: { attempts?: number; baseDelayMs?: number; onRetry?: (attempt: number, error: unknown) => void } = {},
): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (e) {
      if (attempt >= attempts) throw e;
      onRetry?.(attempt, e);
      await new Promise((resolve) => setTimeout(resolve, baseDelayMs * 2 ** (attempt - 1)));
    }
  }
}
