import type { ReactNode } from "react";
import Link from "next/link";

export default function AuthLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-gray-50 dark:bg-gray-950 p-4">
      <div className="w-full max-w-md bg-white dark:bg-gray-900 shadow-md rounded-lg p-6 border border-gray-200 dark:border-gray-800">
        <div className="mb-6 text-center">
          <Link href="/" className="text-xl font-bold">
            Lumen Authentication
          </Link>
          <p className="text-sm text-gray-500 mt-1">Sign in to your account</p>
        </div>
        {children}
      </div>
    </div>
  );
}
