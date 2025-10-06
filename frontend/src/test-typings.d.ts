// Test-only global augmentations for the ResizeObserver mock
export {};

declare global {
  interface ResizeObserverConstructor {
    __currentSize?: { width: number; height: number };
    __setSize?: (size: { width: number; height: number }) => void;
    __enqueueSize?: (size: { width: number; height: number }) => void;
    __notifyAll?: () => void;
    // Internal list of mock instances (not intended for production use).
    __instances?: Array<{
      callback: ResizeObserverCallback;
    }>;
  }
}
