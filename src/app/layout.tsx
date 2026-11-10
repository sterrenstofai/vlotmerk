import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { PRODUCT } from "@/lib/config/product";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: PRODUCT.naam, template: `%s | ${PRODUCT.naam}` },
  metadataBase: new URL(PRODUCT.url),
  description: "Check of je merknaam sterk genoeg is om te registreren.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="nl" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
