import { RequireRole } from "@/components/require-role";

export default function BrandLayout({ children }: { children: React.ReactNode }) {
  return <RequireRole role="brand">{children}</RequireRole>;
}
