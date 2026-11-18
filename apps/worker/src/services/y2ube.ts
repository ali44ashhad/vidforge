/**
 * Buyer installs talk to the seller's site with one y2_ key.
 * The machine that owns the provider keys sets Y2UBE_SERVE_GATEWAY=1 and never calls itself.
 */
import { AsyncLocalStorage } from "node:async_hooks";

const direct = new AsyncLocalStorage<true>();

/** Gateway handlers run inside this so provider code uses local keys instead of calling back out. */
export function runAsGateway<T>(fn: () => Promise<T>): Promise<T> {
  return direct.run(true, fn);
}

export function y2ubeRemote(): boolean {
  if (direct.getStore()) return false;
  if (process.env.Y2UBE_SERVE_GATEWAY === "1") return false;
  return !!process.env.Y2UBE_API_KEY?.trim();
}

export function y2ubeBase(): string {
  return (process.env.Y2UBE_API_BASE || "https://y2ube.io").replace(/\/$/, "");
}

export async function y2fetch<T>(path: string, init: { method?: string; body?: unknown; timeoutMs?: number } = {}): Promise<T> {
  const key = process.env.Y2UBE_API_KEY?.trim();
  if (!key) throw new Error("Y2UBE_API_KEY is not set");
  const res = await fetch(`${y2ubeBase()}${path}`, {
    method: init.method ?? (init.body === undefined ? "GET" : "POST"),
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    signal: AbortSignal.timeout(init.timeoutMs ?? 180_000),
  });
  const text = await res.text();
  let data: { error?: string } = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { error: text.slice(0, 300) }; }
  if (!res.ok) {
    const err = data.error || `HTTP ${res.status}`;
    if (res.status === 404) throw new Error(`y2ube has no ${path} yet. Deploy this version, then retry. (${err})`);
    throw new Error(`y2ube ${path} failed: ${err}`);
  }
  return data as T;
}
