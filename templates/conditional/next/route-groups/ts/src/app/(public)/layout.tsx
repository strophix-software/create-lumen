import type { ReactNode } from "react";
import Link from "next/link";

export default function PublicLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b px-6 py-4 flex items-center justify-between">
        <div className="font-bold text-lg">
          <Link href="/">Lumen App</Link>
        </div>
        <nav className="flex gap-4 text-sm">
          <Link href="/login" className="hover:underline">
            Sign In
          </Link>
          <Link href="/dashboard" className="hover:underline">
            Dashboard
          </Link>
          <Link href="/admin" className="hover:underline">
            Admin
          </Link>
        </nav>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t px-6 py-4 text-center text-sm text-gray-500">
        Public Area &copy; {new Date().getFullYear()}
      </footer>
    </div>
  );
}
