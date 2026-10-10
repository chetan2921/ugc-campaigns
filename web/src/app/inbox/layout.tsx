import { RequireRole } from "@/components/require-role";

export default function InboxLayout({ children }: { children: React.ReactNode }) {
  return <RequireRole>{children}</RequireRole>;
}
