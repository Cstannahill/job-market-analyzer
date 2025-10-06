// Small test helper to interact with the ResizeObserver mock installed in setupTests.ts
export function setTestResize(width: number, height: number) {
  const RO = globalThis.ResizeObserver as
    | (typeof ResizeObserver & {
        __setSize?: (size: { width: number; height: number }) => void;
        __notifyAll?: () => void;
      })
    | undefined;
  if (!RO) throw new Error("ResizeObserver mock is not installed");
  RO.__setSize?.({ width, height });
  // notify observers immediately so components react in the same tick
  RO.__notifyAll?.();
}

export function enqueueTestResize(width: number, height: number) {
  const RO = globalThis.ResizeObserver as
    | (typeof ResizeObserver & {
        __enqueueSize?: (size: { width: number; height: number }) => void;
      })
    | undefined;
  if (!RO) throw new Error("ResizeObserver mock is not installed");
  RO.__enqueueSize?.({ width, height });
}

export function notifyTestResize() {
  const RO = globalThis.ResizeObserver as
    | (typeof ResizeObserver & {
        __notifyAll?: () => void;
      })
    | undefined;
  if (!RO) throw new Error("ResizeObserver mock is not installed");
  RO.__notifyAll?.();
}
