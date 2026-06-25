import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import "./globals.css";

// App font: Geist (clean neutral sans). The `Geist` loader isn't available in
// next/font/google in this Next version, so we use the `geist` package's
// GeistSans. It exposes --font-geist-sans, which globals.css aliases to
// --font-app and points --font-sans/-mono/-heading at.

// Icons + share image are STATIC files in /public (real .png with an image/png
// content-type). The previous next/og route handlers (opengraph-image.tsx,
// apple-icon.tsx) emit EXTENSIONLESS files under `output: export`, which the
// static host serves as application/octet-stream — so every link-preview crawler
// rejected them (no logo on shared links). Real .png files fix the content-type.
export const metadata: Metadata = {
  metadataBase: new URL("https://akacovart.com"),
  title: "akaCOVART — Album Art Engine",
  description:
    "A generative album-art studio. Shape it, sync the motion to your track, and export the cover.",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon.png", type: "image/png", sizes: "512x512" },
    ],
    apple: { url: "/apple-icon.png", sizes: "180x180", type: "image/png" },
  },
  openGraph: {
    type: "website",
    siteName: "akaCOVART",
    url: "https://akacovart.com",
    title: "akaCOVART — Album Art Engine",
    description: "A generative album-art studio.",
    images: [
      { url: "/og.png", width: 1200, height: 630, type: "image/png", alt: "akaCOVART" },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "akaCOVART — Album Art Engine",
    description: "A generative album-art studio.",
    images: ["/og.png"],
  },
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
