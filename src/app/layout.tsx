import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ReduxProvider } from "./components/providers/ReduxProvider";
import { AuthCheck } from "./components/auth/AuthCheck";
import { AppWrapper } from "./components/layout/AppWrapper";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CharaVerse - AI Role-Playing Universe",
  description: "Enter your AI role-playing universe. Create, chat, and share with unique AI characters.",
  manifest: "/manifest.json",
  themeColor: "#3b82f6",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "CharaVerse",
    startupImage: [
      "/icons/icon-192x192.png",
      {
        url: "/icons/icon-384x384.png",
        media: "(device-width: 390px) and (device-height: 844px)"
      }
    ]
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    type: "website",
    siteName: "CharaVerse",
    title: {
      default: "CharaVerse - AI Role-Playing Universe",
      template: "%s - CharaVerse"
    },
    description: "Enter your AI role-playing universe. Create, chat, and share with unique AI characters.",
    images: [
      {
        url: "/icons/icon-512x512.png",
        width: 512,
        height: 512,
        alt: "CharaVerse Logo"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: "CharaVerse - AI Role-Playing Universe",
    description: "Enter your AI role-playing universe. Create, chat, and share with unique AI characters.",
    images: ["/icons/icon-512x512.png"]
  },
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
    viewportFit: "cover"
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <head>
        <meta name="theme-color" content="#3b82f6" />
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="CharaVerse" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="msapplication-TileColor" content="#3b82f6" />
        <meta name="msapplication-tap-highlight" content="no" />
        <meta name="format-detection" content="telephone=no" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ReduxProvider>
          <AuthCheck>
            <AppWrapper>
              {children}
            </AppWrapper>
          </AuthCheck>
        </ReduxProvider>
      </body>
    </html>
  );
}
