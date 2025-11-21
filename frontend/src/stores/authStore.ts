import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { devtools } from "zustand/middleware";
import { authService, type UserProfile } from "@/services/authService";
import type {
  ConfirmForgotPasswordRequest,
  PasswordResetInitiateRequest,
} from "@job-market-analyzer/types";

interface AuthState {
  user: UserProfile | null;
  isInitialized: boolean;
  loading: boolean;

  isAuthenticated: boolean;

  setUser: (user: UserProfile | null) => void;
  setLoading: (loading: boolean) => void;
  setInitialized: (initialized: boolean) => void;

  initialize: () => Promise<void>;
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
  forgotPasswordInitiate: (data: PasswordResetInitiateRequest) => Promise<void>;
  confirmPasswordReset: (data: ConfirmForgotPasswordRequest) => Promise<void>;

  reset: () => void;
}

const initialState = {
  user: null,
  isInitialized: false,
  loading: false,
  isAuthenticated: false,
};

export const useAuthStore = create<AuthState>()(
  devtools(
    persist(
      (set, get) => ({
        ...initialState,

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

        setLoading: (loading) => {
          set({ loading }, false, "auth/setLoading");
        },

        setInitialized: (initialized) => {
          set({ isInitialized: initialized }, false, "auth/setInitialized");
        },
        forgotPasswordInitiate: async (email: PasswordResetInitiateRequest) => {
          set({ loading: true }, false, "auth/forgotPassword/start");

          try {
            await authService.forgotPasswordInitiate(email);
          } catch (error) {
            console.error("Forgot password initiate failed:", error);

            throw error;
          } finally {
            set({ loading: false }, false, "auth/forgotPassword/end");
          }
        },

        confirmPasswordReset: async ({ email, code, newPassword }) => {
          set({ loading: true }, false, "auth/resetPassword/start");

          try {
            await authService.resetPassword({ email, code, newPassword });
          } catch (error) {
            console.error("Password reset failed:", error);
            throw error;
          } finally {
            set({ loading: false }, false, "auth/resetPassword/end");
          }
        },

        initialize: async () => {
          if (get().isInitialized) {
            return;
          }

          try {
            if (!authService.isAuthenticated()) {
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
              console.error("Failed to load user profile:", error);

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

            set(
              {
                user: previousUser,
                loading: false,
              },
              false,
              "auth/refreshUser/error"
            );

            throw error;
          }
        },

        logout: async () => {
          set({ loading: true }, false, "auth/logout/start");

          try {
            await authService.logout();
          } catch (error) {
            console.error("Server logout error:", error);
          } finally {
            set(
              {
                ...initialState,
                isInitialized: true,
              },
              false,
              "auth/logout/complete"
            );
          }
        },

        reset: () => {
          set(initialState, false, "auth/reset");
        },
      }),
      {
        name: "auth-storage",
        storage: createJSONStorage(() => localStorage),

        partialize: (state) => ({
          user: state.user,
        }),

        onRehydrateStorage: () => (state) => {
          if (state) {
            state.isAuthenticated = state.user !== null;

            state.initialize();
          }
        },
      }
    ),
    {
      name: "AuthStore",
      enabled: import.meta.env.DEV,
    }
  )
);

export const useAuthUser = () => useAuthStore((state) => state.user);
export const useIsAuthenticated = () =>
  useAuthStore((state) => state.isAuthenticated);
export const useAuthInitialized = () =>
  useAuthStore((state) => state.isInitialized);
export const useAuthLoading = () => useAuthStore((state) => state.loading);

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
