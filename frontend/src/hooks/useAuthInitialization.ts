import { useEffect } from "react";
import { useAuthStore } from "@/stores/authStore";

/**
 * Authentication Initialization Hook
 *
 * Architectural Purpose:
 * - Orchestrates application-wide auth initialization
 * - Runs once on app mount (called from main.tsx/App.tsx)
 * - Validates persisted sessions against API
 * - Establishes single source of truth for auth state
 *
 * Design Pattern: Initialization Hook
 * - Encapsulates complex initialization logic
 * - Declarative usage (just call the hook)
 * - Side effects isolated to useEffect
 * - No component coupling
 *
 * Critical Path Analysis:
 * 1. App mounts
 * 2. This hook runs (useEffect triggered)
 * 3. Zustand store.initialize() called
 * 4. authService validates tokens
 * 5. If valid: fetch user profile from API
 * 6. Update Zustand store
 * 7. All subscribed components react to state change
 *
 * Performance Characteristics:
 * - Runs once per session (empty dependency array)
 * - Non-blocking (async initialization)
 * - Parallel to initial render (doesn't delay UI)
 * - Cached profile shows immediately (optimistic UI)
 *
 * Error Handling Philosophy:
 * - Fail gracefully (invalid sessions → logged out state)
 * - Never throw to component (internal error handling)
 * - Always mark as initialized (prevents loading limbo)
 * - Log errors for observability
 */

export function useAuthInitialization() {
  const initialize = useAuthStore((state) => state.initialize);
  const isInitialized = useAuthStore((state) => state.isInitialized);

  useEffect(() => {
    /**
     * Idempotency Guard
     *
     * Prevents double initialization which could cause:
     * - Duplicate API calls
     * - Race conditions
     * - Wasted resources
     *
     * Design: Early return pattern
     * - Simple condition check
     * - No complex state management
     * - Self-documenting intent
     */
    if (isInitialized) {
      return;
    }

    /**
     * Async Initialization
     *
     * Pattern: Fire and forget
     * - Don't await (allows parallel render)
     * - Errors handled internally
     * - State updates trigger re-renders naturally
     *
     * Rationale: UX over everything
     * - Show cached UI immediately
     * - Fetch fresh data in background
     * - Update seamlessly when ready
     * - Never block initial render
     */
    initialize().catch((error) => {
      // This should never happen (initialize handles errors internally)
      // But defensive programming never hurts
      console.error(
        "Critical: Auth initialization failed unexpectedly:",
        error
      );
    });

    /**
     * Cleanup: None needed
     *
     * Initialization is fire-and-forget
     * - No subscriptions to cleanup
     * - No timers to cancel
     * - No event listeners to remove
     * - State managed by Zustand (automatic cleanup)
     */
  }, [initialize, isInitialized]);

  /**
   * Return Value: None
   *
   * Design Decision: Side-effect only hook
   * - Doesn't provide data (use useAuthStore for that)
   * - Doesn't provide actions (use useAuthActions)
   * - Single responsibility: initialization
   * - Call once and forget
   *
   * Alternative Design (rejected):
   * Could return { isInitialized, loading }
   * - Adds coupling between initialization and consumption
   * - Components can get state directly from store
   * - Cleaner separation of concerns
   */
}

/**
 * Usage Pattern:
 *
 * // In App.tsx or main.tsx component wrapper
 * function App() {
 *   useAuthInitialization(); // That's it!
 *
 *   return (
 *     <Routes>
 *       // Your routes
 *     </Routes>
 *   );
 * }
 *
 * // Components consume auth state separately
 * function SomeComponent() {
 *   const user = useAuthUser();
 *   const isAuthenticated = useIsAuthenticated();
 *
 *   // Component logic
 * }
 *
 * Design Benefits:
 * - Clear separation: initialization vs. consumption
 * - No prop drilling
 * - No context provider dance
 * - Direct store subscription
 * - Optimal re-render performance
 */
