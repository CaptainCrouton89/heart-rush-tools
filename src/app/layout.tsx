import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "../lib/polyfills";
import { AppLayout } from "../components/layout/AppLayout";
import { ThemeProvider } from "../components/layout/ThemeProvider";
import { GMProvider } from "../context/GMContext";
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

export const metadata: Metadata = {
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
        width: 512,
        height: 512,
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
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#1a1a1a" },
  ],
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 5,
  },
  robots: {
    index: true,
    follow: true,
  },
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
            <AppLayout>{children}</AppLayout>
          </GMProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
