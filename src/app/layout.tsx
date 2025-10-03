import { Outfit } from "next/font/google";
import "./globals.css";

import { SidebarProvider } from "@/context/SidebarContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { AuthProvider } from "@/context/AuthContext";
import { Toaster as UIToaster } from "@/components/ui/toaster";
import { Toaster } from "sonner";
import { SupabaseProvider } from '@/context/SupabaseProvider'

const outfit = Outfit({
  variable: "--font-outfit-sans",
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${outfit.variable} dark:bg-gray-900`}>
        <ThemeProvider>
          <AuthProvider>
            <SupabaseProvider>
              <SidebarProvider>{children}</SidebarProvider>
            </SupabaseProvider>
          </AuthProvider>
        </ThemeProvider>
        <UIToaster />
        <Toaster />
      </body>
    </html>
  );
}
