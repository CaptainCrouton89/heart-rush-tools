import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "../lib/polyfills";
import { AppLayout } from "../components/layout/AppLayout";
import { ThemeProvider } from "../components/layout/ThemeProvider";
import { GMProvider } from "../context/GMContext";
import { WorldProvider } from "../context/WorldContext";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
  preload: true,
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
  preload: true,
});

const appUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ??
  "http://localhost:3909";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: "Heart Rush TTRPG Reference",
  description:
    "Complete reference guide for the Heart Rush tabletop RPG system",
  icons: {
    icon: "/heart.png",
    apple: "/heart.png",
  },
  openGraph: {
    title: "Heart Rush TTRPG Reference",
    description:
      "Complete reference guide for the Heart Rush tabletop RPG system",
    type: "website",
    images: [
      {
        url: "/heart.png",
        width: 450,
        height: 450,
        alt: "Heart Rush Logo",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "Heart Rush TTRPG Reference",
    description:
      "Complete reference guide for the Heart Rush tabletop RPG system",
    images: ["/heart.png"],
  },
  manifest: "/manifest.json",
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#1a1a1a" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider>
          <GMProvider>
            <WorldProvider>
              <AppLayout>{children}</AppLayout>
            </WorldProvider>
          </GMProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
