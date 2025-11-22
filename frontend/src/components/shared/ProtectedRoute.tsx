import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useIsAuthenticated, useAuthInitialized } from '@/stores/authStore';


interface ProtectedRouteProps {
    children: ReactNode;
    fallback?: ReactNode;
    redirectTo?: string;
}

export function ProtectedRoute({
    children,
    fallback,
    redirectTo = '/login'
}: ProtectedRouteProps) {

    const isAuthenticated = useIsAuthenticated();
    const initialized = useAuthInitialized();
    const location = useLocation();


    if (!initialized) {
        return (
            <>
                {fallback || (
                    <div className="flex min-h-screen items-center justify-center">
                        <div className="text-center">
                            <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600"></div>
                            <p className="text-muted-foreground text-sm">Loading...</p>
                        </div>
                    </div>
                )}
            </>
        );
    }


    if (!isAuthenticated) {
        return (
            <Navigate
                to={redirectTo}
                state={{ from: location }}
                replace
            />
        );
    }

    return <>{children}</>;
}


export const RequireAuth = ProtectedRoute;