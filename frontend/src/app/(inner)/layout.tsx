import { InnerLayout } from "@/components/InnerLayout";

/**
 * (inner)/layout.tsx — shared layout for all inner pages.
 * Applied automatically to pages inside (inner)/ route group.
 */
export default function InnerGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <InnerLayout>{children}</InnerLayout>;
}
