import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { devtools } from "zustand/middleware";
import { authService, type UserProfile } from "@/services/authService";
import type {
  ConfirmForgotPasswordRequest,
  PasswordResetInitiateRequest,
} from "@job-market-analyzer/types";

/**
 * Authentication Store Architecture
 *
 * Design Philosophy:
 * - Single source of truth for authentication state
 * - Persistent across sessions via localStorage
 * - Reactive updates propagate to all subscribers
 * - Separation of state (data) from behavior (actions)
 * - Type-safe with full TypeScript inference
 *
 * State Structure:
 * - user: Current authenticated user profile
 * - isAuthenticated: Computed from user presence
 * - isInitialized: Has initial auth check completed?
 * - loading: Are we currently performing auth operations?
 *
 * Action Patterns:
 * - Optimistic updates where appropriate
 * - Error handling with state rollback
 * - Side effects (API calls) within actions
 * - Immutable state updates (Zustand handles this)
 *
 * Persistence Strategy:
 * - User profile persisted (quick hydration)
 * - Tokens managed by authService (security boundary)
 * - Selective persistence (don't persist loading states)
 * - Automatic rehydration on app mount
 */

interface AuthState {
  // State
  user: UserProfile | null;
  isInitialized: boolean;
  loading: boolean;

  // Computed
  isAuthenticated: boolean;

  // Actions
  setUser: (user: UserProfile | null) => void;
  setLoading: (loading: boolean) => void;
  setInitialized: (initialized: boolean) => void;

  // Async Actions
  initialize: () => Promise<void>;
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
  forgotPasswordInitiate: (data: PasswordResetInitiateRequest) => Promise<void>;
  confirmPasswordReset: (data: ConfirmForgotPasswordRequest) => Promise<void>;

  // Utilities
  reset: () => void;
}

/**
 * Initial State Definition
 *
 * Design Decision: Explicit initial state
 * - Easier to reason about state shape
 * - Simplifies reset functionality
 * - Documents expected structure
 */
const initialState = {
  user: null,
  isInitialized: false,
  loading: false,
  isAuthenticated: false,
};

/**
 * Auth Store with Middleware Chain
 *
 * Middleware Order (matters!):
 * 1. devtools - Outermost (wraps all state changes)
 * 2. persist - Middle (handles storage)
 * 3. create - Innermost (core store logic)
 *
 * Each middleware wraps the next, creating layers of functionality
 */
