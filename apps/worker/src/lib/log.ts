export function log(scope: string, message: string, extra?: unknown) {
  const ts = new Date().toISOString();
  if (extra !== undefined) console.log(`[${ts}] [${scope}] ${message}`, extra);
  else console.log(`[${ts}] [${scope}] ${message}`);
}
export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
