import { json, badRequest } from "@/lib/api";

export const dynamic = "force-dynamic";
const WORKER_URL = (process.env.WORKER_URL || "http://localhost:4000").replace(/\/$/, "");

/** Forwards a small image upload (logo) to the worker, which stores it next to the project files. */
export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return badRequest("No file");
  if (file.size > 4 * 1024 * 1024) return badRequest("Logo must be under 4 MB");
  const dataBase64 = Buffer.from(await file.arrayBuffer()).toString("base64");
  const res = await fetch(`${WORKER_URL}/upload`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: file.name, dataBase64 }) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return json({ error: data.error ?? "Upload failed (is the worker running?)" }, 502);
  return json(data);
}