export const useAuthStore = create<AuthState>()(
  devtools(
    persist(
      (set, get) => ({
        // ==================== STATE ====================
        ...initialState,

        // ==================== ACTIONS ====================

        /**
         * Set User Profile
         *
         * Design: Derived state pattern
         * - isAuthenticated computed from user presence
         * - Single update triggers all computed values
         * - No manual synchronization needed
         */
        setUser: (user) => {
          set(
            {
              user,
              isAuthenticated: user !== null,
            },
            false,
            "auth/setUser"
          );
        },

        /**
         * Set Loading State
         *
         * Pattern: Explicit loading management
         * - Components can show loading UI
         * - Prevents concurrent operations
         * - Clear operational boundaries
         */
        setLoading: (loading) => {
          set({ loading }, false, "auth/setLoading");
        },

        /**
         * Set Initialized State
         *
         * Purpose: Prevent flash of incorrect UI
         * - App shows loading until initialization complete
         * - Guards against premature redirects
         * - Single initialization per session
         */
        setInitialized: (initialized) => {
          set({ isInitialized: initialized }, false, "auth/setInitialized");
        },
        forgotPasswordInitiate: async (email: PasswordResetInitiateRequest) => {
          set({ loading: true }, false, "auth/forgotPassword/start");

          try {
            await authService.forgotPasswordInitiate(email);
            // No state change needed; UI just shows “code sent” message.
          } catch (error) {
            console.error("Forgot password initiate failed:", error);
            // Let caller handle error messaging
            throw error;
          } finally {
            set({ loading: false }, false, "auth/forgotPassword/end");
          }
        },

        confirmPasswordReset: async ({ email, code, newPassword }) => {
          set({ loading: true }, false, "auth/resetPassword/start");

          try {
            await authService.resetPassword({ email, code, newPassword });
            // Still not logging the user in automatically; they’ll log in with new password.
          } catch (error) {
            console.error("Password reset failed:", error);
            throw error;
          } finally {
            set({ loading: false }, false, "auth/resetPassword/end");
          }
        },
        /**
         * Initialize Authentication
         *
         * Critical Path: Runs once on app mount
         *
         * Flow:
         * 1. Check if authService has valid tokens
         * 2. If tokens exist, fetch user profile from API
         * 3. If API call fails, clear invalid session
         * 4. Mark as initialized regardless of outcome
         *
         * Design Decisions:
         * - Non-blocking: doesn't throw on failure
         * - Optimistic: tries cached profile first
         * - Defensive: clears invalid sessions
         * - Idempotent: safe to call multiple times
         *
         * Race Condition Handling:
         * - Uses authService token validation (atomic)
         * - Single API call prevents duplicate requests
         * - State updates are synchronous (no races)
         */
        initialize: async () => {
          // Early return if already initialized
          if (get().isInitialized) {
            return;
          }

          try {
            // Check if user has valid session tokens
            if (!authService.isAuthenticated()) {
              // No valid session - clean slate
              set(
                {
                  user: null,
                  isAuthenticated: false,
                  isInitialized: true,
                },
                false,
                "auth/initialize/noSession"
              );
              return;
            }

            // Try cached profile first (instant UI update)
            const cachedProfile = authService.getCachedUserProfile();
            if (cachedProfile) {
              set(
                {
                  user: cachedProfile,
                  isAuthenticated: true,
                },
                false,
                "auth/initialize/cached"
              );
            }

            // Fetch fresh profile from API (validates tokens)
            try {
              const profile = await authService.getCurrentUser();
              set(
                {
                  user: profile,
                  isAuthenticated: true,
                  isInitialized: true,
                },
                false,
                "auth/initialize/success"
              );
            } catch (error) {
              // API call failed - session invalid
              console.error("Failed to load user profile:", error);

              // Clear invalid session
              set(
                {
                  user: null,
                  isAuthenticated: false,
                  isInitialized: true,
                },
                false,
                "auth/initialize/failed"
              );
            }
          } catch (error) {
            // Unexpected error - fail gracefully
            console.error("Auth initialization error:", error);
            set(
              {
                user: null,
                isAuthenticated: false,
                isInitialized: true,
              },
              false,
              "auth/initialize/error"
            );
          }
        },

        /**
         * Refresh User Profile
         *
         * Use Cases:
         * - After profile update
         * - After resume upload
         * - Manual refresh trigger
         *
         * Pattern: Optimistic update with rollback
         * - Assumes success (better UX)
         * - Rolls back on failure
         * - Loading state during fetch
         */
        refreshUser: async () => {
          if (!authService.isAuthenticated()) {
            set(
              { user: null, isAuthenticated: false },
              false,
              "auth/refreshUser/notAuthenticated"
            );
            return;
          }

          const previousUser = get().user;
          set({ loading: true }, false, "auth/refreshUser/start");

          try {
            const profile = await authService.getCurrentUser();
            set(
              {
                user: profile,
                isAuthenticated: true,
                loading: false,
              },
              false,
              "auth/refreshUser/success"
            );
          } catch (error) {
            console.error("Failed to refresh user:", error);

            // Rollback to previous state on failure
            set(
              {
                user: previousUser,
                loading: false,
              },
              false,
              "auth/refreshUser/error"
            );

            throw error; // Propagate for caller handling
          }
        },

        /**
         * Logout
         *
         * Critical Operation: Must succeed even if API fails
         *
         * Flow:
         * 1. Call authService.logout() (invalidates server tokens)
         * 2. Clear local state (always succeeds)
         * 3. Clear persisted storage
         *
         * Design: Fail-safe logout
         * - Local logout always succeeds
         * - Server logout is best-effort
         * - User never stuck logged in
         */
        logout: async () => {
          set({ loading: true }, false, "auth/logout/start");

          try {
            // Attempt server-side logout
            await authService.logout();
          } catch (error) {
            // Server logout failed, but continue with local logout
            console.error("Server logout error:", error);
          } finally {
            // Always clear local state
            set(
              {
                ...initialState,
                isInitialized: true, // Stay initialized
              },
              false,
              "auth/logout/complete"
            );
          }
        },

        /**
         * Reset Store
         *
         * Use Cases:
         * - Testing
         * - Hard reset scenarios
         * - Clear all state
         *
         * Note: Rarely needed in production
         * - logout() is preferred for user-initiated signout
         * - reset() is for development/testing
         */
        reset: () => {
          set(initialState, false, "auth/reset");
        },
      }),
      {
        name: "auth-storage", // localStorage key
        storage: createJSONStorage(() => localStorage),

        // Selective Persistence
        // Only persist user profile, not transient state
        partialize: (state) => ({
          user: state.user,
          // Don't persist: loading, isInitialized
        }),

        // Rehydration Strategy
        // Called after store restoration from localStorage
        onRehydrateStorage: () => (state) => {
          if (state) {
            // Ensure computed values are correct after rehydration
            state.isAuthenticated = state.user !== null;

            // Force re-initialization to validate session
            // This happens async, doesn't block rendering
            state.initialize();
          }
        },
      }
    ),
    {
      name: "AuthStore", // DevTools identifier
      enabled: import.meta.env.DEV, // Only in development
    }
  )
);

/**
 * Selector Hooks (Performance Optimization)
 *
 * Pattern: Granular subscriptions
 * - Components only re-render when specific data changes
 * - Prevents cascade re-renders from unrelated state updates
 * - Follows React optimization best practices
 *
 * Example:
 * const user = useAuthUser(); // Only re-renders when user changes
 * const isAuth = useIsAuthenticated(); // Only re-renders when auth status changes
 */

export const useAuthUser = () => useAuthStore((state) => state.user);
export const useIsAuthenticated = () =>
  useAuthStore((state) => state.isAuthenticated);
export const useAuthInitialized = () =>
  useAuthStore((state) => state.isInitialized);
export const useAuthLoading = () => useAuthStore((state) => state.loading);

/**
 * Action Hooks (Convenience)
 *
 * Pattern: Separate data from actions
 * - Components can call actions without subscribing to state
 * - Actions don't trigger re-renders
 * - Clean separation of concerns
 */
export const useAuthActions = () =>
  useAuthStore((state) => ({
    setUser: state.setUser,
    setLoading: state.setLoading,
    refreshUser: state.refreshUser,
    logout: state.logout,
    reset: state.reset,
    forgotPasswordInitiate: state.forgotPasswordInitiate,
    confirmPasswordReset: state.confirmPasswordReset,
  }));
