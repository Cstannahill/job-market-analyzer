import { useEffect, useState } from "react";

/**
 * Hook that returns true when the viewport matches Tailwind's `lg` breakpoint for mobile (max-width: 1023px).
 */
export default function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState<boolean>(
    typeof window !== "undefined"
      ? window.matchMedia("(max-width: 1023px)").matches
      : false
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq: MediaQueryList = window.matchMedia("(max-width: 1023px)");
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);

    if (typeof mq.addEventListener === "function") {
      mq.addEventListener("change", handler);
      return () => mq.removeEventListener("change", handler);
    }

    const legacy = mq as unknown as {
      addListener?: (h: (e: MediaQueryListEvent) => void) => void;
      removeListener?: (h: (e: MediaQueryListEvent) => void) => void;
    };
    if (typeof legacy.addListener === "function") {
      legacy.addListener(handler);
      return () => legacy.removeListener && legacy.removeListener(handler);
    }

    return undefined;
  }, []);

  return isMobile;
}
