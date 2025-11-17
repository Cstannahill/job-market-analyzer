import type { SourceAdapter } from "./types.js";
// import { museAdapter } from "./muse.js";
import { greenhouseAdapter } from "./greenhouse.js";
import { leverAdapter } from "./lever.js";
import { usajobsAdapter } from "./usajobs.js";

export const adapters: Record<string, SourceAdapter> = {
  // muse: museAdapter,
  greenhouse: greenhouseAdapter,
  lever: leverAdapter,
  usajobs: usajobsAdapter,
};
