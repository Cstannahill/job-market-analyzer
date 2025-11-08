import React from "react";

export function useDebouncedCallback<T>(
  cb: (v: T) => void,
  delay = 250
): [(v: T) => void, () => void] {
  const ref = React.useRef<number | null>(null);

  const cancel = React.useCallback(() => {
    if (ref.current !== null) {
      window.clearTimeout(ref.current);
      ref.current = null;
    }
  }, []);

  const run = React.useCallback(
    (v: T) => {
      if (ref.current !== null) window.clearTimeout(ref.current);
      ref.current = window.setTimeout(() => cb(v), delay);
    },
    [cb, delay]
  );

  React.useEffect(() => {
    return cancel; // cleanup on unmount
  }, [cancel]);

  return [run, cancel];
}
