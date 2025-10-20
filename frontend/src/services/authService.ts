/**
 * Authentication Service
 *
 * Architectural Responsibilities:
 * - Manages authentication state in browser (tokens, user data)
 * - Provides React-friendly API for auth operations
 * - Handles token refresh and automatic re-authentication
 * - Centralized error handling for auth failures
 *
 * Storage Strategy:
 * - Access tokens: Memory (short-lived, lost on refresh)
 * - Refresh tokens: localStorage (persistent across sessions)
 * - User profile: Memory + optional localStorage cache
 *
 * Security Considerations:
 * - Never log tokens
 * - Clear sensitive data on logout
 * - Validate token expiration before API calls
 * - Use httpOnly cookies in production (requires backend changes)
 */

const API_BASE_URL =
  import.meta.env.VITE_AUTH_API_URL ||
  "https://your-api-gateway-url.execute-api.us-east-1.amazonaws.com";

interface AuthTokens {
  idToken: string;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
}

interface UserProfile {
  userId: string;
  email: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
  preferences?: {
    emailNotifications: boolean;
    theme: "light" | "dark";
  };
  resumeUploaded?: boolean;
  savedSearches?: string[];
}

interface RegisterData {
  email: string;
  password: string;
  name?: string;
}

interface LoginData {
  email: string;
  password: string;
}

interface ApiError {
  error: string;
  message: string;
}

// Token storage keys
const STORAGE_KEYS = {
  ACCESS_TOKEN: "auth_access_token",
  REFRESH_TOKEN: "auth_refresh_token",
  ID_TOKEN: "auth_id_token",
  TOKEN_EXPIRY: "auth_token_expiry",
  USER_PROFILE: "auth_user_profile",
} as const;

class AuthService {
  private accessToken: string | null = null;
  private idToken: string | null = null;
  private tokenExpiry: number | null = null;

  constructor() {
    // Restore tokens from localStorage on initialization
    this.restoreSession();
  }

  /**
   * Restore authentication session from localStorage
   * Called on app initialization
   */
  private restoreSession(): void {
    try {
      this.accessToken = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
      this.idToken = localStorage.getItem(STORAGE_KEYS.ID_TOKEN);
      const expiry = localStorage.getItem(STORAGE_KEYS.TOKEN_EXPIRY);
      this.tokenExpiry = expiry ? parseInt(expiry, 10) : null;

      // Clear expired tokens
      if (this.tokenExpiry && Date.now() >= this.tokenExpiry) {
        this.clearSession();
      }
    } catch (error) {
      console.error("Failed to restore session:", error);
      this.clearSession();
    }
  }

