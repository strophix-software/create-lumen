import React from "react";
import { ClientCounter } from "./ClientCounter";

/**
 * Server Component example for RSC boundary.
 * Renders on the server by default (zero client-side bundle impact).
 * Demonstrates composing a Client Component across the RSC boundary.
 * Compatible with both Next.js App Router and Pages Router.
 */
export function ServerCard({
  title = "Server Component Shell",
  serverMessage = "Rendered on the server with zero client bundle overhead for this card frame.",
}) {
  return (
    <div className="server-boundary p-6 rounded-xl border border-emerald-500/20 bg-emerald-500/5 my-4">
      <div className="flex items-center justify-between mb-3">
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300">
          Server Component (Default RSC)
        </span>
      </div>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
        {title}
      </h3>
      <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
        {serverMessage}
      </p>
      <div className="p-4 rounded-lg border border-dashed border-emerald-500/30 bg-white/40 dark:bg-black/20">
        <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider mb-2">
          Server / Client Boundary
        </p>
        <ClientCounter initialCount={0}>
          <p className="text-xs text-gray-500 dark:text-gray-400 italic">
            Server-rendered child passed through client component boundary.
          </p>
        </ClientCounter>
      </div>
    </div>
  );
}

export default ServerCard;
