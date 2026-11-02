"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * InnerLayout.tsx — Sub-layout for inner pages (/simulations, /ai, /compare, etc.)
 * Provides a compact top nav + scrollable content area within the command-center style.
 */

const NAV_LINKS = [
  { href: "/",            label: "⬡ Dashboard"  },
  { href: "/cities",      label: "🗺 Cities"     },
  { href: "/simulations", label: "⚙ Simulations" },
  { href: "/scenarios",   label: "🎲 Scenarios"  },
  { href: "/compare",     label: "⚖ Compare"    },
  { href: "/data",        label: "📊 Data"       },
  { href: "/ai",          label: "🤖 AI Copilot" },
];

export function InnerLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#06111C" }}>
      {/* Top bar */}
      <nav
        className="flex items-center gap-6 px-4 h-12 sticky top-0 z-40 flex-shrink-0"
        style={{ background: "#081827", borderBottom: "1px solid #1B3445" }}
      >
        <Link href="/" className="font-black text-sm tracking-wide mr-2" style={{ color: "#00B8D9" }}>
          URBYNEX
        </Link>
        {NAV_LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="text-xs font-medium transition-colors"
            style={{ color: pathname === l.href ? "#00B8D9" : "#8DA5B5" }}
          >
            {l.label}
          </Link>
        ))}
        <div className="flex-1" />
        <span className="text-[9px] font-mono" style={{ color: "#1B3445" }}>v1.0.0-dev</span>
      </nav>
      {/* Content */}
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
