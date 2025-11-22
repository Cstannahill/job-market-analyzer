import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { authService, type UserProfile, type RegisterData, type LoginData } from '../services/authService';

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

    useEffect(() => {
        const initAuth = async () => {
            try {
                if (authService.isAuthenticated()) {
                    const cached = authService.getCachedUserProfile();
                    if (cached) {
                        setUser(cached);
                    }

                    try {
                        const profile = await authService.getCurrentUser();
                        setUser(profile);
                    } catch (error) {
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


    const login = async (data: LoginData) => {
        setLoading(true);
        try {
            const profile = await authService.login(data);
            setUser(profile);
        } finally {
            setLoading(false);
        }
    };


    const register = async (data: RegisterData) => {
        setLoading(true);
        try {
            return await authService.register(data);
        } finally {
            setLoading(false);
        }
    };

    const logout = async () => {
        setLoading(true);
        try {
            await authService.logout();
            setUser(null);
        } finally {
            setLoading(false);
        }
    };


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


// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}