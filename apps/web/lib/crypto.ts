import crypto from "node:crypto";

const key = () => crypto.createHash("sha256").update(process.env.AUTH_SECRET || "dev-secret-change-me-please-32-chars!!").digest();

/** AES-256-GCM, base64 "iv.tag.cipher" — for refresh tokens at rest. */
export function encrypt(text: string): string {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([c.update(text, "utf8"), c.final()]);
  return `${iv.toString("base64")}.${c.getAuthTag().toString("base64")}.${enc.toString("base64")}`;
}
export function decrypt(blob: string): string {
  const [iv, tag, data] = blob.split(".").map((x) => Buffer.from(x, "base64"));
  const d = crypto.createDecipheriv("aes-256-gcm", key(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(data), d.final()]).toString("utf8");
}
