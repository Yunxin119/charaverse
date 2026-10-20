import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Fraunces } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/providers/AuthProvider";
import { QueryProvider } from "@/providers/QueryProvider";
import { ThemeProvider, ThemeScript } from "./contexts/ThemeContext";
import { AppShell } from "@/components/shell";
import { ThemeSync } from "@/components/theme/ThemeSync";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const fraunces = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: { default: "CharaVerse", template: "%s · CharaVerse" },
  description: "创建、聊天、分享属于你的 AI 角色。",
  icons: { icon: "/favicon.ico", apple: "/icons/icon-192x192.png" },
  formatDetection: { telephone: false },
  openGraph: {
    type: "website",
    siteName: "CharaVerse",
    title: "CharaVerse",
    description: "创建、聊天、分享属于你的 AI 角色。",
    images: [{ url: "/icons/icon-512x512.png", width: 512, height: 512, alt: "CharaVerse" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f2dece" },
    { media: "(prefers-color-scheme: dark)", color: "#1c1410" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} antialiased`}>
        <ThemeProvider>
          <QueryProvider>
            <AuthProvider>
              <ThemeSync />
              <AppShell>{children}</AppShell>
            </AuthProvider>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