  /**
   * Store tokens in memory and localStorage
   */
  private storeTokens(tokens: AuthTokens): void {
    this.accessToken = tokens.accessToken;
    this.idToken = tokens.idToken;
    this.tokenExpiry = Date.now() + tokens.expiresIn * 1000;

    try {
      if (this.idToken) {
        console.log("");
      }
      localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, tokens.accessToken);
      localStorage.setItem(STORAGE_KEYS.ID_TOKEN, tokens.idToken);
      localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, tokens.refreshToken);
      localStorage.setItem(
        STORAGE_KEYS.TOKEN_EXPIRY,
        this.tokenExpiry.toString()
      );
    } catch (error) {
      console.error("Failed to store tokens:", error);
    }
  }

  /**
   * Clear all authentication data
   */
  private clearSession(): void {
    this.accessToken = null;
    this.idToken = null;
    this.tokenExpiry = null;

    try {
      Object.values(STORAGE_KEYS).forEach((key) => {
        localStorage.removeItem(key);
      });
    } catch (error) {
      console.error("Failed to clear session:", error);
    }
  }

  /**
   * Get current access token
   * Returns null if token is expired or doesn't exist
   */
  public getAccessToken(): string | null {
    if (!this.accessToken || !this.tokenExpiry) {
      return null;
    }

    // Check if token is expired (with 1 minute buffer)
    if (Date.now() >= this.tokenExpiry - 60000) {
      return null;
    }

    return this.accessToken;
  }

  /**
   * Check if user is authenticated
   */
  public isAuthenticated(): boolean {
    return this.getAccessToken() !== null;
  }

  /**
   * Register a new user
   */
  public async register(
    data: RegisterData
  ): Promise<{ message: string; userSub: string }> {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        const error = result as ApiError;
        throw new Error(error.message || "Registration failed");
      }

      return result;
    } catch (error) {
      console.error("Registration error:", error);
      throw error;
    }
  }

  /**
   * Login user with email and password
   */
  public async login(data: LoginData): Promise<UserProfile> {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();
      console.log("Login response:", result);
      if (!response.ok) {
        const error = result as ApiError;
        throw new Error(error.message || "Login failed");
      }

      const tokens = result as AuthTokens;
      this.storeTokens(tokens);

      // Fetch and return user profile
      return await this.getCurrentUser();
    } catch (error) {
      console.error("Login error:", error);
      throw error;
    }
  }

  /**
   * Get current authenticated user profile
   */
  public async getCurrentUser(): Promise<UserProfile> {
    const token = this.getAccessToken();

    if (!token) {
      throw new Error("Not authenticated");
    }

    try {
      const response = await fetch(`${API_BASE_URL}/auth/me`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      const result = await response.json();

      if (!response.ok) {
        // If unauthorized, clear session
        if (response.status === 401) {
          this.clearSession();
        }
        const error = result as ApiError;
        throw new Error(error.message || "Failed to fetch user profile");
      }

      const profile = result as UserProfile;

      // Cache profile in localStorage
      try {
        localStorage.setItem(
          STORAGE_KEYS.USER_PROFILE,
          JSON.stringify(profile)
        );
      } catch (error) {
        console.error("Failed to cache user profile:", error);
      }

      return profile;
    } catch (error) {
      console.error("Get current user error:", error);
      throw error;
    }
  }

  /**
   * Get cached user profile (no API call)
   * Returns null if no cached profile exists
   */
  public getCachedUserProfile(): UserProfile | null {
    try {
      const cached = localStorage.getItem(STORAGE_KEYS.USER_PROFILE);
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  }

  /**
   * Logout user
   */
  public async logout(): Promise<void> {
    const token = this.getAccessToken();

    try {
      if (token) {
        await fetch(`${API_BASE_URL}/auth/logout`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        });
      }
    } catch (error) {
      // Log error but continue with local logout
      console.error("Server logout error:", error);
    } finally {
      // Always clear local session
      this.clearSession();
    }
  }

  /**
   * Verify email with confirmation code
   */
  public async verifyEmail(
    email: string,
    code: string
  ): Promise<{ message: string }> {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/verify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          code,
          action: "verify",
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        const error = result as ApiError;
        throw new Error(error.message || "Email verification failed");
      }

      return result;
    } catch (error) {
      console.error("Email verification error:", error);
      throw error;
    }
  }

  /**
   * Resend verification code
   */
  public async resendVerificationCode(
    email: string
  ): Promise<{ message: string }> {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/verify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          action: "resend",
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        const error = result as ApiError;
        throw new Error(error.message || "Failed to resend verification code");
      }

      return result;
    } catch (error) {
      console.error("Resend verification error:", error);
      throw error;
    }
  }

  /**
   * Refresh access token using refresh token
   * Note: Requires additional API endpoint implementation
   */
  public async refreshToken(): Promise<boolean> {
    const refreshToken = localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);

    if (!refreshToken) {
      return false;
    }

    try {
      // TODO: Implement refresh token endpoint
      // This would call Cognito's InitiateAuth with REFRESH_TOKEN_AUTH flow
      console.warn("Token refresh not yet implemented");
      return false;
    } catch (error) {
      console.error("Token refresh error:", error);
      this.clearSession();
      return false;
    }
  }
}

// Export singleton instance
export const authService = new AuthService();
export type { UserProfile, RegisterData, LoginData };
