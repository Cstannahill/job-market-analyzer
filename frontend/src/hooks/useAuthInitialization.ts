import { useEffect } from "react";
import { useAuthStore } from "@/stores/authStore";

export function useAuthInitialization() {
  const initialize = useAuthStore((state) => state.initialize);
  const isInitialized = useAuthStore((state) => state.isInitialized);

  useEffect(() => {
    if (isInitialized) {
      return;
    }

    initialize().catch((error) => {
      console.error(
        "Critical: Auth initialization failed unexpectedly:",
        error
      );
    });
  }, [initialize, isInitialized]);
}
