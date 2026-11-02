"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Sidebar.tsx — Urbynex Command Center Left Sidebar
 * Compact icon-based navigation matching the Dubai Digital Twin reference.
 */

interface NavItem {
  icon: string;
  label: string;
  href: string;
  badge?: string;
}

const NAV_ITEMS: NavItem[] = [
  { icon: "⬡", label: "Overview",          href: "/" },
  { icon: "🚗", label: "Mobility",          href: "/cities" },
  { icon: "🚌", label: "Public Transport",  href: "/cities" },
  { icon: "🏗",  label: "Infrastructure",   href: "/data" },
  { icon: "🌿", label: "Environment",       href: "/" },
  { icon: "⚙",  label: "Simulation",       href: "/simulations" },
  { icon: "⚡", label: "Energy",            href: "/" },
  { icon: "🛡",  label: "Safety & Security",href: "/" },
  { icon: "📈", label: "Economy",           href: "/compare" },
  { icon: "🏙",  label: "Urban Expansion",  href: "/scenarios" },
  { icon: "💡", label: "AI Insights",       href: "/ai", badge: "AI" },
  { icon: "🤖", label: "AI Copilot",        href: "/ai", badge: "NEW" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      className="fixed left-0 top-0 bottom-0 z-40 flex flex-col"
      style={{
        width: "56px",
        background: "#081827",
        borderRight: "1px solid #1B3445",
      }}
    >
      {/* Logo */}
      <div
        className="flex flex-col items-center justify-center py-3 border-b"
        style={{ borderColor: "#1B3445", minHeight: "56px" }}
      >
        <div
          className="w-8 h-8 rounded flex items-center justify-center text-sm font-black"
          style={{ background: "linear-gradient(135deg, #00B8D9, #36C6A0)", color: "#06111C" }}
        >
          U
        </div>
      </div>

      {/* Nav items */}
      <nav className="flex-1 flex flex-col items-center py-2 gap-0.5 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.label}
              href={item.href}
              title={item.label}
              className="relative group flex flex-col items-center justify-center w-full py-2 transition-all"
              style={{
                color: isActive ? "#00B8D9" : "#8DA5B5",
                background: isActive ? "rgba(0,184,217,0.1)" : "transparent",
                borderLeft: isActive ? "2px solid #00B8D9" : "2px solid transparent",
              }}
            >
              <span className="text-base leading-none">{item.icon}</span>
              {item.badge && (
                <span
                  className="absolute top-1 right-1 text-[8px] font-bold px-0.5 rounded"
                  style={{ background: "#00B8D9", color: "#06111C" }}
                >
                  {item.badge}
                </span>
              )}
              {/* Tooltip */}
              <span
                className="absolute left-full ml-2 px-2 py-1 text-[10px] font-medium rounded whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50"
                style={{ background: "#0B1D2B", border: "1px solid #1B3445", color: "#EAF3F8" }}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Version tag */}
      <div
        className="py-3 flex justify-center"
        style={{ borderTop: "1px solid #1B3445" }}
      >
        <span
          className="text-[9px] font-mono"
          style={{ color: "#1B3445" }}
        >
          v1.0
        </span>
      </div>
    </aside>
  );
}
