import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import "./globals.css";

// App font: Geist (clean neutral sans). The `Geist` loader isn't available in
// next/font/google in this Next version, so we use the `geist` package's
// GeistSans. It exposes --font-geist-sans, which globals.css aliases to
// --font-app and points --font-sans/-mono/-heading at.

export const metadata: Metadata = {
  title: "akaCOVART — Album Art Engine",
  description: "Generative album-art studio.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`dark ${GeistSans.variable}`}>
      <body className="font-sans">
        {children}
      </body>
    </html>
  );
}
