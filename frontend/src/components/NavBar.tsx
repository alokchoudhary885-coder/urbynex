"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/cities", label: "Cities" },
  { href: "/scenarios", label: "Scenarios" },
  { href: "/simulations", label: "Simulations" },
  { href: "/compare", label: "Compare" },
];

export function NavBar() {
  const pathname = usePathname();
  return (
    <nav className="h-16 bg-gray-900 border-b border-gray-800 flex items-center px-6 gap-8 sticky top-0 z-50">
      <Link href="/" className="font-bold text-lg text-emerald-400 tracking-tight">
        Urbynex
      </Link>
      <div className="flex gap-6 flex-1">
        {NAV_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`text-sm font-medium transition-colors ${
              pathname === link.href
                ? "text-emerald-400"
                : "text-gray-400 hover:text-gray-100"
            }`}
          >
            {link.label}
          </Link>
        ))}
      </div>
      <span className="text-xs text-gray-600 font-mono">v1.0.0-dev</span>
    </nav>
  );
}
