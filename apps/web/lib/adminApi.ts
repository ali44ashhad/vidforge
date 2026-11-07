import { requireAdmin, withAuth } from "@/lib/auth";
export { withAuth, requireAdmin };
export const WORKER_URL = (process.env.WORKER_URL || "http://localhost:4000").replace(/\/$/, "");
