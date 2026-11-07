/** Builds the reusable music library with Kie. `npm run music:library -w apps/worker -- 8` (tracks per style; default 6). Run on the VPS. */
import { buildLibrary } from "../services/musicLibrary";
const n = Number(process.argv[2] || 6); const only = process.argv[3]?.split(",");
buildLibrary(n, only).then(() => { console.log("done"); process.exit(0); });
