"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Navbar() {
  const pathname = usePathname();

  const linkStyle = (path: string) =>
    pathname === path ? "text-white" : "text-zinc-400";

  return (
    <nav className="flex items-center justify-between border-b border-zinc-800 px-6 py-4">
      <div className="text-lg font-bold">HoopEdge</div>

      <div className="flex gap-6 text-sm">
        <Link href="/" className={`${linkStyle("/")} hover:text-white`}>
          Home
        </Link>

        <Link href="/props" className={`${linkStyle("/props")} hover:text-white`}>
          Props
        </Link>

        <Link href="/injuries" className={`${linkStyle("/injuries")} hover:text-white`}>
          Injuries
        </Link>

        {/* 🔥 NEW LINK */}
        <Link href="/saved" className={`${linkStyle("/saved")} hover:text-white`}>
          Saved
        </Link>
      </div>
    </nav>
  );
}