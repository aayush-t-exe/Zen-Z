'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';
import './globals.css';

// Only fires when the root layout itself throws (error.tsx can't catch
// that — it renders inside the layout). Has to render its own <html>/<body>
// since the real root layout is what crashed.
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-md text-center">
            <h1 className="text-2xl font-bold mb-2">Something went wrong</h1>
            <p className="text-gray-600 mb-6">The error has been reported. Please reload the page.</p>
            <button
              onClick={() => window.location.reload()}
              className="bg-gray-900 text-white rounded-md px-6 py-2 font-medium hover:bg-gray-700"
            >
              Reload
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
