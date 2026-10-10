import { RequireRole } from "@/components/require-role";

export default function CreatorLayout({ children }: { children: React.ReactNode }) {
  return <RequireRole role="creator">{children}</RequireRole>;
}
