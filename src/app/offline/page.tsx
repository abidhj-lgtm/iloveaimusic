import Link from "next/link";
import { WifiOff, Home, RefreshCw } from "lucide-react";

export const metadata = {
  title: "You're offline",
  robots: { index: false, follow: false },
};

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-[#0a0712]">
      <div className="max-w-md text-center w-full">
        <div className="mb-6 text-[#fbbf24] flex justify-center">
          <WifiOff size={56} />
        </div>
        <h1 className="text-3xl font-bold mb-4 text-[#f4efff]">You're offline</h1>
        <p className="text-lg text-gray-400 mb-8 leading-relaxed">
          No internet connection. Don't worry — your music is safe. Reconnect to pick up where you left off.
        </p>
        <div className="text-left bg-[#1a1625] p-6 rounded-xl border border-[#2a2635] mb-6">
          <h2 className="text-base font-semibold mb-3 text-[#f4efff]">What you can still do:</h2>
          <ul className="list-none p-0 m-0 flex flex-col gap-2 text-gray-300 text-sm">
            <li>• Browse tracks you've already loaded</li>
            <li>• Read lyrics and prompts from cached pages</li>
            <li>• Your likes and comments will sync when you're back online</li>
          </ul>
        </div>
        <div className="flex flex-col gap-3">
          <Link
            href="/"
            className="flex items-center justify-center gap-2 p-3 bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg text-white font-semibold no-underline transition-opacity hover:opacity-90"
          >
            <Home size={18} /> Back to the feed
          </Link>
          <a
            href="/"
            className="flex items-center justify-center gap-2 p-3 bg-[#252130] border border-[#2a2635] rounded-lg text-[#f4efff] font-semibold transition-colors hover:bg-[#302b3a] cursor-pointer no-underline"
          >
            <RefreshCw size={18} /> Try again
          </a>
        </div>
      </div>
    </div>
  );
}