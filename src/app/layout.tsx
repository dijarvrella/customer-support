import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { getBranding, brandingCssVars } from "@/lib/branding";

const inter = Inter({ subsets: ["latin"] });
const branding = getBranding();

export const metadata: Metadata = {
  title: branding.portalTitle,
  description: branding.portalSubtitle,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={branding.cssClass}>
      <head>
        <style dangerouslySetInnerHTML={{ __html: brandingCssVars(branding) }} />
      </head>
      <body className={inter.className}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
