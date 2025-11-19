export type UserThemePreference = "light" | "dark";

export interface UserPreferences {
  emailNotifications: boolean;
  theme: UserThemePreference;
}

export interface UserProfile {
  userId: string;
  email: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
  preferences?: UserPreferences;
  resumeUploaded?: boolean;
  savedSearches?: string[];
}

export interface LoginRequest {
  email: string;
  password: string;
}

export type LoginData = LoginRequest;

export interface AuthTokensResponse {
  idToken: string;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name?: string;
}

export type RegisterData = RegisterRequest;

export type EmailVerificationAction = "verify" | "resend";

export interface EmailVerificationRequest {
  email: string;
  action: EmailVerificationAction;
  code?: string;
}
