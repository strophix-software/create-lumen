import Link from "next/link";

export default function PrivateLayout({ children }) {
  return (
    <div className="min-h-screen flex">
      <aside className="w-64 border-r bg-gray-50 dark:bg-gray-950 p-6 flex flex-col justify-between">
        <div>
          <div className="font-bold text-lg mb-6">
            <Link href="/dashboard">Private Dashboard</Link>
          </div>
          <nav className="flex flex-col gap-3 text-sm">
            <Link href="/dashboard" className="text-gray-700 dark:text-gray-200 hover:text-black">
              Overview
            </Link>
            <Link href="/settings" className="text-gray-700 dark:text-gray-200 hover:text-black">
              Settings
            </Link>
          </nav>
        </div>
        <div className="text-xs text-gray-400">
          Protected Area &bull; Authenticated
        </div>
      </aside>
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
