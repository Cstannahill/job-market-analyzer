// test setup file: import matchers or global mocks here
import "@testing-library/jest-dom";

// Add a minimal ResizeObserver mock so components that rely on it
// (for example Recharts' ResponsiveContainer) don't throw in jsdom.
// This mock implements observe/unobserve/disconnect as no-ops and
// calls the callback immediately with a fake contentRect when needed.
class MockResizeObserver {
  callback: ResizeObserverCallback;
  // static test helpers
  static __currentSize: { width: number; height: number } = {
    width: 1024,
    height: 768,
  };
  // queue of sizes to allow tests to push multiple resize events
  static __sizeQueue: Array<{ width: number; height: number }> = [];
  static __setSize(size: { width: number; height: number }) {
    MockResizeObserver.__currentSize = size;
  }

  // push a size into the queue (FIFO) so tests can schedule multiple resizes
  static __enqueueSize(size: { width: number; height: number }) {
    MockResizeObserver.__sizeQueue.push(size);
  }

  // notify observers: if the queue has entries, shift one and use it; otherwise use current size
  static __notifyAll() {
    // If multiple observers exist, each observe call will get the same size.
    const size = MockResizeObserver.__sizeQueue.length
      ? MockResizeObserver.__sizeQueue.shift()!
      : MockResizeObserver.__currentSize;
    // call callbacks for all active instances
    for (const inst of MockResizeObserver.__instances) {
      const entry = [{ contentRect: size }];
      try {
        inst.callback(
          entry as unknown as ResizeObserverEntry[],
          inst as unknown as ResizeObserver
        );
      } catch {
        // swallow to avoid test crashes from observer handlers
      }
    }
  }

  // keep weak list of instances currently created so notify can reach them
  static __instances: MockResizeObserver[] = [];

  constructor(cb: ResizeObserverCallback) {
    this.callback = cb;
    MockResizeObserver.__instances.push(this);
  }
  observe() {
    // invoke callback with the current mocked size
    const size = MockResizeObserver.__sizeQueue.length
      ? MockResizeObserver.__sizeQueue.shift()!
      : MockResizeObserver.__currentSize;
    const entry = [{ contentRect: size }];
    this.callback(
      entry as unknown as ResizeObserverEntry[],
      this as unknown as ResizeObserver
    );
  }
  unobserve() {}
  disconnect() {}
}

// Attach the mock to the global scope used by tests
// Use a cast to any to avoid colliding with the DOM lib's ResizeObserver type.
// Define the mock ResizeObserver on globalThis without using `any` casts.
Object.defineProperty(globalThis, "ResizeObserver", {
  value: MockResizeObserver,
  configurable: true,
  writable: true,
});

// Tests can programmatically change the mocked size via:
//   (globalThis as any).ResizeObserver.__setSize({ width: 400, height: 800 })
// The class already defines static __setSize and __currentSize.

// Basic window.matchMedia mock for jsdom environment.
// Vitest/jsdom doesn't implement matchMedia, and some hooks/components
// call window.matchMedia at module init or during render.
if (typeof window !== "undefined" && typeof window.matchMedia !== "function") {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: (query: string) => {
      // Minimal mock: matches false by default, supports addEventListener/removeEventListener
      let listeners: Array<(e: { matches: boolean }) => void> = [];
      const mql = {
        matches: false,
        media: query,
        onchange: null,
        addEventListener: (type: string, listener: (e: any) => void) => {
          if (type === "change") listeners.push(listener);
        },
        removeEventListener: (type: string, listener: (e: any) => void) => {
          if (type === "change")
            listeners = listeners.filter((l) => l !== listener);
        },
        addListener: (listener: (e: any) => void) => {
          // legacy
          listeners.push(listener);
        },
        removeListener: (listener: (e: any) => void) => {
          listeners = listeners.filter((l) => l !== listener);
        },
        dispatchEvent: (ev: { matches: boolean }) => {
          listeners.forEach((l) => l(ev));
        },
      } as unknown as MediaQueryList;

      return mql;
    },
  });
}

export default () => {};
