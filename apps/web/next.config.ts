
import type { NextConfig } from "next";
import { config } from "dotenv";
import path from "node:path";

// Local dev: load the single root .env.
// On Vercel, environment variables come from the dashboard.
config({ path: path.resolve(process.cwd(), "../../.env") });

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.resolve(process.cwd(), "../.."),

  transpilePackages: ["@vidforge/db", "@vidforge/shared"],

  serverExternalPackages: ["@prisma/client"],
};

export default nextConfig;
