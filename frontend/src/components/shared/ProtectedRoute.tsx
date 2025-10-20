import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useIsAuthenticated, useAuthInitialized } from '@/stores/authStore';

/**
 * ProtectedRoute Component
 * 
 * Architectural Purpose:
 * - Implements route-level authentication guard
 * - Enforces authorization boundaries declaratively
 * - Preserves intended destination for post-auth redirect
 * - Provides loading states during auth initialization
 * 
 * Design Pattern: Higher-Order Component (HOC)
 * - Wraps protected content with auth checks
 * - Transparent to child components (no prop drilling)
 * - Centralizes authentication logic
 * - Composable with other route guards if needed
 * 
 * State Management Integration:
 * - Subscribes to Zustand auth store (not Context)
 * - Granular subscriptions (only re-renders on relevant changes)
 * - isAuthenticated: Triggers on auth status change
 * - initialized: Triggers when initialization completes
 * 
 * Performance Characteristics:
 * - Minimal re-renders (selective subscriptions)
 * - No context provider overhead
 * - Direct store access
 * - O(1) state lookup
 * 
 * Security Considerations:
 * - Binary decision: authenticated or not
 * - No token validation here (handled by authService)
 * - Loading state prevents premature route rendering
 * - Backend validates tokens on every protected API request
 */

interface ProtectedRouteProps {
    children: ReactNode;
    fallback?: ReactNode; // Optional custom fallback during loading
    redirectTo?: string; // Optional custom redirect path
}

export function ProtectedRoute({
    children,
    fallback,
    redirectTo = '/login'
}: ProtectedRouteProps) {
    /**
     * Zustand Store Subscriptions
     * 
     * Design Decision: Granular selectors
     * - Each useXxx hook creates separate subscription
     * - Component only re-renders when subscribed values change
     * - Better performance than selecting entire store
     * 
     * Implementation Details:
     * - useIsAuthenticated: Returns state.isAuthenticated (boolean)
     * - useAuthInitialized: Returns state.isInitialized (boolean)
     * - Both are computed values in the store
     * - Changes propagate instantly to all subscribers
     * 
     * Why Not useAuthStore() directly?
     * - Avoids re-rendering on unrelated state changes
     * - e.g., loading state change doesn't trigger re-render
     * - Follows React optimization best practices
     * - Cleaner component code
     */
    const isAuthenticated = useIsAuthenticated();
    const initialized = useAuthInitialized();
    const location = useLocation();

    /**
     * Loading State: Auth Initialization
     * 
     * Critical Path Analysis:
     * 1. App mounts → useAuthInitialization runs
     * 2. Zustand checks localStorage for tokens
     * 3. If tokens exist, validate against API
     * 4. Update initialized flag
     * 5. ProtectedRoute re-renders
     * 6. Proceed to authentication check
     * 
     * Why This Matters:
     * - Prevents flash of login page for valid users
     * - User might have valid session in localStorage
     * - Need to verify tokens before deciding route access
     * - Better UX than immediate redirect
     * 
     * Design Trade-off:
     * - Could show nothing (jarring)
     * - Could show content (security risk)
     * - Loading indicator balances security and UX
     * 
     * Customization Pattern:
     * - Consumers can provide fallback prop
     * - Allows branded loading experiences
     * - Falls back to default spinner
     * - Maintains consistent behavior
     */
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

    /**
     * Authentication Check
     * 
     * Decision Logic:
     * - initialized === true (guaranteed by above guard)
     * - isAuthenticated === true → render children
     * - isAuthenticated === false → redirect to login
     * 
     * Redirect Strategy:
     * - Store current location in navigation state
     * - After login, redirect back to intended destination
     * - Preserves query parameters and hash
     * - React Router native state mechanism (type-safe)
     * 
     * Location State Structure:
     * {
     *   from: {
     *     pathname: '/protected-page',
     *     search: '?query=value',
     *     hash: '#section',
     *     state: { ... }
     *   }
     * }
     * 
     * Login Component Usage:
     * const location = useLocation();
     * const from = location.state?.from?.pathname || '/';
     * navigate(from, { replace: true });
     * 
     * Security Note:
     * - Only check isAuthenticated (simple boolean)
     * - Don't expose auth failure reasons to client
     * - Backend validates actual permissions
     * - This is UI-level guard only
     */
    if (!isAuthenticated) {
        return (
            <Navigate
                to={redirectTo}
                state={{ from: location }}
                replace
            />
        );
    }

    /**
     * Authorized Access
     * 
     * Render Strategy:
     * - Fragment wrapper (no extra DOM nodes)
     * - Children render exactly as if unprotected
     * - Zero performance overhead
     * - Route guards invisible to protected components
     * 
     * Why Fragment?
     * - Preserves React tree structure
     * - No unnecessary divs
     * - No style implications
     * - Clean component output
     * 
     * Alternative (rejected):
     * Could return children directly
     * - Less explicit
     * - Harder to add wrapper logic later
     * - Fragment is idiomatic React
     */
    return <>{children}</>;
}

/**
 * Convenience Wrapper: RequireAuth
 * 
 * Alternative API for inline route protection
 * Syntactic sugar for the same functionality
 * 
 * Usage Pattern:
 * 
 * // Option 1: ProtectedRoute component
 * <Route 
 *   path="/dashboard" 
 *   element={
 *     <ProtectedRoute>
 *       <Dashboard />
 *     </ProtectedRoute>
 *   } 
 * />
 * 
 * // Option 2: RequireAuth alias (more concise)
 * <Route 
 *   path="/dashboard" 
 *   element={<RequireAuth><Dashboard /></RequireAuth>} 
 * />
 * 
 * Design Rationale:
 * - Provides familiar API for developers from other frameworks
 * - RequireAuth name is self-documenting
 * - No implementation duplication (same component)
 * - Choose based on team preference
 */
export const RequireAuth = ProtectedRoute;

/**
 * Architectural Notes: Why This Design?
 * 
 * 1. Separation of Concerns
 *    - ProtectedRoute: Authorization boundary
 *    - authStore: Authentication state
 *    - authService: API communication
 *    - Each layer has single responsibility
 * 
 * 2. Performance Optimization
 *    - Granular Zustand subscriptions
 *    - Component only re-renders on relevant changes
 *    - No context provider re-render cascade
 *    - Efficient state lookup (O(1))
 * 
 * 3. Developer Experience
 *    - Simple, declarative API
 *    - Type-safe (TypeScript enforced)
 *    - Easy to test (no provider mocking)
 *    - Obvious behavior (guard pattern)
 * 
 * 4. Scalability
 *    - Easy to add role-based access control
 *    - Can compose with other guards
 *    - Supports custom loading states
 *    - Flexible redirect logic
 * 
 * 5. Security
 *    - Client-side guard only (UX layer)
 *    - Backend validates all requests
 *    - No sensitive logic in frontend
 *    - Clear security boundaries
 * 
 * Future Enhancements:
 * - Role-based access: <ProtectedRoute roles={['admin']}>
 * - Permission checks: <ProtectedRoute permissions={['edit:posts']}>
 * - Feature flags: <ProtectedRoute feature="beta-dashboard">
 * - Audit logging: Track access attempts
 * - Rate limiting: Prevent brute force navigation
 */