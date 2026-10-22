import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Fraunces } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/providers/AuthProvider";
import { QueryProvider } from "@/providers/QueryProvider";
import { ThemeProvider, ThemeScript } from "./contexts/ThemeContext";
import { AppShell } from "@/components/shell";
import { ThemeSync } from "@/components/theme/ThemeSync";
import { AppToaster } from "@/components/shell/AppToaster";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const fraunces = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  style: ["normal", "italic"],
});

/** Absolute base for OG / canonical URLs (link previews need absolute image URLs). */
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL
  ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : undefined)
  ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "CharaVerse", template: "%s · CharaVerse" },
  description: "创建、聊天、分享属于你的 AI 角色。",
  icons: { icon: [{ url: "/favicon.svg", type: "image/svg+xml" }, { url: "/favicon.ico" }], apple: "/apple-touch-icon.png" },
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
              <AppToaster />
            </AuthProvider>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
