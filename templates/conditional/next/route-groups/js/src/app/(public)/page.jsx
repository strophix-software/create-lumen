import Link from "next/link";

export default function PublicPage() {
  return (
    <div className="max-w-4xl mx-auto py-12 px-6">
      <h1 className="text-4xl font-extrabold tracking-tight mb-4">
        Welcome to Route Groups Preset
      </h1>
      <p className="text-lg text-gray-600 mb-8">
        This application is organized using Next.js App Router route groups:
        (public), (auth), (private), and (admin).
      </p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="border rounded-lg p-6 shadow-sm">
          <h2 className="text-xl font-semibold mb-2">Auth Group</h2>
          <p className="text-gray-500 mb-4">Authentication screens and login layouts.</p>
          <Link href="/login" className="text-blue-600 hover:underline">
            Go to Login &rarr;
          </Link>
        </div>
        <div className="border rounded-lg p-6 shadow-sm">
          <h2 className="text-xl font-semibold mb-2">Private Group</h2>
          <p className="text-gray-500 mb-4">Protected routes guarded by auth proxy middleware.</p>
          <Link href="/dashboard" className="text-blue-600 hover:underline">
            Go to Dashboard &rarr;
          </Link>
        </div>
        <div className="border rounded-lg p-6 shadow-sm">
          <h2 className="text-xl font-semibold mb-2">Admin Group</h2>
          <p className="text-gray-500 mb-4">Elevated management section requiring admin role.</p>
          <Link href="/admin" className="text-blue-600 hover:underline">
            Go to Admin &rarr;
          </Link>
        </div>
      </div>
    </div>
  );
}
