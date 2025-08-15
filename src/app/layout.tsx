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
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
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
