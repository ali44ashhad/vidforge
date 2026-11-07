import type { Project } from "@vidforge/db";
import type { PipelineStage } from "@vidforge/shared";

export interface StageContext {
  project: Project;
  /** Report progress (0-100) inside the current stage. */
  report: (percentWithinStage: number, note?: string) => Promise<void>;
  log: (message: string, extra?: unknown) => void;
}

export interface StageDefinition {
  name: PipelineStage;
  /** Never satisfied by a checkpoint: re-runs whenever the pipeline reaches it (assemble/render/finalize). */
  alwaysRun?: boolean;
  run: (ctx: StageContext) => Promise<void>;
}
