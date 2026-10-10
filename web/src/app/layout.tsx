import type { Metadata } from "next";
import { IBM_Plex_Sans } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const plex = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Campaigns",
  description: "Paid Instagram campaigns for brands and creators.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-IN" className={`${plex.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <TooltipProvider>
          {children}
          <Toaster position="top-center" theme="light" />
        </TooltipProvider>
      </body>
    </html>
  );
}
