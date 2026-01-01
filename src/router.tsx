import { lazy, Suspense } from 'react';
import { createHashRouter, RouterProvider, Navigate } from 'react-router-dom';
import { Dashboard } from './features/dashboard/Dashboard';

/**
 * Lazy load game modules - they won't be downloaded until user navigates to them.
 * This keeps the initial bundle small (just dashboard + shared code).
 */
const WordleGame = lazy(() => import('./games/wordle/WordleGame'));
const BoggleGame = lazy(() => import('./games/boggle/BoggleGame'));

/**
 * Loading fallback shown while game chunk is downloading.
 */
function GameLoadingFallback() {
  return (
    <div className="game-loading">
      <div className="loading-spinner" aria-label="Loading game..." />
    </div>
  );
}

/**
 * Using Hash Router for GitHub Pages compatibility.
 * URLs will be: /#/, /#/wordle, /#/boggle
 */
const router = createHashRouter([
  {
    path: '/',
    element: <Dashboard />,
  },
  {
    path: '/wordle',
    element: (
      <Suspense fallback={<GameLoadingFallback />}>
        <WordleGame />
      </Suspense>
    ),
  },
  {
    path: '/boggle',
    element: (
      <Suspense fallback={<GameLoadingFallback />}>
        <BoggleGame />
      </Suspense>
    ),
  },
  {
    // Catch-all redirect to dashboard
    path: '*',
    element: <Navigate to="/" replace />,
  },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
