import "@testing-library/jest-dom";

class MockResizeObserver {
  callback: ResizeObserverCallback;

  static __currentSize: { width: number; height: number } = {
    width: 1024,
    height: 768,
  };

  static __sizeQueue: Array<{ width: number; height: number }> = [];
  static __setSize(size: { width: number; height: number }) {
    MockResizeObserver.__currentSize = size;
  }

  static __enqueueSize(size: { width: number; height: number }) {
    MockResizeObserver.__sizeQueue.push(size);
  }

  static __notifyAll() {
    const size = MockResizeObserver.__sizeQueue.length
      ? MockResizeObserver.__sizeQueue.shift()!
      : MockResizeObserver.__currentSize;

    for (const inst of MockResizeObserver.__instances) {
      const entry = [{ contentRect: size }];
      try {
        inst.callback(
          entry as unknown as ResizeObserverEntry[],
          inst as unknown as ResizeObserver
        );
      } catch (err) {
        console.error(err);
      }
    }
  }

  static __instances: MockResizeObserver[] = [];

  constructor(cb: ResizeObserverCallback) {
    this.callback = cb;
    MockResizeObserver.__instances.push(this);
  }
  observe() {
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

Object.defineProperty(globalThis, "ResizeObserver", {
  value: MockResizeObserver,
  configurable: true,
  writable: true,
});

if (typeof window !== "undefined" && typeof window.matchMedia !== "function") {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: (query: string) => {
      let listeners: Array<(e: { matches: boolean }) => void> = [];
      const mql = {
        matches: false,
        media: query,
        onchange: null,
        addEventListener: (type: string, listener: (e: unknown) => void) => {
          if (type === "change") listeners.push(listener);
        },
        removeEventListener: (type: string, listener: (e: unknown) => void) => {
          if (type === "change")
            listeners = listeners.filter((l) => l !== listener);
        },
        addListener: (listener: (e: unknown) => void) => {
          listeners.push(listener);
        },
        removeListener: (listener: (e: unknown) => void) => {
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
