import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Argent Clair",
  description: "Votre argent, simplement.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="fr"><body>{children}</body></html>;
}
