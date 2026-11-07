import fs from "node:fs";
import path from "node:path";
import { env } from "../env";

/** Returns an absolute folder for a project (created if missing). */
export function projectDir(projectId: string, ...sub: string[]): string {
  const dir = path.join(env.STORAGE_DIR, "projects", projectId, ...sub);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** Converts a path inside STORAGE_DIR into a public URL served by the worker. */
export function publicUrl(absPath: string): string {
  const rel = path.relative(env.STORAGE_DIR, absPath).split(path.sep).join("/");
  return `${env.STORAGE_PUBLIC_URL}/files/${rel}`;
}
