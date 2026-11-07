import type { StageDefinition } from "./types";
import { scripting } from "./stages/scripting";
import { storyboarding } from "./stages/storyboarding";
import { fetchingMedia } from "./stages/media";
import { voiceGeneration } from "./stages/voice";
import { musicGeneration } from "./stages/music";
import { assembling } from "./stages/assembling";
import { rendering } from "./stages/rendering";
import { finalizing } from "./stages/finalizing";

export const STAGES: StageDefinition[] = [
  scripting, storyboarding, voiceGeneration, fetchingMedia, musicGeneration, assembling, rendering, finalizing,
];
