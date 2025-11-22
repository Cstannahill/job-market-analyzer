import type { SourceAdapter } from "./types.js";
import { greenhouseAdapter } from "./greenhouse.js";
import { leverAdapter } from "./lever.js";
import { usajobsAdapter } from "./usajobs.js";

export const adapters: Record<string, SourceAdapter> = {
  greenhouse: greenhouseAdapter,
  lever: leverAdapter,
  usajobs: usajobsAdapter,
};
