"use client";

import React, { useState } from "react";

export interface ClientCounterProps {
  initialCount?: number;
  children?: React.ReactNode;
}

/**
 * Client Component example for RSC boundary.
 * Marked with "use client" directive — renders on client with full interactivity,
 * React hooks, and state management.
 */
export function ClientCounter({ initialCount = 0, children }: ClientCounterProps) {
  const [count, setCount] = useState(initialCount);

  return (
    <div className="client-boundary p-4 rounded-lg border border-blue-500/20 bg-blue-500/5 my-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300">
          Client Component (&quot;use client&quot;)
        </span>
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
        Interactive client boundary component. Manages state and handles user interaction.
      </p>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setCount((c) => c + 1)}
          className="px-3 py-1.5 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors cursor-pointer"
        >
          Count: {count}
        </button>
        <button
          type="button"
          onClick={() => setCount(0)}
          className="px-2 py-1.5 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 cursor-pointer"
        >
          Reset
        </button>
      </div>
      {children && (
        <div className="mt-4 pt-3 border-t border-blue-500/10">
          {children}
        </div>
      )}
    </div>
  );
}

export default ClientCounter;
