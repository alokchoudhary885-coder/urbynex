import type { Metadata } from "next";
import "./globals.css";

/**
 * Root layout — Urbynex Smart City Digital Twin
 *
 * The main dashboard page (/) uses DashboardLayout (Sidebar + TopNav + BottomAnalytics).
 * Other pages (/simulations, /compare, /ai, /scenarios, /data, /cities) use their own layout
 * with the legacy NavBar still available if imported directly.
 */
export const metadata: Metadata = {
  title: "Urbynex — Smart City Digital Twin",
  description:
    "AI-Powered Multi-City Smart City Digital Twin & Traffic Simulation Platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body
        className="antialiased h-full"
        style={{ background: "#06111C", color: "#EAF3F8" }}
      >
        {children}
      </body>
    </html>
  );
}
