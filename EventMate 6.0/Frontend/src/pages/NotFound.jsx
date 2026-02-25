import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <section className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-gray-900 p-8 shadow-sm text-center">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Page not found</h2>
        <p className="mt-2 text-gray-600 dark:text-gray-300">The page you are looking for does not exist.</p>
        <Link
          className="mt-5 inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
          to="/"
        >
          Go Home
        </Link>
      </div>
    </section>
  );
}
