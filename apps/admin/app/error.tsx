'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-md text-center">
        <h1 className="text-2xl font-bold mb-2">Something went wrong</h1>
        <p className="text-gray-600 mb-6">
          The error has been reported. Try again, or reload the page if it keeps happening.
        </p>
        <button
          onClick={reset}
          className="bg-gray-900 text-white rounded-md px-6 py-2 font-medium hover:bg-gray-700"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
