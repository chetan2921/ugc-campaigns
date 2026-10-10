import { RequireRole } from "@/components/require-role";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return <RequireRole>{children}</RequireRole>;
}
