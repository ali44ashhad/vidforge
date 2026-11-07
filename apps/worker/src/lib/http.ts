import { sleep } from "./log";

export class HttpError extends Error {
  constructor(public status: number, public body: string, public url: string) {
    super(`HTTP ${status} from ${url}: ${body.slice(0, 300)}`);
  }
}

const DEFAULT_TIMEOUT_MS = Number(process.env.HTTP_TIMEOUT_MS || 60000);

/**
 * fetch with a hard timeout (no provider is allowed to hang us) and retries on
 * timeouts / network errors / 429 / 5xx (exponential backoff).
 */
export async function fetchRetry(url: string, init: RequestInit & { timeoutMs?: number } = {}, retries = 3): Promise<Response> {
  let lastErr: unknown;
  const { timeoutMs = DEFAULT_TIMEOUT_MS, ...rest } = init;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { ...rest, signal: AbortSignal.timeout(timeoutMs), headers: { Connection: "close", ...(rest.headers as Record<string, string> | undefined) } });
      if (res.status === 429 || res.status >= 500) {
        const body = await res.text().catch(() => "");
        lastErr = new HttpError(res.status, body, url);
        const retryAfter = Number(res.headers.get("retry-after")) || 0;
        await sleep(Math.max(retryAfter * 1000, 1000 * 2 ** attempt));
        continue;
      }
      return res;
    } catch (e) {
      lastErr = e instanceof Error && e.name === "TimeoutError" ? new Error(`request to ${url.split("?")[0]} timed out after ${timeoutMs / 1000}s`) : e;
      await sleep(1000 * 2 ** attempt);
    }
  }
  throw lastErr;
}

export async function fetchJson<T>(url: string, init: RequestInit = {}, retries = 3): Promise<T> {
  const res = await fetchRetry(url, init, retries);
  const text = await res.text();
  if (!res.ok) throw new HttpError(res.status, text, url);
  return JSON.parse(text) as T;
}

/** Runs `fn` over `items` with at most `limit` in flight. Preserves order of results. */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}
