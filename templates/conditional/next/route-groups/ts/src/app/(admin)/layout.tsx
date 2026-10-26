import type { ReactNode } from "react";
import Link from "next/link";

export default function AdminLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-red-700 text-white px-6 py-3 flex items-center justify-between text-sm">
        <div className="font-semibold flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-white animate-pulse" />
          Admin Panel (Restricted Access)
        </div>
        <nav className="flex gap-4">
          <Link href="/admin" className="underline hover:no-underline">
            Management
          </Link>
          <Link href="/dashboard" className="underline hover:no-underline">
            Exit to Dashboard
          </Link>
        </nav>
      </header>
      <main className="flex-1 p-8 bg-gray-100 dark:bg-gray-900">{children}</main>
    </div>
  );
}
