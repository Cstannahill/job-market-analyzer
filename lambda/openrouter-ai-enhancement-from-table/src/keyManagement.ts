import { keyCooldowns, nowMs, sleep } from "./utils.js";

export const OPENROUTER_KEYS = [
  process.env.OPENROUTER_KEY_1,
  process.env.OPENROUTER_KEY_2,
  process.env.OPENROUTER_KEY_3,
  process.env.OPENROUTER_KEY_4,
  process.env.OPENROUTER_KEY_5,
].filter(Boolean) as string[];
let globalCooldownUntil = 0; // ms epoch when any call is allowed again

// export function setGlobalCooldownUntil(tsMs: number) {
//   globalCooldownUntil = Math.max(globalCooldownUntil, tsMs);
//   console.warn(
//     `[WARN] Global cooldown until ${new Date(
//       globalCooldownUntil
//     ).toISOString()}`
//   );
// }

// export async function waitForGlobalWindow() {
//   const now = Date.now();
//   if (now < globalCooldownUntil) {
//     const waitMs = globalCooldownUntil - now + 3000;
//     console.warn(`[WARN] Waiting for global window ${waitMs}ms`);
//     await sleep(waitMs);
//   }
// }
export function maskKey(k: string) {
  if (!k) return "(none)";
  return k.slice(0, 8) + "…redacted…" + k.slice(-4);
}

let currentKeyIndex = 0;

export async function getNextApiKeyAsync(): Promise<string> {
  if (OPENROUTER_KEYS.length === 0) {
    throw new Error("No OpenRouter API keys configured");
  }

  for (let i = 0; i < OPENROUTER_KEYS.length; i++) {
    const idx = (currentKeyIndex + i) % OPENROUTER_KEYS.length;
    const key = OPENROUTER_KEYS[idx]!;
    const until = keyCooldowns[key] || 0;
    if (until <= nowMs()) {
      currentKeyIndex = (idx + 1) % OPENROUTER_KEYS.length;
      return key;
    }
  }

  const earliest = Math.min(
    ...OPENROUTER_KEYS.map((k) => keyCooldowns[k] || nowMs())
  );
  const waitMs = Math.max(0, earliest - nowMs()) + 2000;
  console.log(`All API keys on cooldown. Waiting ${waitMs}ms...`);
  await sleep(waitMs);
  return getNextApiKeyAsync();
}
export function keyIndexOf(k: string): number | undefined {
  const i = OPENROUTER_KEYS.indexOf(k);
  return i >= 0 ? i : undefined;
}
