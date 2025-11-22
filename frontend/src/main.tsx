import { StrictMode, Suspense, lazy, type ComponentType } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@/components/ThemeProvider';
import App from './App';
import './index.css';

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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <BrowserRouter basename={import.meta.env.BASE_URL}>

          <App />
        </BrowserRouter>
      </ThemeProvider>

      {import.meta.env.DEV && (
        <Suspense fallback={null}>
          <ReactQueryDevtoolsLazy initialIsOpen={false} />
        </Suspense>
      )}
    </QueryClientProvider>
  </StrictMode>
);
