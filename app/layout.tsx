import type { Metadata, Viewport } from "next";
import { DM_Sans, Outfit } from "next/font/google";
import "./globals.css";
import OfflineProvider from "./components/OfflineProvider";

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
  variable: "--font-dm-sans",
});

const outfit = Outfit({
  subsets: ["latin"],
  weight: ["700"],
  display: "swap",
  variable: "--font-outfit",
});

export const metadata: Metadata = {
  title: "Argent Clair",
  description: "Votre argent, simplement.",
};

export const viewport: Viewport = {
  themeColor: "#7657e8",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body className={`${dmSans.variable} ${outfit.variable}`}>
        <OfflineProvider>{children}</OfflineProvider>
      </body>
    </html>
  );
}