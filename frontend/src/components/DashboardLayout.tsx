"use client";

import React from "react";
import { Sidebar } from "@/components/Sidebar";
import { TopNav } from "@/components/TopNav";
import { BottomAnalytics } from "@/components/panels/BottomAnalytics";

/**
 * DashboardLayout.tsx
 * Full-screen command-center layout wrapping the main dashboard page.
 * Sidebar (fixed left 56px) + TopNav (fixed top 48px) + BottomAnalytics (fixed bottom 100px).
 */

interface DashboardLayoutProps {
  children: React.ReactNode;
  networkId?: string;
  selectedCity?: string;
  onCityChange?: (city: string) => void;
  cities?: string[];
}

export function DashboardLayout({
  children,
  networkId = "jaipur_v1",
  selectedCity = "Jaipur",
  onCityChange,
  cities = ["Jaipur", "Delhi", "Bengaluru"],
}: DashboardLayoutProps) {
  return (
    <div
      className="h-screen w-screen overflow-hidden"
      style={{ background: "#06111C" }}
    >
      {/* Left sidebar */}
      <Sidebar />

      {/* Top navigation */}
      <TopNav
        selectedCity={selectedCity}
        onCityChange={onCityChange}
        cities={cities}
      />

      {/* Main content area — offset by sidebar + topnav + bottom strip */}
      <div
        className="absolute overflow-hidden"
        style={{
          left: "56px",
          top: "48px",
          right: 0,
          bottom: "100px",
        }}
      >
        {children}
      </div>

      {/* Bottom analytics */}
      <BottomAnalytics networkId={networkId} />
    </div>
  );
}
