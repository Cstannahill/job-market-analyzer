import { StrictMode, Suspense, lazy, type ComponentType } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@/components/ThemeProvider';
import App from './App';
import './index.css';

/**
 * Application Entry Point
 * 
 * Architectural Overview:
 * This file establishes the foundational layer of the application,
 * setting up critical infrastructure before any business logic executes.
 * 
 * Provider Hierarchy (Outside → Inside):
 * 
 * 1. StrictMode (Development Safety)
 *    └─ Detects potential problems in application
 *       Warns about deprecated APIs and unsafe lifecycle methods
 *       Double-renders components to find side effects
 * 
 * 2. QueryClientProvider (Server State Management)
 *    └─ Manages cache for server data
 *       Handles request deduplication
 *       Automatic background refetching
 *       Independent of client state (Zustand)
 * 
 * 3. ThemeProvider (UI State Management)
 *    └─ Controls light/dark mode
 *       Persists theme preference
 *       No dependency on auth or data
 * 
 * 4. BrowserRouter (Client-Side Routing)
 *    └─ Enables SPA navigation without page reloads
 *       Provides useNavigate, useLocation hooks
 *       Required by <Link> components
 * 
 * 5. App Component (Business Logic)
 *    └─ Orchestrates auth initialization via Zustand
 *       Defines route structure
 *       Handles protected route logic
 * 
 * Notable Absence: AuthProvider (Context)
 * 
 * Design Decision: Zustand instead of Context
 * 
 * Previous Architecture (Context-based):
 * <AuthProvider>    ← Wrapper component needed
 *   <App />         ← Can use useAuth()
 * </AuthProvider>
 * 
 * New Architecture (Zustand-based):
 * <App />           ← No wrapper needed!
 * └─ useAuthStore() ← Direct import anywhere
 * 
 * Benefits of This Approach:
 * - No provider nesting complexity
 * - No "must be used within" errors
 * - Works outside React components (services, utils)
 * - Better performance (selective subscriptions)
 * - Simpler testing (no provider mocking)
 * - Cleaner main.tsx (fewer layers)
 * 
 * State Management Architecture:
 * 
 * Client State (Zustand):
 * - User profile
 * - Auth status
 * - Application preferences
 * - UI state (modals, etc.)
 * 
 * Server State (React Query):
 * - Job postings
 * - Trends data
 * - API responses
 * - Real-time data
 * 
 * Local State (useState):
 * - Form inputs
 * - Component UI state
 * - Temporary values
 * 
 * Design Principle: Right tool for the right job
 * Each state management tool handles what it does best.
 */

/**
 * React Query Configuration
 * 
 * Design Philosophy: Sensible defaults with escape hatches
 * 
 * Cache Strategy:
 * - 5 min stale time: Balance freshness vs. performance
 * - 30 min GC time: Keep data accessible between page visits
 * - Single retry: Fast failure detection
 * - Manual refetch: Developer controls data freshness
 * 
 * Integration with Zustand:
 * - React Query: Server state (job postings, trends)
 * - Zustand: Client state (user profile, preferences)
 * - Clear boundary: Server data vs. client data
 * - No overlap: Each tool has distinct responsibility
 * 
 * Why Not Use React Query for Auth?
 * - Auth is client state (tokens, user profile)
 * - Needs to work outside React (authService)
 * - Requires synchronous access
 * - Persistence across sessions critical
 * - Zustand better fit for this use case
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 30, // 30 minutes (formerly cacheTime)
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

type DevtoolsProps = {
  initialIsOpen?: boolean;
};

const NoopDevtools: ComponentType<DevtoolsProps> = () => null;

const ReactQueryDevtoolsLazy: ComponentType<DevtoolsProps> =
  import.meta.env.DEV
    ? lazy(() =>
        import('@tanstack/react-query-devtools').then((module) => ({
          default: module.ReactQueryDevtools,
        })),
      )
    : NoopDevtools;

/**
 * Root Render
 * 
 * Execution Flow:
 * 1. React initializes root
 * 2. Providers mount in order (outer to inner)
 * 3. BrowserRouter parses current URL
 * 4. App component mounts
 * 5. useAuthInitialization hook runs
 * 6. Zustand validates session
 * 7. Routes render based on auth state
 * 
 * Performance Characteristics:
 * - Non-blocking initialization (auth check async)
 * - Parallel rendering (don't wait for auth)
 * - Optimistic UI (show cached data immediately)
 * - Progressive enhancement (app usable before auth completes)
 * 
 * Error Boundaries:
 * Consider adding error boundary at this level in production
 * - Catches rendering errors
 * - Provides fallback UI
 * - Prevents white screen of death
 * - Logs errors for monitoring
 */
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <BrowserRouter basename={import.meta.env.BASE_URL}>
          {/* 
            App Component: Single Responsibility
            - Orchestrates auth initialization
            - Defines route structure
            - Handles loading states
            - No business logic here
            
            Why App is separate from main.tsx:
            - Easier testing (mock providers)
            - Cleaner separation of concerns
            - Router hooks available in App
            - Can add error boundaries above App
          */}
          <App />
        </BrowserRouter>
      </ThemeProvider>

      {/* React Query Devtools (development only) */}
      {import.meta.env.DEV && (
        <Suspense fallback={null}>
          <ReactQueryDevtoolsLazy initialIsOpen={false} />
        </Suspense>
      )}
    </QueryClientProvider>
  </StrictMode>
);

/**
 * Migration Notes: Context → Zustand
 * 
 * Removed:
 * - AuthProvider wrapper component
 * - useAuth context hook
 * - Provider nesting complexity
 * - "must be used within" errors
 * 
 * Added:
 * - Zustand authStore
 * - Direct store imports
 * - Selective subscriptions
 * - Outside-React compatibility
 * 
 * Components Update Pattern:
 * 
 * Before (Context):
 * import { useAuth } from '@/contexts/AuthContext';
 * const { user, login, logout } = useAuth();
 * 
 * After (Zustand):
 * import { useAuthUser, useAuthActions } from '@/stores/authStore';
 * const user = useAuthUser();
 * const { login, logout } = useAuthActions();
 * 
 * Benefits:
 * - Granular subscriptions (better performance)
 * - No context provider needed
 * - Works in services/utils
 * - TypeScript inference improved
 * - DevTools integration
 */
