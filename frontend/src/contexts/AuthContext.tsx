import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { authService, type UserProfile, type RegisterData, type LoginData } from '../services/authService';

/**
 * Authentication Context
 * 
 * Provides global authentication state to React component tree
 * 
 * Design Pattern: Context + Custom Hook
 * - Centralizes auth state management
 * - Prevents prop drilling
 * - Enables easy auth checks in any component
 * 
 * State Management:
 * - user: Current user profile or null
 * - loading: True during async auth operations
 * - initialized: True after initial auth check completes
 */

interface AuthContextValue {
    user: UserProfile | null;
    loading: boolean;
    initialized: boolean;
    login: (data: LoginData) => Promise<void>;
    register: (data: RegisterData) => Promise<{ message: string; userSub: string }>;
    logout: () => Promise<void>;
    refreshUser: () => Promise<void>;
    isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

interface AuthProviderProps {
    children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
    const [user, setUser] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(false);
    const [initialized, setInitialized] = useState(false);

    /**
     * Initialize auth state on mount
     * Checks if user has valid session and loads profile
     */
    useEffect(() => {
        const initAuth = async () => {
            try {
                // Check if user has valid tokens
                if (authService.isAuthenticated()) {
                    // Try to load cached profile first (instant)
                    const cached = authService.getCachedUserProfile();
                    if (cached) {
                        setUser(cached);
                    }

                    // Fetch fresh profile from API
                    try {
                        const profile = await authService.getCurrentUser();
                        setUser(profile);
                    } catch (error) {
                        // If API call fails, clear invalid session
                        console.error('Failed to load user profile:', error);
                        setUser(null);
                    }
                }
            } catch (error) {
                console.error('Auth initialization error:', error);
            } finally {
                setInitialized(true);
            }
        };

        initAuth();
    }, []);

    /**
     * Login user
     */
    const login = async (data: LoginData) => {
        setLoading(true);
        try {
            const profile = await authService.login(data);
            setUser(profile);
        } finally {
            setLoading(false);
        }
    };

    /**
     * Register new user
     */
    const register = async (data: RegisterData) => {
        setLoading(true);
        try {
            return await authService.register(data);
        } finally {
            setLoading(false);
        }
    };

    /**
     * Logout user
     */
    const logout = async () => {
        setLoading(true);
        try {
            await authService.logout();
            setUser(null);
        } finally {
            setLoading(false);
        }
    };

    /**
     * Refresh user profile from API
     */
    const refreshUser = async () => {
        if (!authService.isAuthenticated()) {
            setUser(null);
            return;
        }

        try {
            const profile = await authService.getCurrentUser();
            setUser(profile);
        } catch (error) {
            console.error('Failed to refresh user:', error);
            setUser(null);
        }
    };

    const value: AuthContextValue = {
        user,
        loading,
        initialized,
        login,
        register,
        logout,
        refreshUser,
        isAuthenticated: user !== null,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Custom hook to access auth context
 * Throws error if used outside AuthProvider
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}